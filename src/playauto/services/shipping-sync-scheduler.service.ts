import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { getNowKST } from '../../common/utils/kst-date.util';
import {
  ILogisticsProvider,
  LOGISTICS_PROVIDER_TOKEN,
} from '../interfaces/logistics-provider.interface';

/**
 * 플레이오토 상태 → 우리 DB 상태 매핑
 */
const PLAYAUTO_STATUS_MAP: Record<string, { orderStatus?: string; shippingStatus?: string }> = {
  // 주문 처리 중
  '신규주문': { orderStatus: 'PAID', shippingStatus: 'PENDING' },
  '결제완료': { orderStatus: 'PAID', shippingStatus: 'PENDING' },
  '출고대기': { orderStatus: 'PAID', shippingStatus: 'PENDING' },
  '출고보류': { orderStatus: 'PAID', shippingStatus: 'PENDING' },
  '주문재확인': { orderStatus: 'PAID', shippingStatus: 'PENDING' },
  '주문보류': { orderStatus: 'PAID', shippingStatus: 'PENDING' },

  // 출고 진행
  '운송장출력': { orderStatus: 'SHIPPING', shippingStatus: 'READY_FOR_SHIPMENT' },
  '출고완료': { orderStatus: 'SHIPPING', shippingStatus: 'IN_TRANSIT' },
  '배송중': { orderStatus: 'SHIPPING', shippingStatus: 'IN_TRANSIT' },

  // 배송 완료
  '배송완료': { orderStatus: 'DELIVERED', shippingStatus: 'DELIVERED' },
  '구매결정': { orderStatus: 'COMPLETED', shippingStatus: 'DELIVERED' },
  '판매완료': { orderStatus: 'COMPLETED', shippingStatus: 'DELIVERED' },

  // 취소/반품/교환
  '취소요청': { orderStatus: 'CANCEL_REQUESTED' },
  '취소완료': { orderStatus: 'CANCELLED' },
  '반품요청': { orderStatus: 'RETURN_REQUESTED' },
  '반품접수': { orderStatus: 'RETURN_REQUESTED' },
  '반품회수완료': { orderStatus: 'RETURN_REQUESTED' },
  '반품완료': { orderStatus: 'RETURNED' },
  '교환요청': { orderStatus: 'EXCHANGE_REQUESTED' },
  '교환접수': { orderStatus: 'EXCHANGE_REQUESTED' },
  '교환완료': { orderStatus: 'EXCHANGED' },
};

/**
 * 배송 상태 동기화 스케줄러
 *
 * 30분마다 실행되어:
 * 1. 플레이오토에 등록된 주문 중 최종 완료 상태가 아닌 것 조회
 * 2. 플레이오토 API로 주문 상세 조회
 * 3. 송장번호, 택배사, 배송상태 가져와서 DB 업데이트
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
   * 배송 상태 동기화 배치 실행
   */
  async handleShippingSync() {
    this.logger.log('🕐 배송 상태 동기화 배치 시작...');

    const startTime = Date.now();

    try {
      // 1. 동기화 대상 주문 조회
      // - 플레이오토에 등록됨 (logisticsUniq 있음)
      // - 최종 완료 상태가 아님 (COMPLETED, CANCELLED, RETURNED, EXCHANGED 제외)
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

      let successCount = 0;
      let failCount = 0;
      let skipCount = 0;

      // 2. 각 주문별로 플레이오토 조회 및 업데이트
      for (const order of orders) {
        try {
          const result = await this.syncOrderStatus(order);
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

        // API 호출 간격 조절 (rate limit 방지)
        await this.delay(500);
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
   * 개별 주문 상태 동기화
   */
  private async syncOrderStatus(order: any): Promise<'updated' | 'skipped' | 'failed'> {
    const uniq = order.logisticsUniq;

    this.logger.log(`주문 동기화 시작: orderId=${order.id}, uniq=${uniq}`);

    // 플레이오토 주문 상세 조회
    const playautoOrder = await this.logisticsProvider.getTrackingInfo(uniq);

    if (!playautoOrder) {
      this.logger.warn(`플레이오토 주문 조회 실패: uniq=${uniq}`);
      return 'failed';
    }

    const { status: playautoStatus, carrier, trackingNumber } = playautoOrder;

    // 상태 매핑
    const statusMapping = PLAYAUTO_STATUS_MAP[playautoStatus];
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
      this.logger.log(`변경사항 없음: orderId=${order.id}`);
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

  /**
   * 딜레이 헬퍼
   */
  private delay(ms: number): Promise<void> {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
