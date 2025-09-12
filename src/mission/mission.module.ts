import { Module } from '@nestjs/common';
import { CommonModule } from '../common/common.module';
import { PointModule } from '../point/point.module';
import { MissionService } from './mission.service';
import { MissionController } from './mission.controller';
import { MissionCompletionService } from './mission-completion.service';
import { RecordCompletionService } from './record-completion.service';

/**
 * 미션 모듈
 * 미션 마스터 데이터 관리 및 사용자 미션 수행
 */
@Module({
  imports: [CommonModule, PointModule],
  controllers: [MissionController],
  providers: [MissionService, MissionCompletionService, RecordCompletionService],
  exports: [MissionService],
})
export class MissionModule {}