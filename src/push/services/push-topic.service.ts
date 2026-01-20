import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { IPushProvider, PUSH_PROVIDER_TOKEN } from '../interfaces/push-provider.interface';
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
    @Inject(PUSH_PROVIDER_TOKEN) private readonly pushProvider: IPushProvider,
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

    // 1. 토큰 및 bundleId 가져오기
    const tokenData = dto.tokens && dto.tokens.length > 0
      ? dto.tokens.map((t) => ({ token: t, bundleId: null }))
      : await this.getUserActiveTokensWithBundleId(userId);

    if (tokenData.length === 0) {
      this.logger.warn(
        `⚠️ [PushTopicService] 활성 토큰 없음: userId=${userId}`,
      );
      return {
        success: false,
        message: '활성화된 푸시 토큰이 없습니다',
      };
    }

    // 2. bundleId별로 그룹핑하여 FCM Topic 구독
    const groupedByBundle = this.groupTokensByBundleId(tokenData);
    let totalSuccess = 0;

    for (const [bundleId, tokens] of groupedByBundle) {
      const success = await this.pushProvider.subscribeToTopic(tokens, dto.topic, bundleId || undefined);
      if (success) totalSuccess++;
    }

    const overallSuccess = totalSuccess > 0;

    this.logger.log(
      `✅ [PushTopicService] Topic 구독 완료: topic=${dto.topic}, success=${overallSuccess}`,
    );

    return {
      success: overallSuccess,
      message: overallSuccess
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

    // 1. 토큰 및 bundleId 가져오기
    const tokenData = dto.tokens && dto.tokens.length > 0
      ? dto.tokens.map((t) => ({ token: t, bundleId: null }))
      : await this.getUserActiveTokensWithBundleId(userId);

    if (tokenData.length === 0) {
      this.logger.warn(
        `⚠️ [PushTopicService] 활성 토큰 없음: userId=${userId}`,
      );
      return {
        success: false,
        message: '활성화된 푸시 토큰이 없습니다',
      };
    }

    // 2. bundleId별로 그룹핑하여 FCM Topic 구독 해제
    const groupedByBundle = this.groupTokensByBundleId(tokenData);
    let totalSuccess = 0;

    for (const [bundleId, tokens] of groupedByBundle) {
      const success = await this.pushProvider.unsubscribeFromTopic(tokens, dto.topic, bundleId || undefined);
      if (success) totalSuccess++;
    }

    const overallSuccess = totalSuccess > 0;

    this.logger.log(
      `✅ [PushTopicService] Topic 구독 해제 완료: topic=${dto.topic}, success=${overallSuccess}`,
    );

    return {
      success: overallSuccess,
      message: overallSuccess
        ? `${dto.topic} 토픽 구독이 해제되었습니다`
        : '토픽 구독 해제에 실패했습니다',
    };
  }

  /**
   * Topic으로 푸시 전송
   * bundleId 파라미터로 특정 Firebase 앱에만 발송 가능
   *
   * @param dto - Topic 푸시 정보
   * @returns 전송 결과
   */
  async sendToTopic(dto: SendPushToTopicDto) {
    this.logger.log(
      `📣 [PushTopicService] Topic 푸시 전송: topic=${dto.topic}, title="${dto.title}", bundleId=${dto.bundleId}`,
    );

    const result = await this.pushProvider.sendToTopic(
      dto.topic,
      {
        title: dto.title,
        body: dto.body,
        imageUrl: dto.imageUrl,
        data: dto.data,
      },
      dto.bundleId,
    );

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
   * 유저의 활성 토큰 조회 (bundleId 포함)
   */
  private async getUserActiveTokensWithBundleId(userId: number): Promise<{ token: string; bundleId: string | null }[]> {
    const pushTokens = await this.prisma.pushToken.findMany({
      where: {
        userId,
        isActive: true,
        provider: 'FCM',
      },
      select: {
        token: true,
        bundleId: true,
      },
    });

    return pushTokens;
  }

  /**
   * 토큰을 bundleId별로 그룹핑
   */
  private groupTokensByBundleId(
    tokenData: { token: string; bundleId: string | null }[],
  ): Map<string | null, string[]> {
    const grouped = new Map<string | null, string[]>();

    tokenData.forEach(({ token, bundleId }) => {
      if (!grouped.has(bundleId)) {
        grouped.set(bundleId, []);
      }
      grouped.get(bundleId)!.push(token);
    });

    return grouped;
  }
}
