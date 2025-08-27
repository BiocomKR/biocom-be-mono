import { Module } from '@nestjs/common';
import { MulterModule } from '@nestjs/platform-express';
import { diskStorage } from 'multer';
import { extname, basename } from 'path';
import { UploadController } from './upload.controller';
import { UploadService } from './upload.service';
import { BadRequestException } from '@nestjs/common';
import { UploadSecurityConfig } from './upload.security.config';

@Module({
  imports: [
    MulterModule.register({
      storage: diskStorage({
        destination: process.env.UPLOAD_PATH || './uploads',
        filename: (req, file, callback) => {
          // 보안 강화: 파일명 sanitization
          const originalName = file.originalname;
          
          // 파일명에서 위험한 문자 제거
          const sanitizedName = basename(originalName).replace(/[^a-zA-Z0-9.-]/g, '_');
          
          // 확장자 추출 및 검증
          const ext = extname(sanitizedName).toLowerCase();
          
          // 허용된 확장자 재확인
          if (!UploadSecurityConfig.allowedExtensions.includes(ext)) {
            return callback(new BadRequestException(UploadSecurityConfig.errorMessages.invalidExtension), null);
          }
          
          // 유니크한 파일명 생성
          const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1e9);
          const filename = `image-${uniqueSuffix}${ext}`;
          callback(null, filename);
        },
      }),
      fileFilter: (req, file, callback) => {
        // 1. MIME 타입 검증 (엄격한 화이트리스트)
        if (!UploadSecurityConfig.allowedMimeTypes.has(file.mimetype)) {
          return callback(
            new BadRequestException(UploadSecurityConfig.errorMessages.invalidFileType),
            false
          );
        }
        
        // 2. 파일 확장자 검증
        const fileExt = extname(file.originalname).toLowerCase();
        
        if (!UploadSecurityConfig.allowedExtensions.includes(fileExt)) {
          return callback(
            new BadRequestException(UploadSecurityConfig.errorMessages.invalidExtension),
            false
          );
        }
        
        // 3. 이중 확장자 검증 (예: .jpg.php)
        const filename = basename(file.originalname);
        const extensionCount = (filename.match(/\./g) || []).length;
        
        if (extensionCount > 1) {
          // 파일명에 점이 여러 개 있는 경우 추가 검증
          const parts = filename.split('.');
          // 마지막 확장자만 허용하고, 그 이전의 부분들은 위험한 확장자가 아닌지 확인
          const dangerousExtensions = UploadSecurityConfig.dangerousExtensions;
          
          for (let i = 0; i < parts.length - 1; i++) {
            if (dangerousExtensions.includes(parts[i].toLowerCase())) {
              return callback(
                new BadRequestException(UploadSecurityConfig.errorMessages.doubleExtension),
                false
              );
            }
          }
        }
        
        // 4. 파일명 길이 제한
        if (file.originalname.length > UploadSecurityConfig.limits.maxFileNameLength) {
          return callback(
            new BadRequestException(UploadSecurityConfig.errorMessages.fileNameTooLong),
            false
          );
        }
        
        // 5. Null 바이트 인젝션 방지
        if (file.originalname.includes('\0')) {
          return callback(
            new BadRequestException(UploadSecurityConfig.errorMessages.invalidFileName),
            false
          );
        }
        
        callback(null, true);
      },
      limits: {
        fileSize: UploadSecurityConfig.limits.maxFileSize,
        files: UploadSecurityConfig.limits.maxFiles,
        fieldNameSize: UploadSecurityConfig.limits.maxFieldNameSize,
        fieldSize: UploadSecurityConfig.limits.maxFieldSize,
      },
    }),
  ],
  controllers: [UploadController],
  providers: [UploadService],
  exports: [UploadService],
})
export class UploadModule {}