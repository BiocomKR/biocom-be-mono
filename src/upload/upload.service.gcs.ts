import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { FileUploadResponseDto } from './dto/file-upload-response.dto';
import { Storage } from '@google-cloud/storage';
import { extname, basename } from 'path';
import * as crypto from 'crypto';
import { UploadSecurityConfig } from './upload.security.config';

/**
 * GCS 기반 파일 업로드 서비스
 * Google Cloud Storage를 사용한 파일 업로드 관리
 */
@Injectable()
export class UploadServiceGCS {
  private readonly logger = new Logger(UploadServiceGCS.name);
  private readonly storage: Storage;
  private readonly bucketName: string;
  private readonly tempBucketName: string;
  private readonly config = UploadSecurityConfig;

  constructor(private readonly prisma: PrismaService) {
    // GCS 클라이언트 초기화
    this.storage = new Storage({
      projectId: process.env.GCS_PROJECT_ID || 'biocom-api-dev',
    });

    // 버킷 이름 설정
    this.bucketName = process.env.GCS_BUCKET_NAME || 'biocom-api-dev-biocom-uploads';
    this.tempBucketName = process.env.GCS_TEMP_BUCKET_NAME || 'biocom-api-dev-biocom-temp';
    
    this.logger.log(`GCS 버킷 설정: ${this.bucketName}`);
  }

  /**
   * 파일의 매직 바이트를 확인하여 실제 파일 타입 검증
   */
  private async verifyFileSignature(buffer: Buffer, expectedType: string): Promise<boolean> {
    try {
      // WebP 파일의 경우 추가 검증
      if (expectedType === 'webp') {
        const riffHeader = buffer.slice(0, 4).toString('ascii');
        const webpHeader = buffer.slice(8, 12).toString('ascii');
        return riffHeader === 'RIFF' && webpHeader === 'WEBP';
      }
      
      // 다른 이미지 형식들의 매직 바이트 검증
      const signatures = this.config.fileSignatures.get(expectedType);
      if (!signatures) {
        return false;
      }
      
      // 파일의 첫 바이트들이 시그니처와 일치하는지 확인
      for (let i = 0; i < signatures.length; i++) {
        if (buffer[i] !== signatures[i]) {
          return false;
        }
      }
      
      return true;
    } catch (error) {
      this.logger.error('파일 시그니처 검증 중 오류 발생', error);
      return false;
    }
  }

  /**
   * 파일명 보안 검증
   */
  private validateFileName(filename: string): void {
    // 파일명 길이 검증
    if (filename.length > this.config.limits.maxFileNameLength) {
      throw new BadRequestException(this.config.errorMessages.fileNameTooLong);
    }

    // Null 바이트 검증
    if (filename.includes('\0')) {
      throw new BadRequestException(this.config.errorMessages.invalidFileName);
    }

    // 경로 순회 공격 방지
    const normalizedName = basename(filename);
    if (normalizedName !== filename || filename.includes('..') || filename.includes('/') || filename.includes('\\')) {
      throw new BadRequestException(this.config.errorMessages.pathTraversal);
    }

    // 이중 확장자 검증
    const parts = filename.split('.');
    if (parts.length > 2) {
      const dangerousExtensions = this.config.dangerousExtensions;
      
      for (let i = 0; i < parts.length - 1; i++) {
        if (dangerousExtensions.includes(parts[i].toLowerCase())) {
          throw new BadRequestException(this.config.errorMessages.dangerousPattern);
        }
      }
    }
  }

