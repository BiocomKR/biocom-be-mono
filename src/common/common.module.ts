import { Module, Global } from '@nestjs/common';
import { PrismaService } from './services/prisma.service';
import { ConfigService } from './services/config.service';
import { LoggerService } from './services/logger.service';
import { GoogleStorageService } from './services/google-storage.service';

/**
 * 공통 모듈
 * 애플리케이션 전반에서 사용되는 공통 서비스와 기능 제공
 * 
 * @Global 데코레이터로 전역 모듈로 설정
 */
@Global()
@Module({
  controllers: [],
  providers: [
    PrismaService,
    ConfigService,
    LoggerService,
    GoogleStorageService,
  ],
  exports: [
    PrismaService,
    ConfigService,
    LoggerService,
    GoogleStorageService,
  ],
})
export class CommonModule {}