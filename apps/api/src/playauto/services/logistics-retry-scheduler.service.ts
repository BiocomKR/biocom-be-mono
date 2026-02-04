import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { getNowKST } from '../../common/utils/kst-date.util';
import {
  ILogisticsProvider,
  LOGISTICS_PROVIDER_TOKEN,
} from '../interfaces/logistics-provider.interface';
import { CryptoUtil } from '../../common/utils/crypto.util';
import { OrderStatus } from '../../common/enums';

/**
 * 물류 주문 생성 재시도 스케줄러
 *
 * ⚠️ Kubernetes CronJob 전용 - @Cron 데코레이터 사용 금지!
 * 실행 방법: node dist/main.js --run-scheduler retry-logistics
 * 실행 주기: K8s CronJob으로 30분마다 실행
 *
 * 동작:
 * 1. PAID 상태이면서 logisticsUniq가 NULL인 주문 조회
 * 2. 각 주문에 대해 플레이오토 주문 생성 재시도
 * 3. 성공/실패 로깅
 *
 * 대상 조건:
 * - Order.status = 'PAID'
 * - Order.logisticsUniq IS NULL
 * - Order.paidAt이 최근 7일 이내 (너무 오래된 주문은 제외)
 */
@Injectable()
export class LogisticsRetrySchedulerService {
  private readonly logger = new Logger(LogisticsRetrySchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(LOGISTICS_PROVIDER_TOKEN)
    private readonly logisticsProvider: ILogisticsProvider,
  ) {}

  /**
   * 물류 주문 생성 재시도 배치 실행
   */
  async handleLogisticsRetry() {
    this.logger.log('🔄 물류 주문 생성 재시도 배치 시작...');

    const startTime = Date.now();

    try {
      // 최근 7일 기준
      const now = getNowKST();
      const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);

      // 1. 물류 미등록 PAID 주문 조회
      const orders = await this.prisma.order.findMany({
        where: {
          status: OrderStatus.PAID,
          logisticsUniq: null,
          paidAt: {
            gte: sevenDaysAgo,
          },
        },
        include: {
          items: {
            include: {
              product: true,
            },
          },
        },
        orderBy: {
          paidAt: 'asc', // 오래된 것부터 처리
        },
        take: 100, // 한 번에 최대 100건
      });

      this.logger.log(`📋 물류 미등록 주문: ${orders.length}건`);

      if (orders.length === 0) {
        this.logger.log('재시도할 주문이 없습니다.');
        return;
      }

      let successCount = 0;
      let failCount = 0;

      // 2. 각 주문별로 플레이오토 주문 생성 시도
      for (const order of orders) {
        try {
          await this.createPlayautoOrder(order);
          successCount++;
        } catch (error: any) {
          this.logger.error(
            `물류 재시도 실패: orderId=${order.id}, error=${error.message}`,
          );
          failCount++;
        }
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ 물류 재시도 배치 완료: 성공 ${successCount}건, 실패 ${failCount}건 (${duration}ms)`,
      );

      // 실패 건이 있으면 알림 (TODO: 슬랙 연동)
      if (failCount > 0) {
        this.logger.warn(
          `⚠️ 물류 등록 실패 ${failCount}건 발생 - 수동 확인 필요`,
        );
      }
    } catch (error: any) {
      this.logger.error(`물류 재시도 배치 실패: ${error.message}`);
      throw error;
    }
  }

  /**
   * 플레이오토 주문 생성
   */
  private async createPlayautoOrder(order: any): Promise<void> {
    const orderId = order.id;

    this.logger.log(`플레이오토 주문 생성 시도: orderId=${orderId}, orderNumber=${order.orderNumber}`);

    // 이미 물류 등록된 주문인지 다시 확인 (동시 실행 방지)
    const currentOrder = await this.prisma.order.findUnique({
      where: { id: orderId },
      select: { logisticsUniq: true },
    });

    if (currentOrder?.logisticsUniq) {
      this.logger.warn(
        `이미 물류 등록된 주문입니다: orderId=${orderId}, uniq=${currentOrder.logisticsUniq}`,
      );
      return;
    }

    // 개인정보 복호화
    const decryptedOrder = {
      ...order,
      recipientName: CryptoUtil.decrypt(order.recipientName),
      recipientMobile: CryptoUtil.decrypt(order.recipientMobile),
      address: CryptoUtil.decrypt(order.address),
      addressDetail: order.addressDetail ? CryptoUtil.decrypt(order.addressDetail) : null,
      deliveryMessage: order.deliveryMessage ? CryptoUtil.decrypt(order.deliveryMessage) : null,
    };

    // 물류 서비스 주문 생성 (Provider 내부에서 3회 재시도 + 로그 기록)
    const { uniq, bundleNo } = await this.logisticsProvider.createOrder(decryptedOrder);

    // DB에 provider, uniq, bundleNo 저장
    await this.prisma.order.update({
      where: { id: orderId },
      data: {
        logisticsProvider: this.logisticsProvider.name,
        logisticsUniq: uniq,
        logisticsBundleNo: bundleNo,
      },
    });

    this.logger.log(
      `물류 주문 생성 완료 (재시도): orderId=${orderId}, provider=${this.logisticsProvider.name}, uniq=${uniq}, bundleNo=${bundleNo}`,
    );
  }
}
