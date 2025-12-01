import { Module, Global } from '@nestjs/common';
import { WinstonModule } from 'nest-winston';
import { winstonConfig } from '../config/winston.config';
import { LoggerService } from '../services/logger.service';

/**
 * Logger 모듈
 * Winston 기반의 로깅 시스템을 제공하는 글로벌 모듈
 * 
 * 특징:
 * - 외부 디렉토리에 로그 파일 저장
 * - 일별 로그 로테이션
 * - 구조화된 로그 형식
 * - 전역 사용 가능
 */
@Global()
@Module({
  imports: [
    WinstonModule.forRoot(winstonConfig),
  ],
  providers: [LoggerService],
  exports: [LoggerService],
})
export class LoggerModule {}