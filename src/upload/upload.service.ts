import { Injectable, Logger, BadRequestException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { FileUploadResponseDto } from './dto/file-upload-response.dto';
import { promises as fs } from 'fs';
import { join, extname, basename } from 'path';
import * as crypto from 'crypto';
import { UploadSecurityConfig } from './upload.security.config';

/**
 * 파일 업로드 서비스
 * 활동 기록과 연관된 이미지 파일 업로드를 관리
 */
@Injectable()
export class UploadService {
  private readonly logger = new Logger(UploadService.name);
  private readonly uploadPath: string;
  private readonly config = UploadSecurityConfig;

  constructor(private readonly prisma: PrismaService) {
    // Google Cloud Storage 사용으로 로컬 업로드 경로 설정 불필요
    this.uploadPath = ''; // 더 이상 사용하지 않음
    this.logger.log('Google Cloud Storage 업로드 전용 서비스로 구성됨');
  }

  // Google Cloud Storage 사용으로 로컬 디렉토리 생성 함수 제거됨

  /**
   * 파일의 매직 바이트를 확인하여 실제 파일 타입 검증
   */
  private async verifyFileSignature(filePath: string, expectedType: string): Promise<boolean> {
    try {
      const fileBuffer = await fs.readFile(filePath);
      
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
   * 이미지 파일 업로드 및 기록
   */
  async uploadImage(
    userId: number,
    file: Express.Multer.File,
    relatedType: string
  ): Promise<FileUploadResponseDto> {
    this.logger.log(`이미지 업로드 시작 - 사용자: ${userId}, 파일: ${file.originalname}`);

    try {
      // 1. 파일 존재 여부 확인
      if (!file || !file.filename) {
        throw new BadRequestException(this.config.errorMessages.fileNotFound);
      }

      // 2. 파일명 보안 검증
      this.validateFileName(file.originalname);

      // 3. 파일 크기 검증 (10MB 제한)
      if (file.size > this.config.limits.maxFileSize) {
        throw new BadRequestException(this.config.errorMessages.fileSizeTooLarge);
      }

      // 최소 파일 크기 검증 (빈 파일 방지)
      if (file.size < this.config.limits.minFileSize) {
        throw new BadRequestException(this.config.errorMessages.fileSizeTooSmall);
      }

      // 4. MIME 타입 검증 (화이트리스트 방식)
      if (!this.config.allowedMimeTypes.has(file.mimetype)) {
        throw new BadRequestException(this.config.errorMessages.invalidFileType);
      }

      // 5. 파일 확장자와 MIME 타입 일치 여부 검증
      const fileExt = extname(file.originalname).toLowerCase();
      const allowedExtensions = this.config.allowedMimeTypes.get(file.mimetype);
      
      if (!allowedExtensions || !allowedExtensions.includes(fileExt)) {
        throw new BadRequestException(this.config.errorMessages.mimeTypeMismatch);
      }

      // 6. 실제 파일 내용 검증 (매직 바이트 확인)
      const filePath = join(this.uploadPath, file.filename);
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

      const isValidSignature = await this.verifyFileSignature(filePath, fileType);
      if (!isValidSignature) {
        // 다른 이미지 형식인지 확인
        const imageTypes = ['jpg', 'png', 'gif', 'webp'];
        let isValidImage = false;
        
        for (const type of imageTypes) {
          if (type !== fileType && await this.verifyFileSignature(filePath, type)) {
            this.logger.warn(`파일 확장자는 ${fileExt}이지만 실제는 ${type} 형식입니다 - 파일: ${file.originalname}`);
            isValidImage = true;
            break;
          }
        }
        
        if (!isValidImage) {
          // 어떤 이미지 형식도 아니면 거부
          await fs.unlink(filePath);
          throw new BadRequestException(this.config.errorMessages.invalidSignature);
        }
        
        // 이미지 파일이 맞으면 계속 진행
        this.logger.log(`이미지 형식 불일치를 허용하고 계속 진행합니다.`);
      }

      // 7. 안전한 파일명 생성 (원본 파일명은 DB에만 저장)
      const safeFileName = `${crypto.randomBytes(16).toString('hex')}${fileExt}`;
      const safePath = join(this.uploadPath, safeFileName);

      // 8. 파일을 안전한 이름으로 변경
      await fs.rename(filePath, safePath);

      // 9. 파일 정보 데이터베이스에 저장
      const fileUpload = await this.prisma.fileUpload.create({
        data: {
          userId,
          originalName: file.originalname, // 원본 파일명은 DB에만 저장
          filename: safeFileName,
          path: `/uploads/${safeFileName}`, // 안전한 파일명으로 저장
          size: file.size,
          mimetype: file.mimetype,
          fileType: 'image',
          uploadCategory: relatedType || 'general',
        },
      });

      this.logger.log(`이미지 업로드 완료 - ID: ${fileUpload.id}, 경로: ${fileUpload.path}`);

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
      
      // 업로드된 파일 삭제 (에러 발생 시)
      if (file && file.filename) {
        try {
          const filePath = join(this.uploadPath, file.filename);
          await fs.access(filePath); // 파일 존재 확인
          await fs.unlink(filePath);
          this.logger.log(`에러로 인한 파일 삭제 완료: ${file.filename}`);
        } catch (unlinkError) {
          this.logger.error('업로드 파일 삭제 실패', unlinkError);
        }
      }
      
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
   * 파일 삭제
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

    // 파일 시스템에서 삭제
    try {
      const filename = basename(file.path);
      if (filename) {
        // 안전한 파일명 검증 (해시 형식인지 확인)
        if (!this.config.safeFileNamePattern.test(filename)) {
          this.logger.warn(`안전하지 않은 파일명 패턴 감지: ${filename}`);
          throw new BadRequestException('파일 삭제 중 오류가 발생했습니다.');
        }
        
        const filePath = join(this.uploadPath, filename);
        
        // 경로 순회 공격 방지
        const resolvedPath = await fs.realpath(filePath);
        const uploadDirPath = await fs.realpath(this.uploadPath);
        
        if (!resolvedPath.startsWith(uploadDirPath)) {
          this.logger.error(`경로 순회 시도 감지: ${resolvedPath}`);
          throw new BadRequestException('파일 삭제 중 보안 오류가 발생했습니다.');
        }
        
        await fs.unlink(resolvedPath);
        this.logger.log(`파일 시스템에서 파일 삭제 완료: ${filename}`);
      }
    } catch (error) {
      this.logger.error('파일 시스템에서 파일 삭제 실패', error);
      // 파일 시스템 삭제 실패는 무시하고 DB 기록은 삭제 진행
    }

    // 데이터베이스에서 삭제
    await this.prisma.fileUpload.delete({
      where: { id: fileId },
    });

    this.logger.log(`파일 삭제 완료 - ID: ${fileId}`);
  }
}