import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { CreateAppEventDto } from './dto/create-app-event.dto';
import { getNowKST } from '../common/utils/kst-date.util';
import { Decimal } from '@prisma/client/runtime/library';

/**
 * 앱 이벤트 서비스
 *
 * 앱에서 발생하는 이벤트를 DB에 저장
 */
@Injectable()
export class AppEventsService {
  private readonly logger = new Logger(AppEventsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 앱 이벤트 저장
   */
  async create(dto: CreateAppEventDto) {
    try {
      const event = await this.prisma.appEvent.create({
        data: {
          appId: dto.appId || 'challenge',
          eventName: dto.eventName,
          eventCategory: dto.eventCategory,
          userId: dto.userId,
          sessionId: dto.sessionId,
          platform: dto.platform,
          itemId: dto.itemId,
          itemType: dto.itemType,
          amount: dto.amount ? new Decimal(dto.amount) : null,
          quantity: dto.quantity,
          params: dto.params || {},
          createdAt: getNowKST(),
        },
      });

      this.logger.debug(
        `📊 [AppEvents] 이벤트 저장: ${dto.eventName} (appId=${dto.appId || 'challenge'}, category=${dto.eventCategory}, userId=${dto.userId}, platform=${dto.platform})`,
      );

      return event;
    } catch (error) {
      this.logger.error(`❌ [AppEvents] 이벤트 저장 실패: ${error.message}`);
      throw error;
    }
  }
}
