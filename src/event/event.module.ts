import { Module } from '@nestjs/common';
import { EventService } from './event.service';
import { EventManagementService } from './event-management.service';
import { EventController } from './event.controller';
import { CommonModule } from '../common/common.module';

/**
 * 이벤트 관리 모듈
 * 챌린지, 프로모션, 캠페인 등 모든 기간 기반 이벤트 관리
 */
@Module({
  imports: [CommonModule],
  controllers: [EventController],
  providers: [EventService, EventManagementService],
  exports: [EventService, EventManagementService],
})
export class EventModule {}