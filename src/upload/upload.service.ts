import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { FileUploadResponseDto } from './dto/file-upload-response.dto';
import { extname } from 'path';
import * as crypto from 'crypto';
import { UploadSecurityConfig } from './upload.security.config';
import { Storage } from '@google-cloud/storage';
import { ConfigService } from '../common/services/config.service';

/**
 * 파일 업로드 서비스
 * 활동 기록과 연관된 이미지 파일 업로드를 관리
 */
@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly config = UploadSecurityConfig;
  private readonly storage: Storage;
  private readonly bucketName: string;

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService
  ) {
    // Google Cloud Storage 클라이언트 초기화
    this.storage = new Storage({
      projectId: process.env.GOOGLE_CLOUD_PROJECT_ID,
      keyFilename: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    });
    this.bucketName = process.env.GOOGLE_CLOUD_STORAGE_BUCKET || 'api-dev-biocom-uploads';
    this.logger.log(`Google Cloud Storage 초기화 완료 - 버킷: ${this.bucketName}`);
  }

  // Google Cloud Storage 사용으로 로컬 디렉토리 생성 함수 제거됨

  /**
   * 파일의 매직 바이트를 확인하여 실제 파일 타입 검증 (메모리 버퍼 기반)
   */
  private verifyFileSignature(fileBuffer: Buffer, expectedType: string): boolean {
    try {
      // WebP 파일의 경우 추가 검증
      if (expectedType === 'webp') {
        // WebP는 RIFF 형식이므로 더 복잡한 검증 필요
        const riffHeader = fileBuffer.slice(0, 4).toString('ascii');
        const webpHeader = fileBuffer.slice(8, 12).toString('ascii');
        return riffHeader === 'RIFF' && webpHeader === 'WEBP';
      }

      // 다른 이미지 형식들의 매직 바이트 검증
      const signatures = this.config.fileSignatures.get(expectedType);
      if (!signatures) {
        return false;
      }

      // 파일의 첫 바이트들이 시그니처와 일치하는지 확인
      for (let i = 0; i < signatures.length; i++) {
        if (fileBuffer[i] !== signatures[i]) {
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
   * Google Cloud Storage에 파일 업로드
   */
  private async uploadToGoogleStorage(
    fileBuffer: Buffer,
    fileName: string,
    mimeType: string
  ): Promise<string> {
    try {
      const bucket = this.storage.bucket(this.bucketName);
      const file = bucket.file(fileName);

      // 파일 업로드
      await file.save(fileBuffer, {
        metadata: {
          contentType: mimeType,
        },
        public: true, // 공개 접근 허용
      });

      // 공개 URL 반환
      const publicUrl = `https://storage.googleapis.com/${this.bucketName}/${fileName}`;
      this.logger.log(`Google Cloud Storage 업로드 완료: ${publicUrl}`);

      return publicUrl;
    } catch (error) {
      this.logger.error('Google Cloud Storage 업로드 실패', error);
      throw new BadRequestException('파일 업로드 중 오류가 발생했습니다.');
    }
  }

  /**
   * 이미지 파일 업로드 및 기록 (메모리 스토리지 + Google Cloud Storage)
   */
  async uploadImage(
    userId: number,
    file: Express.Multer.File,
    relatedType: string
  ): Promise<FileUploadResponseDto> {
    this.logger.log(`이미지 업로드 시작 - 사용자: ${userId}, 파일: ${file.originalname}`);

    try {
      // 1. 파일 존재 여부 확인 (memoryStorage는 buffer, diskStorage는 path)
      if (!file || (!file.buffer && !file.path)) {
        throw new BadRequestException(this.config.errorMessages.fileNotFound);
      }

      // 파일 버퍼 준비 (memoryStorage면 buffer 사용, diskStorage면 path에서 읽기)
      let fileBuffer: Buffer;
      if (file.buffer) {
        fileBuffer = file.buffer;
        this.logger.debug(`메모리에서 파일 버퍼 사용 - 크기: ${fileBuffer.length}bytes`);
      } else if (file.path) {
        const fs = require('fs');
        fileBuffer = fs.readFileSync(file.path);
        this.logger.debug(`디스크에서 파일 읽기 완료 - 경로: ${file.path}, 크기: ${fileBuffer.length}bytes`);

        // 업로드 후 임시 파일 삭제
        setTimeout(() => {
          try {
            fs.unlinkSync(file.path);
            this.logger.debug(`임시 파일 삭제 완료: ${file.path}`);
          } catch (error) {
            this.logger.warn(`임시 파일 삭제 실패: ${file.path}, 에러: ${error.message}`);
          }
        }, 1000);
      } else {
        throw new BadRequestException('파일 데이터가 없습니다.');
      }

      // 2. 파일 크기 검증 (10MB 제한)
      if (file.size > this.config.limits.maxFileSize) {
        throw new BadRequestException(this.config.errorMessages.fileSizeTooLarge);
      }

      // 최소 파일 크기 검증 (빈 파일 방지)
      if (file.size < this.config.limits.minFileSize) {
        throw new BadRequestException(this.config.errorMessages.fileSizeTooSmall);
      }

      // 3. MIME 타입 검증 (화이트리스트 방식)
      if (!this.config.allowedMimeTypes.has(file.mimetype)) {
        throw new BadRequestException(this.config.errorMessages.invalidFileType);
      }

      // 4. 파일 확장자와 MIME 타입 일치 여부 검증
      const fileExt = extname(file.originalname).toLowerCase();
      const allowedExtensions = this.config.allowedMimeTypes.get(file.mimetype);

      if (!allowedExtensions || !allowedExtensions.includes(fileExt)) {
        throw new BadRequestException(this.config.errorMessages.mimeTypeMismatch);
      }

      // 5. 실제 파일 내용 검증 (매직 바이트 확인)
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

      const isValidSignature = this.verifyFileSignature(fileBuffer, fileType);
      if (!isValidSignature) {
        // 다른 이미지 형식인지 확인
        const imageTypes = ['jpg', 'png', 'gif', 'webp'];
        let isValidImage = false;

        for (const type of imageTypes) {
          if (type !== fileType && this.verifyFileSignature(fileBuffer, type)) {
            this.logger.warn(`파일 확장자는 ${fileExt}이지만 실제는 ${type} 형식입니다 - 파일: ${file.originalname}`);
            isValidImage = true;
            break;
          }
        }

        if (!isValidImage) {
          throw new BadRequestException(this.config.errorMessages.invalidSignature);
        }

        // 이미지 파일이 맞으면 계속 진행
        this.logger.log(`이미지 형식 불일치를 허용하고 계속 진행합니다.`);
      }

      // 6. 안전한 파일명 생성
      const safeFileName = `${crypto.randomBytes(16).toString('hex')}${fileExt}`;

      // 7. Google Cloud Storage에 업로드
      const publicUrl = await this.uploadToGoogleStorage(fileBuffer, safeFileName, file.mimetype);

      // 8. 파일 정보 데이터베이스에 저장
      const fileUpload = await this.prisma.fileUpload.create({
        data: {
          userId,
          originalName: file.originalname,
          filename: safeFileName,
          path: publicUrl, // Google Cloud Storage 공개 URL
          size: file.size,
          mimetype: file.mimetype,
          fileType: 'image',
          uploadCategory: relatedType || 'general',
        },
      });

      this.logger.log(`이미지 업로드 완료 - ID: ${fileUpload.id}, URL: ${publicUrl}`);

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
      this.logger.error(`이미지 업로드 중 오류 발생: ${error.message}`, error);
      throw error;
    }
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
      throw new NotFoundException('파일을 찾을 수 없습니다.');
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
   * 사용자의 업로드 파일 목록 조회
   */
  async getUserFiles(
    userId: number,
    relatedType?: string
  ): Promise<FileUploadResponseDto[]> {
    this.logger.log(`사용자 파일 목록 조회 - 사용자: ${userId}, 타입: ${relatedType || '전체'}`);

    const where: any = { userId };
    if (relatedType) {
      where.activityType = relatedType;
    }

    const files = await this.prisma.fileUpload.findMany({
      where,
      orderBy: { uploadedAt: 'desc' },
    });

    return files.map(file => ({
      id: file.id,
      filename: file.filename,
      originalName: file.originalName,
      mimeType: file.mimetype,
      size: file.size,
      path: file.path,
      uploadedAt: file.uploadedAt,
    }));
  }

  /**
   * 파일 삭제 (Google Cloud Storage)
   */
  async deleteFile(fileId: number, userId: number): Promise<void> {
    this.logger.log(`파일 삭제 요청 - ID: ${fileId}, 사용자: ${userId}`);

    const file = await this.prisma.fileUpload.findFirst({
      where: {
        id: fileId,
        userId,
      },
    });

    if (!file) {
      throw new NotFoundException('파일을 찾을 수 없거나 삭제 권한이 없습니다.');
    }

    // Google Cloud Storage에서 파일 삭제
    try {
      // URL에서 파일명 추출 (https://storage.googleapis.com/bucket-name/filename.ext)
      const urlParts = file.path.split('/');
      const fileName = urlParts[urlParts.length - 1];

      if (fileName) {
        const bucket = this.storage.bucket(this.bucketName);
        const gcsFile = bucket.file(fileName);

        await gcsFile.delete();
        this.logger.log(`Google Cloud Storage에서 파일 삭제 완료: ${fileName}`);
      }
    } catch (error) {
      this.logger.error('Google Cloud Storage에서 파일 삭제 실패', error);
      // 스토리지 삭제 실패는 무시하고 DB 기록은 삭제 진행
    }

    // 데이터베이스에서 삭제
    await this.prisma.fileUpload.delete({
      where: { id: fileId },
    });

    this.logger.log(`파일 삭제 완료 - ID: ${fileId}`);
  }
}