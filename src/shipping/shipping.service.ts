import { 
  Injectable, 
  Logger,
  NotFoundException,
  BadRequestException
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { 
  ShippingResponseDto,
  UpdateShippingDto,
  TrackingResponseDto
} from './dto/shipping.dto';

@Injectable()
export class ShippingService {
  private readonly logger = new Logger(ShippingService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 배송 정보 조회
   */
  async findShippingByOrder(orderNumber: string): Promise<ShippingResponseDto> {
    const order = await this.prisma.order.findFirst({
      where: { orderNumber },
      include: {
        shipping: true,
      },
    });

    if (!order || !order.shipping) {
      throw new NotFoundException('배송 정보를 찾을 수 없습니다');
    }

    const shipping = order.shipping;

    return {
      id: shipping.id,
      orderId: shipping.orderId,
      orderNumber: order.orderNumber,
      status: shipping.status,
      carrier: shipping.courierName,
      trackingNumber: shipping.trackingNumber,
      shippingFee: Number(shipping.shippingFee),
      estimatedDeliveryDate: null,
      actualDeliveryDate: null,
      shippedAt: shipping.shippedAt,
      deliveredAt: shipping.deliveredAt,
      recipientName: order.recipientName,
      recipientPhone: order.recipientPhone,
      postalCode: order.postalCode,
      address: order.address,
      addressDetail: order.addressDetail,
      deliveryMessage: order.deliveryMessage,
    };
  }

  /**
   * 배송 정보 업데이트 (운송장 번호 등록)
   */
  async updateShipping(
    orderNumber: string, 
    dto: UpdateShippingDto
  ): Promise<ShippingResponseDto> {
    const order = await this.prisma.order.findFirst({
      where: { orderNumber },
      include: { shipping: true },
    });

    if (!order) {
      throw new NotFoundException('주문을 찾을 수 없습니다');
    }

    if (!order.shipping) {
      throw new NotFoundException('배송 정보를 찾을 수 없습니다');
    }

    // 배송 가능 상태 확인
    if (!['PAID', 'PREPARING'].includes(order.status)) {
      throw new BadRequestException('배송 정보를 업데이트할 수 없는 상태입니다');
    }

    const updatedShipping = await this.prisma.$transaction(async (tx) => {
      // 배송 정보 업데이트
      const shipping = await tx.shipping.update({
        where: { id: order.shipping!.id },
        data: {
          courierName: dto.carrier,
          trackingNumber: dto.trackingNumber,
          status: 'READY_FOR_SHIPMENT',
        },
      });

      // 주문 상태도 업데이트
      if (order.status === 'PAID') {
        await tx.order.update({
          where: { id: order.id },
          data: { status: 'PREPARING' },
        });

        await tx.orderStateLog.create({
          data: {
            orderId: order.id,
            fromStatus: 'PAID',
            toStatus: 'PREPARING',
            changeReason: '배송 준비',
          },
        });
      }

      return shipping;
    });

    this.logger.log(`배송 정보 업데이트: ${orderNumber} / ${dto.trackingNumber}`);

    return {
      id: updatedShipping.id,
      orderId: updatedShipping.orderId,
      orderNumber: order.orderNumber,
      status: updatedShipping.status,
      carrier: updatedShipping.courierName,
      trackingNumber: updatedShipping.trackingNumber,
      shippingFee: Number(updatedShipping.shippingFee),
      estimatedDeliveryDate: updatedShipping.estimatedDeliveryDate,
      actualDeliveryDate: updatedShipping.actualDeliveryDate,
      shippedAt: updatedShipping.shippedAt,
      deliveredAt: updatedShipping.deliveredAt,
      recipientName: order.recipientName,
      recipientPhone: order.recipientPhone,
      postalCode: order.postalCode,
      address: order.address,
      addressDetail: order.addressDetail,
      deliveryMessage: order.deliveryMessage,
    };
  }

  /**
   * 배송 시작 처리
   */
  async startShipping(orderNumber: string): Promise<ShippingResponseDto> {
    const order = await this.prisma.order.findFirst({
      where: { orderNumber },
      include: { shipping: true },
    });

    if (!order || !order.shipping) {
      throw new NotFoundException('배송 정보를 찾을 수 없습니다');
    }

    if (order.status !== 'PREPARING') {
      throw new BadRequestException('배송 준비 중인 주문만 발송 처리 가능합니다');
    }

    if (!order.shipping.trackingNumber) {
      throw new BadRequestException('운송장 번호가 등록되지 않았습니다');
    }

    const updatedShipping = await this.prisma.$transaction(async (tx) => {
      // 배송 상태 업데이트
      const shipping = await tx.shipping.update({
        where: { id: order.shipping!.id },
        data: {
          status: 'IN_TRANSIT',
          shippedAt: new Date(),
        },
      });

      // 주문 상태 업데이트
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'SHIPPED',
          shippedAt: new Date(),
        },
      });

      // 주문 상태 로그
      await tx.orderStateLog.create({
        data: {
          orderId: order.id,
          fromStatus: 'PREPARING',
          toStatus: 'SHIPPED',
          changeReason: '배송 시작',
        },
      });

      return shipping;
    });

    this.logger.log(`배송 시작: ${orderNumber}`);

    return {
      id: updatedShipping.id,
      orderId: updatedShipping.orderId,
      orderNumber: order.orderNumber,
      status: updatedShipping.status,
      carrier: updatedShipping.courierName,
      trackingNumber: updatedShipping.trackingNumber,
      shippingFee: Number(updatedShipping.shippingFee),
      estimatedDeliveryDate: updatedShipping.estimatedDeliveryDate,
      actualDeliveryDate: updatedShipping.actualDeliveryDate,
      shippedAt: updatedShipping.shippedAt,
      deliveredAt: updatedShipping.deliveredAt,
      recipientName: order.recipientName,
      recipientPhone: order.recipientPhone,
      postalCode: order.postalCode,
      address: order.address,
      addressDetail: order.addressDetail,
      deliveryMessage: order.deliveryMessage,
    };
  }

  /**
   * 배송 완료 처리
   */
  async completeShipping(orderNumber: string): Promise<ShippingResponseDto> {
    const order = await this.prisma.order.findFirst({
      where: { orderNumber },
      include: { shipping: true },
    });

    if (!order || !order.shipping) {
      throw new NotFoundException('배송 정보를 찾을 수 없습니다');
    }

    if (order.status !== 'SHIPPED') {
      throw new BadRequestException('배송 중인 주문만 배송완료 처리 가능합니다');
    }

    const updatedShipping = await this.prisma.$transaction(async (tx) => {
      // 배송 상태 업데이트
      const shipping = await tx.shipping.update({
        where: { id: order.shipping!.id },
        data: {
          status: 'DELIVERED',
          deliveredAt: new Date(),
        },
      });

      // 주문 상태 업데이트
      await tx.order.update({
        where: { id: order.id },
        data: {
          status: 'DELIVERED',
          deliveredAt: new Date(),
        },
      });

      // 주문 상태 로그
      await tx.orderStateLog.create({
        data: {
          orderId: order.id,
          fromStatus: 'SHIPPED',
          toStatus: 'DELIVERED',
          changeReason: '배송 완료',
        },
      });

      return shipping;
    });

    this.logger.log(`배송 완료: ${orderNumber}`);

    return {
      id: updatedShipping.id,
      orderId: updatedShipping.orderId,
      orderNumber: order.orderNumber,
      status: updatedShipping.status,
      carrier: updatedShipping.courierName,
      trackingNumber: updatedShipping.trackingNumber,
      shippingFee: Number(updatedShipping.shippingFee),
      estimatedDeliveryDate: updatedShipping.estimatedDeliveryDate,
      actualDeliveryDate: updatedShipping.actualDeliveryDate,
      shippedAt: updatedShipping.shippedAt,
      deliveredAt: updatedShipping.deliveredAt,
      recipientName: order.recipientName,
      recipientPhone: order.recipientPhone,
      postalCode: order.postalCode,
      address: order.address,
      addressDetail: order.addressDetail,
      deliveryMessage: order.deliveryMessage,
    };
  }

  /**
   * 배송 추적 정보 조회
   * 실제로는 택배사 API 연동 필요
   */
  async trackShipping(trackingNumber: string): Promise<TrackingResponseDto> {
    const shipping = await this.prisma.shipping.findFirst({
      where: { trackingNumber },
      include: {
        order: true,
      },
    });

    if (!shipping) {
      throw new NotFoundException('배송 정보를 찾을 수 없습니다');
    }

    // TODO: 실제 택배사 API 호출
    // 현재는 모의 데이터 반환
    const trackingInfo: TrackingResponseDto = {
      carrier: shipping.courierName || 'CJ대한통운',
      trackingNumber: shipping.trackingNumber!,
      status: shipping.status,
      estimatedDeliveryDate: null,
      actualDeliveryDate: null,
      recipientName: shipping.order.recipientName,
      senderName: '바이오컴',
      events: [],
    };

    // 모의 배송 추적 이벤트 생성
    if (shipping.shippedAt) {
      trackingInfo.events.push({
        timestamp: shipping.shippedAt,
        status: '상품 발송',
        location: '서울 강남 물류센터',
        description: '택배사에 상품이 인계되었습니다',
      });
    }

    if (shipping.status === 'IN_TRANSIT') {
      trackingInfo.events.push({
        timestamp: new Date(),
        status: '배송 중',
        location: '서울 중부 집배센터',
        description: '배송 중입니다',
      });
    }

    if (shipping.deliveredAt) {
      trackingInfo.events.push({
        timestamp: shipping.deliveredAt,
        status: '배송 완료',
        location: shipping.order.address,
        description: '배송이 완료되었습니다',
      });
    }

    // 이벤트를 시간 역순으로 정렬
    trackingInfo.events.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());

    return trackingInfo;
  }

  /**
   * 배송비 정책 조회
   */
  async getShippingPolicies(): Promise<any[]> {
    const policies = await this.prisma.shippingPolicy.findMany({
      where: { isActive: true },
      orderBy: { isDefault: 'desc' },
    });

    return policies.map(policy => ({
      id: policy.id,
      name: policy.name,
      baseFee: Number(policy.baseFee),
      freeShippingAmount: policy.freeShippingAmount ? Number(policy.freeShippingAmount) : null,
      jejuExtraFee: Number(policy.jejuExtraFee),
      isDefault: policy.isDefault,
    }));
  }
}