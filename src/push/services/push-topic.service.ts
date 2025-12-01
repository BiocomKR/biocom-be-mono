import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { FcmProvider } from '../providers/fcm.provider';
import { SubscribeTopicDto } from '../dto/subscribe-topic.dto';
import { UnsubscribeTopicDto } from '../dto/unsubscribe-topic.dto';
import { SendPushToTopicDto } from '../dto/send-push-to-topic.dto';

/**
 * 푸시 Topic 관리 서비스
 *
 * FCM Topic 구독/해제 및 Topic 기반 푸시 발송
 */
@Injectable()
export class PushTopicService {
  private readonly logger = new Logger(PushTopicService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly fcmProvider: FcmProvider,
  ) {}

  /**
   * Topic 구독
   *
   * @param userId - 유저 ID
   * @param dto - 구독 정보
   * @returns 구독 결과
   */
  async subscribeTopic(userId: number, dto: SubscribeTopicDto) {
    this.logger.log(
      `📌 [PushTopicService] Topic 구독 시작: userId=${userId}, topic=${dto.topic}`,
    );

    // 1. 토큰 가져오기 (제공된 토큰 또는 유저의 모든 활성 토큰)
    const tokens = dto.tokens && dto.tokens.length > 0
      ? dto.tokens
      : await this.getUserActiveTokens(userId);

    if (tokens.length === 0) {
      this.logger.warn(
        `⚠️ [PushTopicService] 활성 토큰 없음: userId=${userId}`,
      );
      return {
        success: false,
        message: '활성화된 푸시 토큰이 없습니다',
      };
    }

    // 2. FCM Topic 구독
    const success = await this.fcmProvider.subscribeToTopic(tokens, dto.topic);

    this.logger.log(
      `✅ [PushTopicService] Topic 구독 완료: topic=${dto.topic}, success=${success}`,
    );

    return {
      success,
      message: success
        ? `${dto.topic} 토픽에 구독되었습니다`
        : '토픽 구독에 실패했습니다',
    };
  }

  /**
   * Topic 구독 해제
   *
   * @param userId - 유저 ID
   * @param dto - 구독 해제 정보
   * @returns 구독 해제 결과
   */
  async unsubscribeTopic(userId: number, dto: UnsubscribeTopicDto) {
    this.logger.log(
      `🔕 [PushTopicService] Topic 구독 해제 시작: userId=${userId}, topic=${dto.topic}`,
    );

    // 1. 토큰 가져오기
    const tokens = dto.tokens && dto.tokens.length > 0
      ? dto.tokens
      : await this.getUserActiveTokens(userId);

    if (tokens.length === 0) {
      this.logger.warn(
        `⚠️ [PushTopicService] 활성 토큰 없음: userId=${userId}`,
      );
      return {
        success: false,
        message: '활성화된 푸시 토큰이 없습니다',
      };
    }

    // 2. FCM Topic 구독 해제
    const success = await this.fcmProvider.unsubscribeFromTopic(tokens, dto.topic);

    this.logger.log(
      `✅ [PushTopicService] Topic 구독 해제 완료: topic=${dto.topic}, success=${success}`,
    );

    return {
      success,
      message: success
        ? `${dto.topic} 토픽 구독이 해제되었습니다`
        : '토픽 구독 해제에 실패했습니다',
    };
  }

  /**
   * Topic으로 푸시 전송
   *
   * @param dto - Topic 푸시 정보
   * @returns 전송 결과
   */
  async sendToTopic(dto: SendPushToTopicDto) {
    this.logger.log(
      `📣 [PushTopicService] Topic 푸시 전송: topic=${dto.topic}, title="${dto.title}"`,
    );

    const result = await this.fcmProvider.sendToTopic(dto.topic, {
      title: dto.title,
      body: dto.body,
      imageUrl: dto.imageUrl,
      data: dto.data,
    });

    this.logger.log(
      `✅ [PushTopicService] Topic 푸시 전송 완료: success=${result.success}`,
    );

    return {
      success: result.success,
      message: result.success
        ? `${dto.topic} 토픽으로 푸시가 전송되었습니다`
        : '푸시 전송에 실패했습니다',
      messageId: result.messageId,
      errorCode: result.errorCode,
      errorMessage: result.errorMessage,
    };
  }

  /**
   * 유저의 활성 토큰 조회 (private)
   *
   * @param userId - 유저 ID
   * @returns FCM 토큰 배열
   * @private
   */
  private async getUserActiveTokens(userId: number): Promise<string[]> {
    const pushTokens = await this.prisma.pushToken.findMany({
      where: {
        userId,
        isActive: true,
        provider: 'FCM',
      },
      select: {
        token: true,
      },
    });

    return pushTokens.map((pt) => pt.token);
  }
}
