import { Module } from '@nestjs/common';
import { PointController } from './point.controller';
import { PointService } from './point.service';

/**
 * 포인트 모듈
 * 포인트 관련 기능을 제공하는 모듈
 */
@Module({
  controllers: [PointController],
  providers: [PointService],
  exports: [PointService],
})
export class PointModule {}