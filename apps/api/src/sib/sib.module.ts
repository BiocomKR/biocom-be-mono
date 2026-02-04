import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { SibApiService } from './services/sib-api.service';
import { SibHealthService } from './services/sib-health.service';
import { SibHealthSchedulerService } from './services/sib-health-scheduler.service';
import { PrismaService } from '../common/services/prisma.service';

/**
 * SIB 검사 데이터 모듈
 * - 외부 API (sib.codns.com:3001) 연동
 * - 전화번호로 차트 ID 조회
 * - 지연성 알러지, 종합대사기능 등 검사 결과 조회
 * - DB 캐싱: user_allergy_reports 테이블 활용
 * - SIB API 헬스체크 (K8s CronJob)
 */
@Module({
  imports: [
    HttpModule.register({
      timeout: 10000,
      maxRedirects: 5,
    }),
  ],
  providers: [
    SibApiService,
    SibHealthService,
    SibHealthSchedulerService,
    PrismaService,
  ],
  exports: [SibApiService, SibHealthService, SibHealthSchedulerService],
})
export class SibModule {}