  /**
   * 이미지 업로드 (GCS)
   */
  async uploadImage(
    file: Express.Multer.File,
    userId: number,
    relatedType?: string,
  ): Promise<FileUploadResponseDto> {
    this.logger.log(`GCS 이미지 업로드 시작 - 사용자 ID: ${userId}, 파일: ${file.originalname}`);

    try {
      // 1. 파일 크기 검증
      if (file.size > this.config.limits.maxFileSize) {
        throw new BadRequestException(this.config.errorMessages.fileSizeTooLarge);
      }

      // 2. 파일명 보안 검증
      this.validateFileName(file.originalname);

      // 3. MIME 타입 검증
      const allowedMimeTypes = ['image/jpeg', 'image/png', 'image/gif', 'image/webp'];
      if (!allowedMimeTypes.includes(file.mimetype)) {
        throw new BadRequestException(this.config.errorMessages.invalidFileType);
      }

      // 4. 확장자 검증
      const fileExt = extname(file.originalname).toLowerCase();
      const allowedExtensions = ['.jpg', '.jpeg', '.png', '.gif', '.webp'];
      if (!allowedExtensions.includes(fileExt)) {
        throw new BadRequestException(this.config.errorMessages.invalidExtension);
      }

      // 5. 파일 시그니처 검증
      let fileType: string;
      if (fileExt === '.jpg' || fileExt === '.jpeg') {
        fileType = 'jpg';
      } else if (fileExt === '.png') {
        fileType = 'png';
      } else if (fileExt === '.gif') {
        fileType = 'gif';
      } else if (fileExt === '.webp') {
        fileType = 'webp';
      } else {
        throw new BadRequestException(this.config.errorMessages.invalidFileType);
      }

      const isValidSignature = await this.verifyFileSignature(file.buffer, fileType);
      if (!isValidSignature) {
        // 다른 이미지 형식인지 확인
        const imageTypes = ['jpg', 'png', 'gif', 'webp'];
        let isValidImage = false;
        
        for (const type of imageTypes) {
          if (type !== fileType && await this.verifyFileSignature(file.buffer, type)) {
            this.logger.warn(`파일 확장자는 ${fileExt}이지만 실제는 ${type} 형식입니다`);
            isValidImage = true;
            break;
          }
        }
        
        if (!isValidImage) {
          throw new BadRequestException(this.config.errorMessages.invalidSignature);
        }
      }

      // 6. 안전한 파일명 생성
      const safeFileName = `${crypto.randomBytes(16).toString('hex')}${fileExt}`;
      const folder = this.getUploadFolder(relatedType);
      const gcsPath = `${folder}/${safeFileName}`;

      // 7. GCS에 업로드
      const bucket = this.storage.bucket(this.bucketName);
      const blob = bucket.file(gcsPath);
      
      await blob.save(file.buffer, {
        metadata: {
          contentType: file.mimetype,
          metadata: {
            originalName: file.originalname,
            userId: userId.toString(),
            uploadedAt: new Date().toISOString(),
          },
        },
      });

      // 8. 공개 URL 생성 (필요한 경우)
      const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${gcsPath}`;

      // 9. 파일 정보 데이터베이스에 저장
      const fileUpload = await this.prisma.fileUpload.create({
        data: {
          userId,
          originalName: file.originalname,
          filename: safeFileName,
          path: publicUrl,  // GCS URL 저장
          size: file.size,
          mimetype: file.mimetype,
          fileType: 'image',
          uploadCategory: relatedType || 'general',
          // metadata 필드는 Prisma 스키마에 추가 필요
          // metadata: {
          //   bucketName: this.bucketName,
          //   gcsPath,
          // },
        },
      });

      this.logger.log(`GCS 이미지 업로드 완료 - ID: ${fileUpload.id}, GCS 경로: ${gcsPath}`);

      return {
        id: fileUpload.id,
        filename: safeFileName,
        originalName: fileUpload.originalName,
        mimeType: fileUpload.mimetype,
        size: fileUpload.size,
        path: fileUpload.path,
        uploadedAt: fileUpload.uploadedAt,
      };
    } catch (error) {
      this.logger.error(`GCS 이미지 업로드 중 오류 발생: ${error.message}`, error);
      throw error;
    }
  }

  /**
   * 업로드 폴더 결정
   */
  private getUploadFolder(relatedType?: string): string {
    switch (relatedType) {
      case 'mission':
      case 'mission_verification':
        return 'images/missions';
      case 'profile':
        return 'profiles';
      case 'event':
        return 'images/events';
      case 'document':
        return 'documents';
      case 'temp':
        return 'temp';
      default:
        return 'images/general';
    }
  }

  /**
   * 서명된 URL 생성 (임시 접근용)
   */
  async generateSignedUrl(fileId: number, expiresInMinutes: number = 15): Promise<string> {
    const file = await this.prisma.fileUpload.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new NotFoundException('파일을 찾을 수 없습니다');
    }

    // GCS 경로 생성 (path 필드에서 추출)
    const gcsPath = file.path.replace(`https://storage.googleapis.com/${this.bucketName}/`, '');

    const bucket = this.storage.bucket(this.bucketName);
    const blob = bucket.file(gcsPath);

    const [signedUrl] = await blob.getSignedUrl({
      version: 'v4',
      action: 'read',
      expires: Date.now() + expiresInMinutes * 60 * 1000,
    });

    this.logger.log(`서명된 URL 생성 완료 - 파일 ID: ${fileId}, 만료: ${expiresInMinutes}분`);

    return signedUrl;
  }

  /**
   * 파일 삭제 (GCS + DB)
   */
  async deleteFile(fileId: number, userId: number): Promise<void> {
    const file = await this.prisma.fileUpload.findFirst({
      where: {
        id: fileId,
        userId,
      },
    });

    if (!file) {
      throw new NotFoundException('파일을 찾을 수 없습니다');
    }

    // GCS에서 파일 삭제
    if (file.path && file.path.includes('storage.googleapis.com')) {
      try {
        const gcsPath = file.path.replace(`https://storage.googleapis.com/${this.bucketName}/`, '');
        const bucket = this.storage.bucket(this.bucketName);
        await bucket.file(gcsPath).delete();
        this.logger.log(`GCS 파일 삭제 완료: ${gcsPath}`);
      } catch (error) {
        this.logger.error(`GCS 파일 삭제 실패: ${error.message}`, error);
      }
    }

    // DB에서 레코드 삭제
    await this.prisma.fileUpload.delete({
      where: { id: fileId },
    });

    this.logger.log(`파일 삭제 완료 - ID: ${fileId}`);
  }

  /**
   * 파일 정보 조회
   */
  async getFileInfo(fileId: number): Promise<FileUploadResponseDto> {
    this.logger.log(`파일 정보 조회 - ID: ${fileId}`);

    const file = await this.prisma.fileUpload.findUnique({
      where: { id: fileId },
    });

    if (!file) {
      throw new NotFoundException('파일을 찾을 수 없습니다');
    }

    return {
      id: file.id,
      filename: file.filename,
      originalName: file.originalName,
      mimeType: file.mimetype,
      size: file.size,
      path: file.path,
      uploadedAt: file.uploadedAt,
    };
  }

  /**
   * 임시 파일 업로드 (24시간 후 자동 삭제)
   */
  async uploadTempFile(
    file: Express.Multer.File,
    userId: number,
  ): Promise<FileUploadResponseDto> {
    this.logger.log(`임시 파일 업로드 - 사용자 ID: ${userId}, 파일: ${file.originalname}`);

    const safeFileName = `${crypto.randomBytes(16).toString('hex')}${extname(file.originalname)}`;
    const gcsPath = `temp/${safeFileName}`;

    // 임시 버킷에 업로드 (24시간 후 자동 삭제)
    const bucket = this.storage.bucket(this.tempBucketName);
    const blob = bucket.file(gcsPath);
    
    await blob.save(file.buffer, {
      metadata: {
        contentType: file.mimetype,
        metadata: {
          userId: userId.toString(),
          uploadedAt: new Date().toISOString(),
          autoDelete: '24h',
        },
      },
    });

    const publicUrl = `https://storage.googleapis.com/${this.tempBucketName}/${gcsPath}`;

    return {
      id: 0, // 임시 파일은 DB에 저장하지 않음
      filename: safeFileName,
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      path: publicUrl,
      uploadedAt: new Date(),
    };
  }
}