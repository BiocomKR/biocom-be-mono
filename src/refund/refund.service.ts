import { 
  Injectable, 
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { 
  CreateRefundDto,
  UpdateRefundDto,
  RefundResponseDto,
  RefundListResponseDto
} from './dto/refund.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class RefundService {
  private readonly logger = new Logger(RefundService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 환불 요청 생성
   */
  async createRefund(userId: number, dto: CreateRefundDto): Promise<RefundResponseDto> {
    return await this.prisma.$transaction(async (tx) => {
      // 주문 조회
      const order = await tx.order.findFirst({
        where: {
          orderNumber: dto.orderNumber,
          userId,
        },
        include: {
          payment: true,
          items: {
            include: {
              productOption: true,
            },
          },
        },
      });

      if (!order) {
        throw new NotFoundException('주문을 찾을 수 없습니다');
      }

      // 환불 가능 상태 확인
      if (!['PAID', 'PREPARING', 'SHIPPED', 'DELIVERED', 'COMPLETED'].includes(order.status)) {
        throw new BadRequestException('환불 요청이 불가능한 주문 상태입니다');
      }

      if (!order.payment) {
        throw new NotFoundException('결제 정보를 찾을 수 없습니다');
      }

      // 이미 환불 요청이 있는지 확인
      const existingRefund = await tx.refund.findFirst({
        where: {
          orderId: order.id,
          status: {
            in: ['PENDING', 'APPROVED', 'PROCESSING'],
          },
        },
      });

      if (existingRefund) {
        throw new ConflictException('이미 처리 중인 환불 요청이 있습니다');
      }

      // 환불 가능 금액 계산
      let refundAmount = Number(order.totalAmount);
      
      // 부분 환불 처리는 RefundItem 테이블이 없으므로 전체 환불로 처리
      // TODO: RefundItem 테이블 추가 필요

      // 환불 생성
      const refund = await tx.refund.create({
        data: {
          orderId: order.id,
          paymentId: order.payment.id,
          refundAmount: new Prisma.Decimal(refundAmount),
          refundType: 'CANCEL',
          reason: dto.reason,
          reasonDetail: dto.reason,
          status: 'PENDING',
          requestedAt: new Date(),
        },
      });

      // 부분 환불 처리는 RefundItem 테이블이 없으므로 주석 처리
      // TODO: RefundItem 테이블 추가 필요 시 구현

      this.logger.log(`환불 요청 생성: ${order.orderNumber} / ${refundAmount}원`);

      return {
        id: refund.id,
        orderId: refund.orderId,
        orderNumber: order.orderNumber,
        paymentId: refund.paymentId,
        amount: Number(refund.refundAmount),
        reason: refund.reason,
        status: refund.status,
        method: null,
        bankName: null,
        accountNumber: null,
        accountHolder: null,
        requestedAt: refund.requestedAt,
        approvedAt: null,
        rejectedAt: refund.rejectedAt,
        completedAt: refund.completedAt,
        rejectionReason: refund.reasonDetail,
        transactionId: refund.tossCancelId,
        failReason: refund.reasonDetail,
      };
    });
  }

  /**
   * 환불 승인 (관리자)
   */
  async approveRefund(refundId: number): Promise<RefundResponseDto> {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
      include: {
        order: true,
      },
    });

    if (!refund) {
      throw new NotFoundException('환불 요청을 찾을 수 없습니다');
    }

    if (refund.status !== 'PENDING') {
      throw new BadRequestException('대기 중인 환불 요청만 승인 가능합니다');
    }

    const updatedRefund = await this.prisma.refund.update({
      where: { id: refundId },
      data: {
        status: 'APPROVED',
        // approvedAt 필드가 없으므로 제거
      },
    });

    // 환불 처리 큐에 추가 (실제 환불은 별도 프로세스)
    // TODO: 환불 처리 큐 구현

    this.logger.log(`환불 승인: ${refund.order.orderNumber} / ${refund.refundAmount}원`);

    return {
      id: updatedRefund.id,
      orderId: updatedRefund.orderId,
      orderNumber: refund.order.orderNumber,
      paymentId: updatedRefund.paymentId,
      amount: Number(updatedRefund.refundAmount),
      reason: updatedRefund.reason,
      status: updatedRefund.status,
      method: null,
      bankName: null,
      accountNumber: null,
      accountHolder: null,
      requestedAt: updatedRefund.requestedAt,
      approvedAt: null,
      rejectedAt: updatedRefund.rejectedAt,
      completedAt: updatedRefund.completedAt,
      rejectionReason: updatedRefund.reasonDetail,
      transactionId: updatedRefund.tossCancelId,
      failReason: updatedRefund.reasonDetail,
    };
  }

  /**
   * 환불 거절 (관리자)
   */
  async rejectRefund(refundId: number, reason: string): Promise<RefundResponseDto> {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
      include: {
        order: true,
      },
    });

    if (!refund) {
      throw new NotFoundException('환불 요청을 찾을 수 없습니다');
    }

    if (refund.status !== 'PENDING') {
      throw new BadRequestException('대기 중인 환불 요청만 거절 가능합니다');
    }

    const updatedRefund = await this.prisma.refund.update({
      where: { id: refundId },
      data: {
        status: 'REJECTED',
        rejectedAt: new Date(),
        reasonDetail: reason, // rejectionReason 필드 대신 reasonDetail 사용
      },
    });

    this.logger.log(`환불 거절: ${refund.order.orderNumber} / 사유: ${reason}`);

    return {
      id: updatedRefund.id,
      orderId: updatedRefund.orderId,
      orderNumber: refund.order.orderNumber,
      paymentId: updatedRefund.paymentId,
      amount: Number(updatedRefund.refundAmount),
      reason: updatedRefund.reason,
      status: updatedRefund.status,
      method: null,
      bankName: null,
      accountNumber: null,
      accountHolder: null,
      requestedAt: updatedRefund.requestedAt,
      approvedAt: null,
      rejectedAt: updatedRefund.rejectedAt,
      completedAt: updatedRefund.completedAt,
      rejectionReason: updatedRefund.reasonDetail,
      transactionId: updatedRefund.tossCancelId,
      failReason: updatedRefund.reasonDetail,
    };
  }

  /**
   * 환불 처리 완료
   */
  async completeRefund(refundId: number, transactionId: string): Promise<RefundResponseDto> {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
      include: {
        order: {
          include: {
            items: {
              include: {
                productOption: true,
              },
            },
          },
        },
        // refundItems 테이블 없음
      },
    });

    if (!refund) {
      throw new NotFoundException('환불 요청을 찾을 수 없습니다');
    }

    if (refund.status !== 'APPROVED' && refund.status !== 'PROCESSING') {
      throw new BadRequestException('승인된 환불 요청만 완료 처리 가능합니다');
    }

    const updatedRefund = await this.prisma.$transaction(async (tx) => {
      // 환불 완료 처리
      const updated = await tx.refund.update({
        where: { id: refundId },
        data: {
          status: 'COMPLETED',
          completedAt: new Date(),
          refundedAt: new Date(),
          transactionId,
        },
      });

      // 전체 환불로 처리 (부분 환불 테이블 없음)
      {
        await tx.order.update({
          where: { id: refund.orderId },
          data: {
            status: 'REFUNDED',
          },
        });

        // 재고 복구
        for (const item of refund.order.items) {
          await tx.inventoryCache.upsert({
            where: { sku: item.productOption.sku },
            create: {
              sku: item.productOption.sku,
              availableQty: item.quantity,
              lastUpdated: new Date(),
            },
            update: {
              availableQty: {
                increment: item.quantity,
              },
              lastUpdated: new Date(),
            },
          });

          await tx.inventorySyncQueue.create({
            data: {
              orderId: refund.orderId,
              sku: item.productOption.sku,
              quantity: item.quantity,
              action: 'RESTORE',
              status: 'PENDING',
            },
          });
        }
      }

      // 주문 상태 로그
      await tx.orderStateLog.create({
        data: {
          orderId: refund.orderId,
          fromStatus: refund.order.status,
          toStatus: 'REFUNDED', // RefundItem 테이블이 없으므로 항상 전체 환불
          changeReason: `환불 완료 (${refund.refundAmount}원)`,
        },
      });

      return updated;
    });

    this.logger.log(`환불 완료: ${refund.order.orderNumber} / ${refund.refundAmount}원`);

    return {
      id: updatedRefund.id,
      orderId: updatedRefund.orderId,
      orderNumber: refund.order.orderNumber,
      paymentId: updatedRefund.paymentId,
      amount: Number(updatedRefund.refundAmount),
      reason: updatedRefund.reason,
      status: updatedRefund.status,
      method: null,
      bankName: null,
      accountNumber: null,
      accountHolder: null,
      requestedAt: updatedRefund.requestedAt,
      approvedAt: null,
      rejectedAt: updatedRefund.rejectedAt,
      completedAt: updatedRefund.completedAt,
      rejectionReason: updatedRefund.reasonDetail,
      transactionId: updatedRefund.tossCancelId,
      failReason: updatedRefund.reasonDetail,
    };
  }

  /**
   * 환불 목록 조회
   */
  async findAll(
    userId?: number,
    status?: string,
    page = 1,
    limit = 10
  ): Promise<RefundListResponseDto> {
    const skip = (page - 1) * limit;

    const where: Prisma.RefundWhereInput = {};
    
    if (userId) {
      where.order = { userId };
    }
    
    if (status) {
      where.status = status;
    }

    const [refunds, total] = await Promise.all([
      this.prisma.refund.findMany({
        where,
        skip,
        take: limit,
        orderBy: { requestedAt: 'desc' },
        include: {
          order: true,
          // refundItems 테이블 없음
        },
      }),
      this.prisma.refund.count({ where }),
    ]);

    return {
      items: refunds.map(refund => ({
        id: refund.id,
        orderId: refund.orderId,
        orderNumber: refund.order.orderNumber,
        paymentId: refund.paymentId,
        amount: Number(refund.refundAmount),
        reason: refund.reason,
        status: refund.status,
        method: null,
        bankName: null,
        accountNumber: null,
        accountHolder: null,
        requestedAt: refund.requestedAt,
        approvedAt: null,
        rejectedAt: refund.rejectedAt,
        completedAt: refund.completedAt,
        rejectionReason: refund.reasonDetail,
        transactionId: refund.tossCancelId,
        failReason: refund.reasonDetail,
        refundItems: undefined,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 환불 상세 조회
   */
  async findOne(refundId: number): Promise<RefundResponseDto> {
    const refund = await this.prisma.refund.findUnique({
      where: { id: refundId },
      include: {
        order: true,
        // refundItems 테이뺔 없음
      },
    });

    if (!refund) {
      throw new NotFoundException('환불 요청을 찾을 수 없습니다');
    }

    return {
      id: refund.id,
      orderId: refund.orderId,
      orderNumber: refund.order.orderNumber,
      paymentId: refund.paymentId,
      amount: Number(refund.refundAmount),
      reason: refund.reason,
      status: refund.status,
      method: null,
      bankName: null,
      accountNumber: null,
      accountHolder: null,
      requestedAt: refund.requestedAt,
      approvedAt: null,
      rejectedAt: refund.rejectedAt,
      completedAt: refund.completedAt,
      rejectionReason: refund.reasonDetail,
      transactionId: refund.tossCancelId,
      failReason: refund.reasonDetail,
      refundItems: undefined, // RefundItem 테이블 없음
    };
  }
}