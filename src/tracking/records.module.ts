import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { RecordsController } from './controllers/records.controller';
import { RecordsService } from './services/records.service';
import { RecordAccessGuard } from './guards/record-access.guard';
import { RecordExtendedAccessGuard } from './guards/record-extended-access.guard';
import { PointModule } from '../point/point.module';
import { PrismaService } from '../common/services/prisma.service';

/**
 * 기록 모듈
 * 6가지 유형의 사용자 기록 관리 (이너뷰티, 식단, 영양제, 공복, 수면, 활동)
 *
 * 주요 기능:
 * - 구독사용자/챌린지활성자/과거챌린지구매자 권한 체크
 * - 피그마 화면에 맞는 기록 API 제공
 * - 기록 완료시 포인트 100점 자동 지급 (구독자/활성챌린저만)
 * - 외부 분석실 API 연동 (알러지 검사 결과 조회)
 */
@Module({
  imports: [
    PointModule,     // PointService 사용을 위해 import
    HttpModule,      // 외부 API 호출을 위해 import
  ],
  controllers: [RecordsController],
  providers: [RecordsService, RecordAccessGuard, RecordExtendedAccessGuard, PrismaService],
  exports: [RecordsService], // 다른 모듈에서 사용 가능하도록 export
})
export class RecordsModule {}