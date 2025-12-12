import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { getNowKST } from '../../common/utils/kst-date.util';
import {
  ILogisticsProvider,
  LOGISTICS_PROVIDER_TOKEN,
  LogisticsOrdersListItem,
} from '../interfaces/logistics-provider.interface';
import { SYNC_TARGET_STATUSES } from '../enums/playauto-status.enum';
import { QueueService } from '../../queues/queue.service';

/**
 * 배송 상태 동기화 스케줄러
 *
 * ⚠️ Kubernetes CronJob 전용 - @Cron 데코레이터 사용 금지!
 * 실행 방법: node dist/main.js --run-scheduler sync-shipping-status
 * 실행 주기: K8s CronJob으로 30분마다 실행
 *
 * 동작:
 * 1. 플레이오토 벌크 API로 주문 리스트 조회 (1회 API 호출)
 * 2. DB 주문과 매칭하여 MQ Job으로 개별 주문 업데이트 분산 처리
 * 3. biocom-mq 워커가 송장번호, 택배사, 배송상태 DB 업데이트
 */
@Injectable()
export class ShippingSyncSchedulerService {
  private readonly logger = new Logger(ShippingSyncSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(LOGISTICS_PROVIDER_TOKEN)
    private readonly logisticsProvider: ILogisticsProvider,
    private readonly queueService: QueueService,
  ) {}

  /**
   * 배송 상태 동기화 배치 실행 (벌크 조회 방식)
   */
  async handleShippingSync() {
    this.logger.log('🕐 배송 상태 동기화 배치 시작...');

    const startTime = Date.now();

    try {
      // 1. 동기화 대상 주문 조회 (DB)
      const orders = await this.prisma.order.findMany({
        where: {
          logisticsUniq: { not: null },
          status: {
            notIn: ['COMPLETED', 'CANCELLED', 'RETURNED', 'EXCHANGED', 'PENDING_PAYMENT'],
          },
        },
        include: {
          shipping: true,
        },
      });

      this.logger.log(`📋 동기화 대상 주문: ${orders.length}건`);

      if (orders.length === 0) {
        this.logger.log('동기화할 주문이 없습니다.');
        return;
      }

      // 2. 플레이오토 벌크 조회 (최근 30일, 진행중 상태만)
      const now = getNowKST();
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      const sdate = thirtyDaysAgo.toISOString().split('T')[0];
      const edate = now.toISOString().split('T')[0];

      const playautoResult = await this.logisticsProvider.getOrdersList({
        sdate,
        edate,
        dateType: 'mdate',
        status: SYNC_TARGET_STATUSES,
        length: 3000,
      });

      this.logger.log(`📦 플레이오토 조회 결과: ${playautoResult.orders.length}건`);

      // 3. uniq 기준으로 Map 생성
      const playautoOrderMap = new Map<string, LogisticsOrdersListItem>();
      for (const playautoOrder of playautoResult.orders) {
        playautoOrderMap.set(playautoOrder.uniq, playautoOrder);
      }

      let queuedCount = 0;
      let skipCount = 0;

      // 4. 각 주문별로 매칭하여 MQ Job 전송
      for (const order of orders) {
        const playautoOrder = playautoOrderMap.get(order.logisticsUniq);

        if (!playautoOrder) {
          this.logger.warn(`플레이오토에서 주문 찾지 못함: uniq=${order.logisticsUniq}`);
          skipCount++;
          continue;
        }

        // MQ Job으로 전송 (개별 주문 업데이트는 biocom-mq가 처리)
        await this.queueService.addOrderSync(order.id, {
          status: playautoOrder.status,
          carrier: playautoOrder.carrier,
          trackingNumber: playautoOrder.trackingNumber,
        });
        queuedCount++;
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ 배송 상태 동기화 Job 전송 완료: 큐 전송 ${queuedCount}건, 스킵 ${skipCount}건 (${duration}ms)`,
      );
    } catch (error: any) {
      this.logger.error(`배송 상태 동기화 배치 실패: ${error.message}`);
      throw error;
    }
  }
}
