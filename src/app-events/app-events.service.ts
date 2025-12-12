import { Injectable, Logger } from '@nestjs/common';
import { CreateAppEventDto } from './dto/create-app-event.dto';
import { QueueService } from '../queues/queue.service';

/**
 * 앱 이벤트 서비스
 *
 * 앱에서 발생하는 이벤트를 MQ로 전송 (비동기 처리)
 */
@Injectable()
export class AppEventsService {
  private readonly logger = new Logger(AppEventsService.name);

  constructor(private readonly queueService: QueueService) {}

  /**
   * 앱 이벤트를 Queue에 추가 (비동기 처리)
   */
  async create(dto: CreateAppEventDto) {
    try {
      const job = await this.queueService.addAppEvent({
        appId: dto.appId,
        eventName: dto.eventName,
        eventCategory: dto.eventCategory,
        userId: dto.userId,
        sessionId: dto.sessionId,
        platform: dto.platform,
        itemId: dto.itemId,
        itemType: dto.itemType,
        amount: dto.amount,
        quantity: dto.quantity,
        params: dto.params,
      });

      this.logger.debug(
        `📊 [AppEvents] Queue 추가: ${dto.eventName} (jobId=${job.id}, userId=${dto.userId}, platform=${dto.platform})`,
      );

      return { id: job.id };
    } catch (error) {
      this.logger.error(`❌ [AppEvents] Queue 추가 실패: ${error.message}`);
      throw error;
    }
  }
}
