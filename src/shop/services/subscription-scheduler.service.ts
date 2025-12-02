import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { PrismaService } from '../../common/services/prisma.service';
import { SubscriptionService } from './subscription.service';
import { SubscriptionStatus } from '../../common/enums';

/**
 * 구독 자동결제 스케줄러
 *
 * 매일 자정(00:00)에 실행되어:
 * 1. 오늘 결제해야 할 ACTIVE 구독 찾기
 * 2. 각 구독마다 자동결제 실행
 * 3. 성공 시 다음 결제일 업데이트
 * 4. 실패 시 구독 상태를 PAYMENT_FAILED로 변경
 *
 * 00:01에 실행되어:
 * 1. CANCELED 상태이면서 nextBillingDate가 지난 구독을 EXPIRED로 전환
 */
@Injectable()
export class SubscriptionSchedulerService {
  private readonly logger = new Logger(SubscriptionSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly subscriptionService: SubscriptionService,
  ) {}

  /**
   * 매일 자정(00:00)에 자동결제 실행
   *
   * Cron 표현식: 0 0 * * * (초 분 시 일 월 요일)
   * - 0초, 0시, 매일, 매월, 매주
   *
   * NOTE: Kubernetes CronJob으로 실행됨. NestJS @Cron은 멀티 파드 환경에서 중복 실행 방지를 위해 비활성화.
   */
  // @Cron('0 0 * * *', {
  //   name: 'auto-billing',
  //   timeZone: 'Asia/Seoul',
  // })
  async handleAutoBilling() {
    this.logger.log('🕐 자동결제 스케줄러 시작...');

    const today = new Date();
    today.setHours(0, 0, 0, 0); // 오늘 00:00:00

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1); // 내일 00:00:00

    // 오늘 결제해야 할 구독 찾기
    const subscriptionsToCharge = await this.prisma.subscription.findMany({
      where: {
        status: SubscriptionStatus.ACTIVE,
        nextBillingDate: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        user: true,
        product: true,
      },
    });

    this.logger.log(
      `📋 오늘 처리할 자동결제: ${subscriptionsToCharge.length}건`,
    );

    if (subscriptionsToCharge.length === 0) {
      this.logger.log('처리할 자동결제가 없습니다.');
      return;
    }

    let successCount = 0;
    let failCount = 0;

    // 각 구독마다 자동결제 실행
    for (const subscription of subscriptionsToCharge) {
      try {
        this.logger.log(
          `처리 중: subscriptionId=${subscription.id}, 상품명=${subscription.product.name}, 사용자=${subscription.user.email}`,
        );

        await this.subscriptionService.processAutoBilling(subscription.id);

        successCount++;
      } catch (error: any) {
        this.logger.error(
          `자동결제 실패: subscriptionId=${subscription.id}, error=${error.message}`,
        );
        failCount++;
      }
    }

    this.logger.log(
      `✅ 자동결제 스케줄러 완료: 성공 ${successCount}건, 실패 ${failCount}건`,
    );
  }

  /**
   * 만료된 구독 정리 (매일 00:01)
   *
   * CANCELED 상태의 구독 중 nextBillingDate가 지난 것을 EXPIRED로 전환
   *
   * NOTE: Kubernetes CronJob으로 실행됨. NestJS @Cron은 멀티 파드 환경에서 중복 실행 방지를 위해 비활성화.
   */
  // @Cron('0 1 0 * * *', {
  //   name: 'expire-subscriptions',
  //   timeZone: 'Asia/Seoul',
  // })
  async handleExpiredSubscriptions() {
    this.logger.log('🕐 만료된 구독 정리 시작...');

    const now = new Date();

    // CANCELED 상태이면서 nextBillingDate가 지난 구독을 EXPIRED로 전환
    const expiredSubscriptions = await this.prisma.subscription.updateMany({
      where: {
        status: SubscriptionStatus.CANCELED,
        nextBillingDate: {
          lt: now,
        },
      },
      data: {
        status: SubscriptionStatus.EXPIRED,
        endDate: now,
        updatedAt: now,
      },
    });

    this.logger.log(
      `✅ 만료된 구독 정리 완료: ${expiredSubscriptions.count}건`,
    );
  }

  /**
   * 수동 실행용 (테스트)
   *
   * 형님이 테스트할 때 호출하면 즉시 자동결제 실행
   */
  async runManually() {
    this.logger.log('🧪 수동 실행 - 자동결제 스케줄러');
    await this.handleAutoBilling();
  }
}
