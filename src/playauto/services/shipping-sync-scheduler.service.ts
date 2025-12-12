import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { getNowKST } from '../../common/utils/kst-date.util';
import {
  ILogisticsProvider,
  LOGISTICS_PROVIDER_TOKEN,
  LogisticsOrdersListItem,
} from '../interfaces/logistics-provider.interface';
import {
  PlayautoOrderStatus,
  SYNC_TARGET_STATUSES,
  PLAYAUTO_STATUS_MAP,
} from '../enums/playauto-status.enum';

/**
 * 배송 상태 동기화 스케줄러
 *
 * ⚠️ Kubernetes CronJob 전용 - @Cron 데코레이터 사용 금지!
 * 실행 방법: node dist/main.js --run-scheduler sync-shipping-status
 * 실행 주기: K8s CronJob으로 30분마다 실행
 *
 * 동작:
 * 1. 플레이오토 벌크 API로 주문 리스트 조회 (1회 API 호출)
 * 2. DB 주문과 매칭하여 변경된 주문만 업데이트
 * 3. 송장번호, 택배사, 배송상태 DB 업데이트
 */
@Injectable()
export class ShippingSyncSchedulerService {
  private readonly logger = new Logger(ShippingSyncSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(LOGISTICS_PROVIDER_TOKEN)
    private readonly logisticsProvider: ILogisticsProvider,
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

      let successCount = 0;
      let failCount = 0;
      let skipCount = 0;

      // 4. 각 주문별로 매칭 및 업데이트
      for (const order of orders) {
        try {
          const playautoOrder = playautoOrderMap.get(order.logisticsUniq);

          if (!playautoOrder) {
            this.logger.warn(`플레이오토에서 주문 찾지 못함: uniq=${order.logisticsUniq}`);
            skipCount++;
            continue;
          }

          const result = await this.syncOrderStatus(order, playautoOrder);
          if (result === 'updated') {
            successCount++;
          } else if (result === 'skipped') {
            skipCount++;
          }
        } catch (error: any) {
          this.logger.error(
            `주문 동기화 실패: orderId=${order.id}, error=${error.message}`,
          );
          failCount++;
        }
      }

      const duration = Date.now() - startTime;
      this.logger.log(
        `✅ 배송 상태 동기화 완료: 성공 ${successCount}건, 스킵 ${skipCount}건, 실패 ${failCount}건 (${duration}ms)`,
      );
    } catch (error: any) {
      this.logger.error(`배송 상태 동기화 배치 실패: ${error.message}`);
      throw error;
    }
  }

  /**
   * 개별 주문 상태 동기화 (벌크 조회 데이터 사용)
   */
  private async syncOrderStatus(
    order: any,
    playautoOrder: LogisticsOrdersListItem,
  ): Promise<'updated' | 'skipped' | 'failed'> {
    const { status: playautoStatus, carrier, trackingNumber } = playautoOrder;

    // 상태 매핑 (enum 사용)
    const statusMapping = PLAYAUTO_STATUS_MAP[playautoStatus as PlayautoOrderStatus];
    if (!statusMapping) {
      this.logger.warn(`알 수 없는 플레이오토 상태: ${playautoStatus}`);
      return 'skipped';
    }

    const now = getNowKST();
    const updates: any = {};
    const shippingUpdates: any = {};

    // 주문 상태 업데이트 필요 여부 확인
    if (statusMapping.orderStatus && order.status !== statusMapping.orderStatus) {
      updates.status = statusMapping.orderStatus;

      // 상태별 타임스탬프 업데이트
      if (statusMapping.orderStatus === 'SHIPPING' && !order.shippedAt) {
        updates.shippedAt = now;
      }
      if (statusMapping.orderStatus === 'DELIVERED' && !order.deliveredAt) {
        updates.deliveredAt = now;
      }
      if (statusMapping.orderStatus === 'COMPLETED' && !order.completedAt) {
        updates.completedAt = now;
      }
    }

    // 배송 정보 업데이트
    if (order.shipping) {
      if (trackingNumber && order.shipping.trackingNumber !== trackingNumber) {
        shippingUpdates.trackingNumber = trackingNumber;
      }
      if (carrier && order.shipping.courierName !== carrier) {
        shippingUpdates.courierName = carrier;
      }
      if (statusMapping.shippingStatus && order.shipping.status !== statusMapping.shippingStatus) {
        shippingUpdates.status = statusMapping.shippingStatus;

        // 상태별 타임스탬프
        if (statusMapping.shippingStatus === 'IN_TRANSIT' && !order.shipping.shippedAt) {
          shippingUpdates.shippedAt = now;
        }
        if (statusMapping.shippingStatus === 'DELIVERED' && !order.shipping.deliveredAt) {
          shippingUpdates.deliveredAt = now;
        }
      }
    }

    // 변경사항 없으면 스킵
    if (Object.keys(updates).length === 0 && Object.keys(shippingUpdates).length === 0) {
      return 'skipped';
    }

    // 트랜잭션으로 업데이트
    await this.prisma.$transaction(async (tx) => {
      // 주문 상태 업데이트
      if (Object.keys(updates).length > 0) {
        updates.updatedAt = now;
        await tx.order.update({
          where: { id: order.id },
          data: updates,
        });

        // 상태 변경 로그
        if (updates.status) {
          await tx.orderStateLog.create({
            data: {
              orderId: order.id,
              fromStatus: order.status,
              toStatus: updates.status,
              changeReason: `플레이오토 동기화: ${playautoStatus}`,
              createdAt: now,
            },
          });
        }
      }

      // 배송 정보 업데이트
      if (order.shipping && Object.keys(shippingUpdates).length > 0) {
        shippingUpdates.updatedAt = now;
        await tx.shipping.update({
          where: { id: order.shipping.id },
          data: shippingUpdates,
        });
      }
    });

    this.logger.log(
      `주문 동기화 완료: orderId=${order.id}, 플레이오토상태=${playautoStatus}, ` +
        `주문상태=${updates.status || '변경없음'}, 송장=${trackingNumber || '없음'}`,
    );

    return 'updated';
  }
}
