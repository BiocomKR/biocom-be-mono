import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { Storage } from '@google-cloud/storage';
import * as sharp from 'sharp';

/**
 * 구글 클라우드 스토리지 공통 서비스
 * 음식 칼로리 계산 및 얼굴 슬리밍 서비스에서 공통으로 사용
 */
@Injectable()
export class GoogleStorageService {
  private readonly logger = new Logger(GoogleStorageService.name);
  private readonly storage: Storage;
  private readonly bucketName: string;
  private readonly projectId: string;

  constructor(private readonly configService: ConfigService) {
    this.bucketName = this.configService.get<string>('GOOGLE_CLOUD_STORAGE_BUCKET') || 'biocom-file-storage';
    this.projectId = this.configService.get<string>('GOOGLE_CLOUD_PROJECT_ID');

    if (!this.projectId) {
      throw new Error('GOOGLE_CLOUD_PROJECT_ID가 설정되지 않았습니다.');
    }

    // Service Account Key 파일 경로 확인
    const serviceAccountKeyFile = this.configService.get<string>('GOOGLE_SERVICE_ACCOUNT_KEY_FILE');
    
    // Google Cloud Storage 초기화 (Service Account Key 우선 사용)
    if (serviceAccountKeyFile && require('fs').existsSync(serviceAccountKeyFile)) {
      this.storage = new Storage({
        projectId: this.projectId,
        keyFilename: serviceAccountKeyFile,
      });
      this.logger.log(`Google Storage 서비스 초기화 완료! (Service Account Key 방식) 버킷: ${this.bucketName}, 프로젝트: ${this.projectId} 🔐`);
    } else {
      this.storage = new Storage({
        projectId: this.projectId,
      });
      this.logger.warn(`Service Account Key 파일을 찾을 수 없어 Application Default Credentials 사용: ${serviceAccountKeyFile} 📦`);
      this.logger.log(`Google Storage 서비스 초기화 완료! (ADC 방식) 버킷: ${this.bucketName}, 프로젝트: ${this.projectId} 📦`);
    }
  }

