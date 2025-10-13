import { Module } from '@nestjs/common';
import { PointController } from './point.controller';
import { PointService } from './point.service';
import { PrismaService } from '../common/services/prisma.service';

/**
 * 포인트 모듈
 * 포인트 관련 기능을 제공하는 모듈
 */
@Module({
  controllers: [PointController],
  providers: [PointService, PrismaService],
  exports: [PointService], // 다른 모듈에서 PointService 사용 가능하도록 export
})
export class PointModule {}