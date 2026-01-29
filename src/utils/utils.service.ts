import { Injectable, BadRequestException, Logger } from '@nestjs/common';
import * as sharp from 'sharp';
import * as crypto from 'crypto';
import { Storage } from '@google-cloud/storage';
import { extname } from 'path';
import {
  OutputFormat,
  SUPPORTED_INPUT_FORMATS,
  ImageConvertResponseDto,
} from './dto/image-convert.dto';
import { PrismaService } from '../common/services/prisma.service';
import { getNowKST } from '../common/utils/kst-date.util';

export interface FileUploadResult {
  url: string;
  originalName: string;
  size: number;
}

export interface FileUploadWithIdResult {
  id: number;
  url: string;
  originalName: string;
  size: number;
}

@Injectable()
export class UtilsService {
  private readonly logger = new Logger(UtilsService.name);
  private readonly storage: Storage;
  private readonly bucketName: string;

  constructor(private readonly prisma: PrismaService) {
    this.storage = new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });
    this.bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET || 'api-dev-biocom-uploads';
  }

  private readonly MAX_FILES = 50;

  async convertImages(
    files: Express.Multer.File[],
    outputFormat: OutputFormat,
    quality: number = 80,
  ): Promise<{ results: ImageConvertResponseDto[]; buffers: Buffer[] }> {
    // 파일 개수 검증
    if (files.length > this.MAX_FILES) {
      throw new BadRequestException(
        `최대 ${this.MAX_FILES}개의 파일만 변환할 수 있습니다`,
      );
    }

    // 파일 검증
    for (const file of files) {
      this.validateFile(file);
    }

    const results: ImageConvertResponseDto[] = [];
    const buffers: Buffer[] = [];

    for (const file of files) {
      try {
        const convertedBuffer = await this.convertSingleImage(
          file.buffer,
          outputFormat,
          quality,
        );

        // 한글 파일명 디코딩 처리
        let originalName = file.originalname;
        try {
          originalName = Buffer.from(file.originalname, 'latin1').toString('utf8');
        } catch {
          // 디코딩 실패 시 원본 사용
        }

        const originalExt = originalName.split('.').pop() || '';
        const baseName = originalName.replace(`.${originalExt}`, '');
        const convertedName = `${baseName}.${outputFormat}`;

        const compressionRatio =
          ((file.size - convertedBuffer.length) / file.size) * 100;

        results.push({
          originalName,
          convertedName,
          originalSize: file.size,
          convertedSize: convertedBuffer.length,
          compressionRatio: Math.round(compressionRatio * 100) / 100,
        });

        buffers.push(convertedBuffer);
      } catch (error) {
        this.logger.error(`이미지 변환 실패: ${file.originalname}`, error);
        throw new BadRequestException(
          `이미지 변환 실패: ${file.originalname} - ${error.message}`,
        );
      }
    }

    return { results, buffers };
  }

  private validateFile(file: Express.Multer.File): void {
    // 파일 확장자 검증
    const ext = file.originalname.split('.').pop()?.toLowerCase();
    if (!ext || !SUPPORTED_INPUT_FORMATS.includes(ext as any)) {
      throw new BadRequestException(
        `지원하지 않는 파일 형식: ${file.originalname}. 지원 포맷: ${SUPPORTED_INPUT_FORMATS.join(', ')}`,
      );
    }

    // MIME 타입 검증
    const validMimeTypes = [
      'image/png',
      'image/jpeg',
      'image/webp',
      'image/gif',
      'image/tiff',
      'image/avif',
    ];
    if (!validMimeTypes.includes(file.mimetype)) {
      throw new BadRequestException(
        `지원하지 않는 MIME 타입: ${file.mimetype}`,
      );
    }
  }

  private async convertSingleImage(
    buffer: Buffer,
    outputFormat: OutputFormat,
    quality: number,
  ): Promise<Buffer> {
    let sharpInstance = sharp(buffer);

    switch (outputFormat) {
      case 'webp':
        sharpInstance = sharpInstance.webp({ quality });
        break;
      case 'avif':
        sharpInstance = sharpInstance.avif({ quality });
        break;
      case 'png':
        sharpInstance = sharpInstance.png({
          compressionLevel: Math.round((100 - quality) / 10),
        });
        break;
      case 'jpg':
        sharpInstance = sharpInstance.jpeg({ quality });
        break;
      default:
        throw new BadRequestException(`지원하지 않는 출력 포맷: ${outputFormat}`);
    }

    return sharpInstance.toBuffer();
  }

  /**
   * 파일 업로드 (GCS)
   */
  async uploadFiles(
    files: Express.Multer.File[],
    folder?: string,
  ): Promise<FileUploadResult[]> {
    if (files.length > this.MAX_FILES) {
      throw new BadRequestException(
        `최대 ${this.MAX_FILES}개의 파일만 업로드할 수 있습니다`,
      );
    }

    const results: FileUploadResult[] = [];

    for (const file of files) {
      try {
        const fileExt = extname(file.originalname).toLowerCase();
        const safeFileName = `${crypto.randomBytes(16).toString('hex')}${fileExt}`;
        const filePath = folder ? `${folder}/${safeFileName}` : safeFileName;

        const bucket = this.storage.bucket(this.bucketName);
        const gcsFile = bucket.file(filePath);

        await gcsFile.save(file.buffer, {
          metadata: { contentType: file.mimetype },
          public: true,
        });

        const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${filePath}`;

        results.push({
          url: publicUrl,
          originalName: file.originalname,
          size: file.size,
        });

        this.logger.log(`파일 업로드 완료: ${publicUrl}`);
      } catch (error) {
        this.logger.error(`파일 업로드 실패: ${file.originalname}`, error);
        throw new BadRequestException(
          `파일 업로드 실패: ${file.originalname} - ${error.message}`,
        );
      }
    }

    return results;
  }

  /**
   * 파일 업로드 + File 테이블 저장 (ID 반환)
   */
  async uploadFilesWithRecord(
    files: Express.Multer.File[],
    folder?: string,
  ): Promise<FileUploadWithIdResult[]> {
    if (files.length > this.MAX_FILES) {
      throw new BadRequestException(
        `최대 ${this.MAX_FILES}개의 파일만 업로드할 수 있습니다`,
      );
    }

    const results: FileUploadWithIdResult[] = [];

    for (const file of files) {
      const fileExt = extname(file.originalname).toLowerCase();
      const safeFileName = `${crypto.randomBytes(16).toString('hex')}${fileExt}`;
      const filePath = folder ? `${folder}/${safeFileName}` : safeFileName;

      const bucket = this.storage.bucket(this.bucketName);
      const gcsFile = bucket.file(filePath);

      await gcsFile.save(file.buffer, {
        metadata: { contentType: file.mimetype },
        public: true,
      });

      const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${filePath}`;

      const fileRecord = await this.prisma.file.create({
        data: {
          originalName: file.originalname,
          storedName: safeFileName,
          filePath: publicUrl,
          fileSize: file.size,
          mimeType: file.mimetype,
          storageType: 'gcs',
          createdAt: getNowKST(),
        },
      });

      results.push({
        id: fileRecord.id,
        url: publicUrl,
        originalName: file.originalname,
        size: file.size,
      });

      this.logger.log(`파일 업로드 완료 (ID: ${fileRecord.id}): ${publicUrl}`);
    }

    return results;
  }

  /**
   * 파일 삭제 (URL로 삭제)
   */
  async deleteFileByUrl(url: string): Promise<void> {
    const expectedPrefix = `https://storage.googleapis.com/${this.bucketName}/`;
    if (!url.startsWith(expectedPrefix)) {
      throw new BadRequestException(
        '유효하지 않은 URL입니다. 해당 버킷의 파일만 삭제할 수 있습니다.',
      );
    }

    const filePath = url.replace(expectedPrefix, '');
    if (!filePath) {
      throw new BadRequestException('파일 경로를 추출할 수 없습니다.');
    }

    try {
      const bucket = this.storage.bucket(this.bucketName);
      const gcsFile = bucket.file(filePath);

      const [exists] = await gcsFile.exists();
      if (!exists) {
        throw new BadRequestException('파일을 찾을 수 없습니다.');
      }

      await gcsFile.delete();
      this.logger.log(`파일 삭제 완료: ${url}`);
    } catch (error) {
      if (error instanceof BadRequestException) {
        throw error;
      }
      this.logger.error(`파일 삭제 실패: ${url}`, error);
      throw new BadRequestException(`파일 삭제 실패: ${error.message}`);
    }
  }
}