  /**
   * 이미지 파일을 Google Cloud Storage에 업로드
   * @param imageBuffer 이미지 버퍼
   * @param originalFileName 원본 파일명
   * @param serviceType 서비스 타입 ('face-slimming' | 'food-calorie')
   * @param optimizeJpeg JPEG 최적화 여부 (기본값: true)
   * @returns 업로드된 파일의 공개 URL
   */
  async uploadImageFile(
    imageBuffer: Buffer,
    originalFileName: string,
    serviceType: 'face-slimming' | 'food-calorie',
    optimizeJpeg: boolean = true
  ): Promise<string> {
    try {
      // 유니크한 파일명 생성
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const cleanFileName = originalFileName.replace(/\.[^/.]+$/, ''); // 확장자 제거
      const fileName = `${serviceType}_${timestamp}_${cleanFileName}.jpg`; // JPEG로 통일
      
      this.logger.log(`🔧 파일 업로드 준비: ${fileName}, 버퍼크기: ${imageBuffer.length}bytes`);

      // JPEG 최적화 (압축 및 품질 조정)
      let processedBuffer = imageBuffer;
      if (optimizeJpeg) {
        processedBuffer = await sharp(imageBuffer)
          .jpeg({ 
            quality: 85,
            mozjpeg: true // 더 나은 압축 알고리즘
          })
          .toBuffer();

        const originalSize = (imageBuffer.length / 1024).toFixed(1);
        const optimizedSize = (processedBuffer.length / 1024).toFixed(1);
        this.logger.log(`이미지 최적화 완료: ${originalSize}KB → ${optimizedSize}KB`);
      }

      // Google Cloud Storage에 파일 업로드
      const file = this.storage.bucket(this.bucketName).file(fileName);
      
      await file.save(processedBuffer, {
        metadata: {
          contentType: 'image/jpeg',
          metadata: {
            originalName: originalFileName,
            processedAt: new Date().toISOString(),
            service: serviceType,
            optimized: optimizeJpeg.toString()
          }
        }
      });

      // Signed URL 생성 시도 (실패해도 Public URL 사용)
      try {
        const [signedUrl] = await file.getSignedUrl({
          action: 'read',
          expires: Date.now() + 7 * 24 * 60 * 60 * 1000, // 7일
        });
        
        this.logger.log(`✅ Google Storage 업로드 완료: Signed URL 생성 성공 (${serviceType}), 7일 유효`);
        return signedUrl;
        
      } catch (urlError) {
        // Signed URL 생성 실패 시 Public URL 사용
        const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${fileName}`;
        this.logger.warn(`⚠️ Signed URL 생성 실패, Public URL 사용: ${publicUrl}`);
        this.logger.warn(`⚠️ Signed URL 에러: ${urlError.message}`);
        return publicUrl;
      }

    } catch (error) {
      this.logger.error(`Google Storage 업로드 실패 (${serviceType}):`, error.message);
      
      // 인증 에러인지 확인
      if (error.message.includes('invalid_grant') || error.message.includes('invalid_rapt')) {
        throw new Error('Google Cloud 인증 오류가 발생했습니다. 서비스 계정 키를 확인해주세요.');
      }
      
      throw new Error(`스토리지 업로드 실패: ${error.message}`);
    }
  }

  /**
   * 로컬 fallback 저장 (Google Storage 실패 시 사용)
   * @param imageBuffer 이미지 버퍼
   * @param originalFileName 원본 파일명
   * @param serviceType 서비스 타입
   * @returns 로컬 파일 URL
   */
  async saveToLocalFallback(
    imageBuffer: Buffer,
    originalFileName: string,
    serviceType: 'face-slimming' | 'food-calorie'
  ): Promise<string> {
    const fs = await import('fs');
    const path = await import('path');

    try {
      // 유니크한 파일명 생성
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
      const cleanFileName = originalFileName.replace(/\.[^/.]+$/, '');
      const fileName = `${serviceType}_${timestamp}_${cleanFileName}.jpg`;
      const localPath = path.join(process.cwd(), 'uploads', fileName);

      // uploads 디렉토리가 없으면 생성
      const uploadsDir = path.join(process.cwd(), 'uploads');
      if (!fs.existsSync(uploadsDir)) {
        fs.mkdirSync(uploadsDir, { recursive: true });
      }

      // JPEG로 재압축하여 용량 최적화
      const optimizedBuffer = await sharp(imageBuffer)
        .jpeg({ 
          quality: 85,
          mozjpeg: true
        })
        .toBuffer();

      // 파일 저장
      fs.writeFileSync(localPath, optimizedBuffer);

      // 로컬 URL 반환
      const localUrl = `http://localhost:10804/uploads/${fileName}`;
      
      const originalSize = (imageBuffer.length / 1024).toFixed(1);
      const optimizedSize = (optimizedBuffer.length / 1024).toFixed(1);
      this.logger.warn(`로컬 fallback 저장 완료: ${localUrl} (${originalSize}KB → ${optimizedSize}KB)`);
      return localUrl;

    } catch (error) {
      this.logger.error('로컬 fallback 저장도 실패:', error.message);
      throw new Error(`파일 저장 완전 실패: ${error.message}`);
    }
  }

  /**
   * Google Storage에 업로드하고, 실패시 로컬에 저장 (재시도 로직 포함)
   * @param imageBuffer 이미지 버퍼
   * @param originalFileName 원본 파일명
   * @param serviceType 서비스 타입
   * @param maxRetries 최대 재시도 횟수 (기본값: 2)
   * @returns 업로드된 파일 URL과 저장 위치 정보
   */
  async uploadWithFallback(
    imageBuffer: Buffer,
    originalFileName: string,
    serviceType: 'face-slimming' | 'food-calorie',
    maxRetries: number = 2
  ): Promise<{ url: string; location: 'google-storage' | 'local-fallback' }> {
    this.logger.log(`🚀 업로드 시작 - 서비스: ${serviceType}, 파일: ${originalFileName}, 버퍼크기: ${imageBuffer.length}bytes`);
    
    // 먼저 Google Storage 업로드 시도 (재시도 포함)
    for (let attempt = 0; attempt <= maxRetries; attempt++) {
      try {
        this.logger.log(`📤 Google Storage 업로드 시도 ${attempt + 1}/${maxRetries + 1} (${serviceType})`);
        
        const url = await this.uploadImageFile(imageBuffer, originalFileName, serviceType);
        
        this.logger.log(`✅ Google Storage 업로드 성공! 시도: ${attempt + 1}, URL: ${url}`);
        return { url, location: 'google-storage' };

      } catch (error) {
        this.logger.error(`❌ Google Storage 업로드 시도 ${attempt + 1} 실패 - 에러: ${error.message}`);
        this.logger.error(`📋 에러 스택: ${error.stack}`);
        
        if (attempt === maxRetries) {
          this.logger.error(`💀 Google Storage 모든 시도 실패! 로컬 fallback 사용 (${serviceType})`);
          break;
        }

        // 재시도 전 잠시 대기 (1초)
        this.logger.log(`⏳ ${1}초 대기 후 재시도...`);
        await new Promise(resolve => setTimeout(resolve, 1000));
      }
    }

    // Google Storage 실패시 로컬 fallback 사용
    try {
      this.logger.warn(`🏠 로컬 fallback 저장 시작 (${serviceType})`);
      const url = await this.saveToLocalFallback(imageBuffer, originalFileName, serviceType);
      this.logger.warn(`🏠 로컬 fallback 저장 완료: ${url}`);
      return { url, location: 'local-fallback' };
    } catch (error) {
      this.logger.error(`💥 Google Storage와 로컬 저장 모두 실패: ${error.message}`);
      throw new Error(`Google Storage와 로컬 저장 모두 실패: ${error.message}`);
    }
  }

  /**
   * 특정 파일을 Google Storage에서 삭제
   * @param fileName 삭제할 파일명
   * @returns 삭제 성공 여부
   */
  async deleteFile(fileName: string): Promise<boolean> {
    try {
      const file = this.storage.bucket(this.bucketName).file(fileName);
      await file.delete();
      
      this.logger.log(`Google Storage 파일 삭제 완료: ${fileName}`);
      return true;
    } catch (error) {
      this.logger.error(`Google Storage 파일 삭제 실패 (${fileName}):`, error.message);
      return false;
    }
  }

  /**
   * 버킷 존재 확인 및 생성
   * @returns 버킷 준비 상태
   */
  async ensureBucket(): Promise<boolean> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const [exists] = await bucket.exists();
      
      if (!exists) {
        this.logger.warn(`버킷이 존재하지 않음: ${this.bucketName}. 생성을 시도합니다.`);
        await bucket.create();
        this.logger.log(`버킷 생성 완료: ${this.bucketName}`);
      }
      
      return true;
    } catch (error) {
      this.logger.error('버킷 확인/생성 실패:', error.message);
      return false;
    }
  }

  /**
   * 서비스 상태 확인
   */
  async isReady(): Promise<{ ready: boolean; bucketExists: boolean; error?: string }> {
    try {
      const bucketExists = await this.ensureBucket();
      return { ready: true, bucketExists };
    } catch (error) {
      return { ready: false, bucketExists: false, error: error.message };
    }
  }

  /**
   * 구글 스토리지 정보 조회
   */
  getStorageInfo(): { projectId: string; bucketName: string; provider: string } {
    return {
      projectId: this.projectId,
      bucketName: this.bucketName,
      provider: 'Google Cloud Storage'
    };
  }
}