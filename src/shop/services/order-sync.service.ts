import { Injectable, Logger, Inject } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import {
  ILogisticsProvider,
  LOGISTICS_PROVIDER_TOKEN,
} from '../../playauto/interfaces/logistics-provider.interface';
import { getNowKST } from '../../common/utils/kst-date.util';

/**
 * 플레이오토 상태 → 우리 DB 상태 매핑 타입
 */
interface PlayautoStatusMapping {
  orderStatus?: string;
  shippingStatus?: string;
}

/**
 * 주문 상태 우선순위 (정상 흐름)
 * 숫자가 클수록 진행된 상태
 * 역행 방지: 현재 상태보다 낮은 우선순위로는 변경 불가
 */
const ORDER_STATUS_PRIORITY: Record<string, number> = {
  PENDING_PAYMENT: 0,
  PAID: 1,
  PREPARING: 2,
  SHIPPING: 3,
  DELIVERED: 4,
  COMPLETED: 5,
  // 취소/반품/교환은 별도 흐름이므로 높은 우선순위 부여 (항상 허용)
  CANCEL_REQUESTED: 100,
  CANCELLED: 101,
  RETURN_REQUESTED: 102,
  RETURNED: 103,
  EXCHANGE_REQUESTED: 104,
  EXCHANGED: 105,
};

/**
 * 배송 상태 우선순위
 */
const SHIPPING_STATUS_PRIORITY: Record<string, number> = {
  PENDING: 0,
  READY_FOR_SHIPMENT: 1,
  IN_TRANSIT: 2,
  DELIVERED: 3,
};

/**
 * 플레이오토 상태 → 우리 DB 상태 매핑
 */
const PLAYAUTO_STATUS_MAP: Record<string, PlayautoStatusMapping> = {
  // 주문 처리 중
  신규주문: { orderStatus: 'PAID', shippingStatus: 'PENDING' },
  결제완료: { orderStatus: 'PAID', shippingStatus: 'PENDING' },
  출고대기: { orderStatus: 'PAID', shippingStatus: 'PENDING' },
  출고보류: { orderStatus: 'PAID', shippingStatus: 'PENDING' },
  주문재확인: { orderStatus: 'PAID', shippingStatus: 'PENDING' },
  주문보류: { orderStatus: 'PAID', shippingStatus: 'PENDING' },

  // 출고/배송 단계
  운송장출력: { orderStatus: 'SHIPPING', shippingStatus: 'READY_FOR_SHIPMENT' },
  출고완료: { orderStatus: 'SHIPPING', shippingStatus: 'IN_TRANSIT' },
  배송중: { orderStatus: 'SHIPPING', shippingStatus: 'IN_TRANSIT' },

  // 배송 완료
  배송완료: { orderStatus: 'DELIVERED', shippingStatus: 'DELIVERED' },
  구매결정: { orderStatus: 'COMPLETED', shippingStatus: 'DELIVERED' },
  판매완료: { orderStatus: 'COMPLETED', shippingStatus: 'DELIVERED' },

  // 취소
  취소요청: { orderStatus: 'CANCEL_REQUESTED' },
  취소완료: { orderStatus: 'CANCELLED' },

  // 반품
  반품요청: { orderStatus: 'RETURN_REQUESTED' },
  반품접수: { orderStatus: 'RETURN_REQUESTED' },
  반품회수완료: { orderStatus: 'RETURN_REQUESTED' },
  반품교환요청: { orderStatus: 'RETURN_REQUESTED' },
  반품완료: { orderStatus: 'RETURNED' },

  // 교환
  교환요청: { orderStatus: 'EXCHANGE_REQUESTED' },
  교환접수: { orderStatus: 'EXCHANGE_REQUESTED' },
  교환회수완료: { orderStatus: 'EXCHANGE_REQUESTED' },
  교환완료: { orderStatus: 'EXCHANGED' },

  // 맞교환
  맞교환요청: { orderStatus: 'EXCHANGE_REQUESTED' },
  맞교환완료: { orderStatus: 'EXCHANGED' },
};

/**
 * 주문 동기화 결과
 */
export interface OrderSyncResult {
  /** 동기화 결과 */
  result: 'updated' | 'skipped' | 'failed' | 'not_registered';
  /** 송장 번호 (있으면) */
  trackingNumber?: string;
  /** 택배사 */
  carrier?: string;
  /** 플레이오토 상태 */
  playautoStatus?: string;
}

/**
 * 주문 동기화 서비스
 *
 * 플레이오토에서 주문 정보를 조회하여 DB에 동기화하는 서비스
 * - 배치(biocom-mq)와 동일한 로직 사용
 * - 취소 요청 시 실시간 조회에도 사용
 */
@Injectable()
export class OrderSyncService {
  private readonly logger = new Logger(OrderSyncService.name);

  constructor(
    private readonly prisma: PrismaService,
    @Inject(LOGISTICS_PROVIDER_TOKEN) private readonly logistics: ILogisticsProvider,
  ) {}

