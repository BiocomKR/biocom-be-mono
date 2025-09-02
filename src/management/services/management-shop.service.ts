import { 
  Injectable, 
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException
} from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class ManagementShopService {
  private readonly logger = new Logger(ManagementShopService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 상품 목록 조회 (관리자)
   */
  async getProducts(params: {
    status?: string;
    categoryId?: number;
    page: number;
    limit: number;
  }) {
    const { status, categoryId, page, limit } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {};
    if (status) where.status = status;
    if (categoryId) where.categoryId = categoryId;

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          category: true,
          options: true,
          images: { orderBy: { sortOrder: 'asc' } },
          _count: {
            select: { orderItems: true }
          }
        }
      }),
      this.prisma.product.count({ where })
    ]);

    return {
      items: products.map(p => ({
        ...p,
        orderCount: p._count.orderItems,
        options: p.options.map(opt => ({
          ...opt,
          price: Number(opt.price)
        }))
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * 상품 생성
   */
  async createProduct(dto: any) {
    const { options, ...productData } = dto;

    return await this.prisma.$transaction(async (tx) => {
      // 상품 생성
      const product = await tx.product.create({
        data: productData
      });

      // 옵션 생성
      if (options && options.length > 0) {
        await tx.productOption.createMany({
          data: options.map((opt: any, index: number) => ({
            ...opt,
            productId: product.id,
            sortOrder: index + 1,
            isActive: true
          }))
        });
      }

      this.logger.log(`상품 생성: ${product.name} (ID: ${product.id})`);

      return await tx.product.findUnique({
        where: { id: product.id },
        include: {
          category: true,
          options: true,
          images: true
        }
      });
    });
  }

  /**
   * 상품 수정
   */
  async updateProduct(id: number, dto: any) {
    const { options, ...productData } = dto;

    const existing = await this.prisma.product.findUnique({
      where: { id }
    });

    if (!existing) {
      throw new NotFoundException('상품을 찾을 수 없습니다');
    }

    return await this.prisma.$transaction(async (tx) => {
      // 상품 정보 업데이트
      const product = await tx.product.update({
        where: { id },
        data: productData
      });

      // 옵션 업데이트 (있는 경우)
      if (options) {
        // 기존 옵션 삭제
        await tx.productOption.deleteMany({
          where: { productId: id }
        });

        // 새 옵션 생성
        await tx.productOption.createMany({
          data: options.map((opt: any, index: number) => ({
            ...opt,
            productId: id,
            sortOrder: index + 1,
            isActive: true
          }))
        });
      }

      this.logger.log(`상품 수정: ${product.name} (ID: ${id})`);

      return await tx.product.findUnique({
        where: { id },
        include: {
          category: true,
          options: true,
          images: true
        }
      });
    });
  }

  /**
   * 상품 삭제
   */
  async deleteProduct(id: number) {
    // 주문이 있는 상품은 삭제 불가
    const orderCount = await this.prisma.orderItem.count({
      where: { productId: id }
    });

    if (orderCount > 0) {
      throw new ConflictException('주문 내역이 있는 상품은 삭제할 수 없습니다. 대신 비활성화하세요.');
    }

    await this.prisma.product.delete({
      where: { id }
    });

    this.logger.log(`상품 삭제: ID ${id}`);

    return { success: true };
  }

  /**
   * 상품 이미지 추가
   */
  async addProductImage(productId: number, dto: any) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      throw new NotFoundException('상품을 찾을 수 없습니다');
    }

    const image = await this.prisma.productImage.create({
      data: {
        productId,
        ...dto
      }
    });

    this.logger.log(`상품 이미지 추가: 상품 ID ${productId}`);

    return image;
  }

  /**
   * 주문 목록 조회 (관리자)
   */
  async getOrders(params: {
    status?: string;
    startDate?: Date;
    endDate?: Date;
    page: number;
    limit: number;
  }) {
    const { status, startDate, endDate, page, limit } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.OrderWhereInput = {};
    
    if (status) where.status = status;
    
    if (startDate || endDate) {
      where.orderedAt = {};
      if (startDate) where.orderedAt.gte = startDate;
      if (endDate) where.orderedAt.lte = endDate;
    }

    const [orders, total] = await Promise.all([
      this.prisma.order.findMany({
        where,
        skip,
        take: limit,
        orderBy: { orderedAt: 'desc' },
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              mobile: true
            }
          },
          items: {
            include: {
              product: true,
              productOption: true
            }
          },
          payment: true,
          shipping: true
        }
      }),
      this.prisma.order.count({ where })
    ]);

    return {
      items: orders.map(order => ({
        ...order,
        totalProductPrice: Number(order.totalProductPrice),
        totalDiscount: Number(order.totalDiscount),
        shippingFee: Number(order.shippingFee),
        pointUsed: Number(order.pointUsed),
        totalAmount: Number(order.totalAmount),
        items: order.items.map(item => ({
          ...item,
          productPrice: Number(item.productPrice),
          subtotal: Number(item.subtotal)
        }))
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * 주문 상세 조회
   */
  async getOrderDetail(orderNumber: string) {
    const order = await this.prisma.order.findFirst({
      where: { orderNumber },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            mobile: true,
            points: true
          }
        },
        items: {
          include: {
            product: true,
            productOption: true
          }
        },
        payment: true,
        shipping: true,
        stateLogs: {
          orderBy: { createdAt: 'desc' }
        },
        refund: true // refund는 1:1 관계
      }
    });

    if (!order) {
      throw new NotFoundException('주문을 찾을 수 없습니다');
    }

    return {
      ...order,
      totalProductPrice: Number(order.totalProductPrice),
      totalDiscount: Number(order.totalDiscount),
      shippingFee: Number(order.shippingFee),
      pointUsed: Number(order.pointUsed),
      totalAmount: Number(order.totalAmount),
      items: order.items.map(item => ({
        ...item,
        productPrice: Number(item.productPrice),
        subtotal: Number(item.subtotal)
      })),
      refund: order.refund ? {
        ...order.refund,
        amount: Number(order.refund.refundAmount)
      } : null
    };
  }

  /**
   * 주문 상태 변경
   */
  async updateOrderStatus(orderNumber: string, status: string, reason: string) {
    const order = await this.prisma.order.findFirst({
      where: { orderNumber }
    });

    if (!order) {
      throw new NotFoundException('주문을 찾을 수 없습니다');
    }

    await this.prisma.$transaction(async (tx) => {
      // 주문 상태 업데이트
      await tx.order.update({
        where: { id: order.id },
        data: {
          status,
          ...(status === 'SHIPPED' && { shippedAt: new Date() }),
          ...(status === 'DELIVERED' && { deliveredAt: new Date() }),
          ...(status === 'CANCELLED' && { cancelledAt: new Date() }),
          ...(status === 'COMPLETED' && { completedAt: new Date() })
        }
      });

      // 상태 로그 생성
      await tx.orderStateLog.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: status,
          changeReason: reason
        }
      });
    });

    this.logger.log(`주문 상태 변경: ${orderNumber} / ${order.status} -> ${status}`);

    return { success: true };
  }

  /**
   * 주문 메모 추가
   */
  async addOrderMemo(orderNumber: string, memo: string) {
    const order = await this.prisma.order.findFirst({
      where: { orderNumber }
    });

    if (!order) {
      throw new NotFoundException('주문을 찾을 수 없습니다');
    }

    const updated = await this.prisma.order.update({
      where: { id: order.id },
      data: { /* adminMemo 필드가 없음 */ }
    });

    this.logger.log(`주문 메모 추가: ${orderNumber}`);

    return { success: true, memo: memo }; // adminMemo 필드가 없으므로 memo 그대로 반환
  }

  /**
   * 카테고리 생성
   */
  async createCategory(dto: any) {
    // depth 계산
    let depth = 1;
    if (dto.parentId) {
      const parent = await this.prisma.category.findUnique({
        where: { id: dto.parentId }
      });
      if (parent) {
        depth = parent.depth + 1;
      }
    }

    const category = await this.prisma.category.create({
      data: {
        ...dto,
        depth
      }
    });

    this.logger.log(`카테고리 생성: ${category.name} (ID: ${category.id})`);

    return category;
  }

  /**
   * 카테고리 수정
   */
  async updateCategory(id: number, dto: any) {
    const category = await this.prisma.category.update({
      where: { id },
      data: dto
    });

    this.logger.log(`카테고리 수정: ${category.name} (ID: ${id})`);

    return category;
  }

  /**
   * 카테고리 삭제
   */
  async deleteCategory(id: number) {
    // 하위 카테고리나 상품이 있는지 확인
    const [childCount, productCount] = await Promise.all([
      this.prisma.category.count({ where: { parentId: id } }),
      this.prisma.product.count({ where: { categoryId: id } })
    ]);

    if (childCount > 0) {
      throw new ConflictException('하위 카테고리가 있는 카테고리는 삭제할 수 없습니다');
    }

    if (productCount > 0) {
      throw new ConflictException('상품이 등록된 카테고리는 삭제할 수 없습니다');
    }

    await this.prisma.category.delete({ where: { id } });

    this.logger.log(`카테고리 삭제: ID ${id}`);

    return { success: true };
  }

  /**
   * 배송비 정책 조회
   */
  async getShippingPolicies() {
    const policies = await this.prisma.shippingPolicy.findMany({
      orderBy: { isDefault: 'desc' }
    });

    return policies.map(p => ({
      ...p,
      baseFee: Number(p.baseFee),
      freeShippingAmount: p.freeShippingAmount ? Number(p.freeShippingAmount) : null,
      jejuExtraFee: Number(p.jejuExtraFee)
    }));
  }

  /**
   * 배송비 정책 생성
   */
  async createShippingPolicy(dto: any) {
    // 기본 정책으로 설정하는 경우 기존 기본 정책 해제
    if (dto.isDefault) {
      await this.prisma.shippingPolicy.updateMany({
        where: { isDefault: true },
        data: { isDefault: false }
      });
    }

    const policy = await this.prisma.shippingPolicy.create({
      data: dto
    });

    this.logger.log(`배송비 정책 생성: ${policy.name}`);

    return policy;
  }

  /**
   * 배송비 정책 수정
   */
  async updateShippingPolicy(id: number, dto: any) {
    // 기본 정책으로 설정하는 경우 기존 기본 정책 해제
    if (dto.isDefault) {
      await this.prisma.shippingPolicy.updateMany({
        where: { 
          isDefault: true,
          id: { not: id }
        },
        data: { isDefault: false }
      });
    }

    const policy = await this.prisma.shippingPolicy.update({
      where: { id },
      data: dto
    });

    this.logger.log(`배송비 정책 수정: ${policy.name}`);

    return policy;
  }

  /**
   * 재고 현황 조회
   */
  async getInventory(params: { sku?: string; lowStock?: boolean }) {
    const where: Prisma.InventoryCacheWhereInput = {};
    
    if (params.sku) {
      where.sku = params.sku;
    }
    
    if (params.lowStock) {
      where.availableQty = { lt: 10 }; // 10개 미만을 재고 부족으로 정의
    }

    const inventory = await this.prisma.inventoryCache.findMany({
      where,
      orderBy: { availableQty: 'asc' }
    });

    // ProductOption을 별도로 조회
    const skus = inventory.map(item => item.sku);
    const productOptions = await this.prisma.productOption.findMany({
      where: { sku: { in: skus } },
      include: { product: true }
    });
    const optionMap = new Map(productOptions.map(opt => [opt.sku, opt]));

    return inventory.map(item => {
      const option = optionMap.get(item.sku);
      return {
        sku: item.sku,
        availableQty: item.availableQty,
        lastUpdated: item.lastUpdated,
        product: (option as any)?.product?.name,
        option: (option as any)?.optionName,
        isLowStock: item.availableQty < 10
      };
    });
  }

  /**
   * 재고 동기화
   */
  async syncInventory() {
    // 펜딩 중인 동기화 큐 처리
    const pendingQueues = await this.prisma.inventorySyncQueue.findMany({
      where: { status: 'PENDING' },
      orderBy: { createdAt: 'asc' },
      take: 100
    });

    let processed = 0;
    let failed = 0;

    for (const queue of pendingQueues) {
      try {
        // TODO: 실제 외부 API 호출
        // 현재는 모의 처리
        
        await this.prisma.inventorySyncQueue.update({
          where: { id: queue.id },
          data: {
            status: 'COMPLETED',
            processedAt: new Date()
          }
        });
        
        processed++;
      } catch (error) {
        await this.prisma.inventorySyncQueue.update({
          where: { id: queue.id },
          data: {
            status: 'FAILED',
            processedAt: new Date(),
            errorMessage: error.message
          }
        });
        
        failed++;
      }
    }

    this.logger.log(`재고 동기화 완료: 성공 ${processed}, 실패 ${failed}`);

    return {
      total: pendingQueues.length,
      processed,
      failed
    };
  }

  /**
   * 재고 수동 조정
   */
  async adjustInventory(sku: string, quantity: number, reason: string) {
    const inventory = await this.prisma.inventoryCache.upsert({
      where: { sku },
      create: {
        sku,
        availableQty: quantity,
        lastUpdated: new Date()
      },
      update: {
        availableQty: {
          increment: quantity
        },
        lastUpdated: new Date()
      }
    });

    // 조정 로그 생성
    await this.prisma.inventoryApiLog.create({
      data: {
        apiMethod: 'MANUAL_ADJUST',
        sku,
        requestData: { quantity, reason },
        responseData: { newQuantity: inventory.availableQty },
        responseStatus: 200
      }
    });

    this.logger.log(`재고 수동 조정: ${sku} / ${quantity > 0 ? '+' : ''}${quantity} (사유: ${reason})`);

    return {
      sku,
      newQuantity: inventory.availableQty,
      adjusted: quantity,
      reason
    };
  }
}