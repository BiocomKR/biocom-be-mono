import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { CreateAppEventDto } from './dto/create-app-event.dto';

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
          eventName: dto.eventName,
          userId: dto.userId,
          platform: dto.platform,
          params: dto.params || {},
        },
      });

      this.logger.debug(
        `📊 [AppEvents] 이벤트 저장: ${dto.eventName} (userId=${dto.userId}, platform=${dto.platform})`,
      );

      return event;
    } catch (error) {
      this.logger.error(`❌ [AppEvents] 이벤트 저장 실패: ${error.message}`);
      throw error;
    }
  }
}