  /**
   * 플레이오토에서 주문 정보 조회 후 DB 동기화
   *
   * @param orderId - 주문 ID
   * @returns 동기화 결과 및 송장 정보
   */
  async syncFromPlayauto(orderId: number): Promise<OrderSyncResult> {
    // 1. 주문 조회
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { shipping: true },
    });

    if (!order) {
      this.logger.warn(`주문을 찾을 수 없음: orderId=${orderId}`);
      return { result: 'failed' };
    }

    // 2. 플레이오토 등록 여부 확인
    if (!order.logisticsUniq) {
      this.logger.log(`플레이오토 미등록 주문: orderId=${orderId}`);
      return { result: 'not_registered' };
    }

    try {
      // 3. 플레이오토 API 조회
      const trackingInfo = await this.logistics.getTrackingInfo(order.logisticsUniq);

      this.logger.log(
        `플레이오토 조회 결과: orderId=${orderId}, status=${trackingInfo.status}, trackingNumber=${trackingInfo.trackingNumber}`,
      );

      // 4. DB 동기화
      const syncResult = await this.syncOrderStatus(orderId, {
        status: trackingInfo.status,
        carrier: trackingInfo.carrier,
        trackingNumber: trackingInfo.trackingNumber,
      });

      return {
        result: syncResult,
        trackingNumber: trackingInfo.trackingNumber,
        carrier: trackingInfo.carrier,
        playautoStatus: trackingInfo.status,
      };
    } catch (error: any) {
      this.logger.error(
        `플레이오토 조회 실패: orderId=${orderId}, error=${error.message}`,
      );
      return { result: 'failed' };
    }
  }

  /**
   * 개별 주문 상태 동기화 (배치와 동일한 로직)
   */
  private async syncOrderStatus(
    orderId: number,
    playautoData: { status: string; carrier?: string; trackingNumber?: string },
  ): Promise<'updated' | 'skipped' | 'failed'> {
    const { status: playautoStatus, carrier, trackingNumber } = playautoData;

    // 1. 주문 조회
    const order = await this.prisma.order.findUnique({
      where: { id: orderId },
      include: { shipping: true },
    });

    if (!order) {
      this.logger.warn(`주문을 찾을 수 없음: orderId=${orderId}`);
      return 'failed';
    }

    // 2. 상태 매핑
    const statusMapping = PLAYAUTO_STATUS_MAP[playautoStatus];
    if (!statusMapping) {
      this.logger.warn(`알 수 없는 플레이오토 상태: ${playautoStatus}`);
      return 'skipped';
    }

    const now = getNowKST();
    const updates: any = {};
    const shippingUpdates: any = {};

    // 3. 주문 상태 업데이트 필요 여부 확인 (역행 방지)
    if (statusMapping.orderStatus && order.status !== statusMapping.orderStatus) {
      const currentPriority = ORDER_STATUS_PRIORITY[order.status] ?? -1;
      const newPriority = ORDER_STATUS_PRIORITY[statusMapping.orderStatus] ?? -1;

      // 역행 방지: 현재 상태보다 낮은 우선순위로는 변경 불가
      if (newPriority <= currentPriority) {
        this.logger.warn(
          `상태 역행 방지: orderId=${orderId}, 현재=${order.status}(${currentPriority}) → 시도=${statusMapping.orderStatus}(${newPriority}), 플레이오토=${playautoStatus}`,
        );
      } else {
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
    }

    // 4. 배송 정보 업데이트 (역행 방지)
    if (order.shipping) {
      if (trackingNumber && order.shipping.trackingNumber !== trackingNumber) {
        shippingUpdates.trackingNumber = trackingNumber;
      }
      if (carrier && order.shipping.courierName !== carrier) {
        shippingUpdates.courierName = carrier;
      }
      if (
        statusMapping.shippingStatus &&
        order.shipping.status !== statusMapping.shippingStatus
      ) {
        const currentShippingPriority = SHIPPING_STATUS_PRIORITY[order.shipping.status] ?? -1;
        const newShippingPriority = SHIPPING_STATUS_PRIORITY[statusMapping.shippingStatus] ?? -1;

        // 배송 상태도 역행 방지
        if (newShippingPriority > currentShippingPriority) {
          shippingUpdates.status = statusMapping.shippingStatus;

          // 상태별 타임스탬프
          if (
            statusMapping.shippingStatus === 'IN_TRANSIT' &&
            !order.shipping.shippedAt
          ) {
            shippingUpdates.shippedAt = now;
          }
          if (
            statusMapping.shippingStatus === 'DELIVERED' &&
            !order.shipping.deliveredAt
          ) {
            shippingUpdates.deliveredAt = now;
          }
        }
      }
    }

    // 5. 변경사항 없으면 스킵
    if (
      Object.keys(updates).length === 0 &&
      Object.keys(shippingUpdates).length === 0
    ) {
      return 'skipped';
    }

    // 6. 트랜잭션으로 업데이트
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
