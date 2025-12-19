import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { Storage } from '@google-cloud/storage';
import * as crypto from 'crypto';

interface UpdateManifest {
  id: string;
  createdAt: string;
  runtimeVersion: string;
  launchAsset: {
    hash: string;
    key: string;
    fileExtension: string;
    contentType: string;
    url: string;
  };
  assets: Array<{
    hash: string;
    key: string;
    fileExtension: string;
    contentType: string;
    url: string;
  }>;
  metadata: Record<string, any>;
  extra: Record<string, any>;
}

interface UpdateMetadata {
  id: string;
  createdAt: string;
  runtimeVersion: string;
  platform: string;
  bundleUrl: string;
  assets: Array<{
    hash: string;
    key: string;
    fileExtension: string;
    contentType: string;
    url: string;
  }>;
}

@Injectable()
export class EasUpdatesService {
  private readonly logger = new Logger(EasUpdatesService.name);
  private readonly storage: Storage;
  private readonly bucketName: string;
  private readonly updatesPrefix = 'eas-updates';

  constructor() {
    this.storage = new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });
    this.bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET || 'api-dev-biocom-uploads';
    this.logger.log(`EAS Updates 서비스 초기화 - 버킷: ${this.bucketName}`);
  }

  /**
   * 최신 업데이트 매니페스트 조회
   */
  async getManifest(
    runtimeVersion: string,
    platform: 'ios' | 'android',
  ): Promise<UpdateManifest | null> {
    this.logger.log(`매니페스트 조회 - runtimeVersion: ${runtimeVersion}, platform: ${platform}`);

    try {
      // GCS에서 해당 runtimeVersion/platform의 metadata.json 조회
      const metadataPath = `${this.updatesPrefix}/${runtimeVersion}/${platform}/metadata.json`;
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(metadataPath);

      const [exists] = await file.exists();
      if (!exists) {
        this.logger.log(`업데이트 없음 - ${metadataPath}`);
        return null;
      }

      const [content] = await file.download();
      const metadata: UpdateMetadata = JSON.parse(content.toString());

      // Expo Updates 프로토콜에 맞는 매니페스트 생성
      const manifest: UpdateManifest = {
        id: metadata.id,
        createdAt: metadata.createdAt,
        runtimeVersion: metadata.runtimeVersion,
        launchAsset: {
          hash: this.generateHash(metadata.bundleUrl),
          key: 'bundle',
          fileExtension: '.bundle',
          contentType: 'application/javascript',
          url: metadata.bundleUrl,
        },
        assets: metadata.assets || [],
        metadata: {},
        extra: {
          expoClient: {
            name: 'BiocomChallenge',
            slug: 'BiocomChallenge',
          },
        },
      };

      this.logger.log(`매니페스트 반환 - id: ${manifest.id}`);
      return manifest;
    } catch (error) {
      this.logger.error(`매니페스트 조회 실패: ${error.message}`, error.stack);
      return null;
    }
  }

  /**
   * 에셋 파일 URL 조회
   */
  async getAssetUrl(assetKey: string, runtimeVersion: string, platform: string): Promise<string> {
    const assetPath = `${this.updatesPrefix}/${runtimeVersion}/${platform}/assets/${assetKey}`;
    const url = `https://storage.googleapis.com/${this.bucketName}/${assetPath}`;

    // 파일 존재 여부 확인
    const bucket = this.storage.bucket(this.bucketName);
    const file = bucket.file(assetPath);
    const [exists] = await file.exists();

    if (!exists) {
      throw new NotFoundException(`에셋을 찾을 수 없습니다: ${assetKey}`);
    }

    return url;
  }

  /**
   * 업데이트 번들 업로드 (CLI 스크립트에서 사용)
   */
  async uploadUpdate(
    runtimeVersion: string,
    platform: 'ios' | 'android',
    bundleBuffer: Buffer,
    assets: Array<{ key: string; buffer: Buffer; contentType: string }>,
  ): Promise<{ updateId: string; manifestUrl: string }> {
    const updateId = crypto.randomUUID();
    const createdAt = new Date().toISOString();
    const basePath = `${this.updatesPrefix}/${runtimeVersion}/${platform}`;

    this.logger.log(`업데이트 업로드 시작 - id: ${updateId}, platform: ${platform}`);

    const bucket = this.storage.bucket(this.bucketName);

    // 1. 번들 파일 업로드
    const bundlePath = `${basePath}/bundles/${updateId}.bundle`;
    const bundleFile = bucket.file(bundlePath);
    await bundleFile.save(bundleBuffer, {
      metadata: { contentType: 'application/javascript' },
      public: true,
    });
    const bundleUrl = `https://storage.googleapis.com/${this.bucketName}/${bundlePath}`;

    // 2. 에셋 파일들 업로드
    const uploadedAssets = [];
    for (const asset of assets) {
      const assetPath = `${basePath}/assets/${asset.key}`;
      const assetFile = bucket.file(assetPath);
      await assetFile.save(asset.buffer, {
        metadata: { contentType: asset.contentType },
        public: true,
      });
      uploadedAssets.push({
        hash: this.generateHash(asset.key),
        key: asset.key,
        fileExtension: this.getFileExtension(asset.key),
        contentType: asset.contentType,
        url: `https://storage.googleapis.com/${this.bucketName}/${assetPath}`,
      });
    }

    // 3. 메타데이터 저장
    const metadata: UpdateMetadata = {
      id: updateId,
      createdAt,
      runtimeVersion,
      platform,
      bundleUrl,
      assets: uploadedAssets,
    };

    const metadataPath = `${basePath}/metadata.json`;
    const metadataFile = bucket.file(metadataPath);
    await metadataFile.save(JSON.stringify(metadata, null, 2), {
      metadata: { contentType: 'application/json' },
      public: true,
    });

    this.logger.log(`업데이트 업로드 완료 - id: ${updateId}`);

    return {
      updateId,
      manifestUrl: `https://storage.googleapis.com/${this.bucketName}/${metadataPath}`,
    };
  }

  private generateHash(input: string): string {
    return crypto.createHash('sha256').update(input).digest('hex').slice(0, 32);
  }

  private getFileExtension(filename: string): string {
    const parts = filename.split('.');
    return parts.length > 1 ? `.${parts[parts.length - 1]}` : '';
  }
}
