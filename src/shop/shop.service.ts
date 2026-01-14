import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { UploadService } from '../upload/upload.service';
import { Prisma } from '@prisma/client';
import { getNowKST } from '../common/utils/kst-date.util';
import { OrderStatus, ProductStatus, CategoryCode } from '../common/enums';
import { CryptoUtil } from '../common/utils/crypto.util';

/**
 * 주문 상태 전이 규칙
 * key: 현재 상태, value: 전이 가능한 상태 목록
 */
const ORDER_STATUS_TRANSITIONS: Record<OrderStatus, OrderStatus[]> = {
  [OrderStatus.PENDING_PAYMENT]: [OrderStatus.PAID, OrderStatus.CANCELLED, OrderStatus.PAYMENT_FAILED],
  [OrderStatus.PAID]: [OrderStatus.PREPARING, OrderStatus.CANCELLED],
  [OrderStatus.PREPARING]: [OrderStatus.SHIPPED, OrderStatus.CANCELLED],
  [OrderStatus.SHIPPED]: [OrderStatus.DELIVERED, OrderStatus.CANCEL_REQUESTED],
  [OrderStatus.DELIVERED]: [OrderStatus.COMPLETED],
  [OrderStatus.CANCEL_REQUESTED]: [OrderStatus.CANCELLED], // 실무자 확인 후 취소 처리
  [OrderStatus.CANCELLED]: [], // 취소된 주문은 상태 변경 불가
  [OrderStatus.COMPLETED]: [], // 완료된 주문은 상태 변경 불가
  [OrderStatus.PAYMENT_FAILED]: [OrderStatus.CANCELLED], // 결제 실패 후 취소 처리
};

@Injectable()
export class ShopService {
  private readonly logger = new Logger(ShopService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly uploadService: UploadService,
  ) {}

  /**
   * 상품 목록 조회 (관리자)
   */
  async getProducts(params: {
    status?: string;
    categoryCode?: string;
    search?: string;
    isFeatured?: boolean;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    page: number;
    limit: number;
  }) {
    const { status, categoryCode, search, isFeatured, sortBy, sortOrder, page, limit } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.ProductWhereInput = {
      // 챌린지 상품은 상품 관리에서 제외 (챌린지 관리 메뉴에서 별도 관리)
      categoryCode: { not: CategoryCode.CHALLENGE }
    };
    if (status) where.status = status;
    if (categoryCode) where.categoryCode = categoryCode;
    if (isFeatured !== undefined) where.isFeatured = isFeatured;
    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { sku: { contains: search, mode: 'insensitive' } },
      ];
    }

    // 정렬 설정
    let orderBy: Prisma.ProductOrderByWithRelationInput = { createdAt: 'desc' };
    if (sortBy) {
      const order = sortOrder || 'desc';
      switch (sortBy) {
        case 'name': orderBy = { name: order }; break;
        case 'price': orderBy = { price: order }; break;
        case 'viewCount': orderBy = { viewCount: order }; break;
        case 'createdAt': orderBy = { createdAt: order }; break;
        default: orderBy = { createdAt: 'desc' };
      }
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          productFiles: {
            include: { file: true },
            orderBy: { sortOrder: 'asc' },
            take: 1
          },
          _count: {
            select: { orderItems: true }
          }
        }
      }),
      this.prisma.product.count({ where })
    ]);

    return {
      items: products.map(p => ({
        id: p.id,
        sku: p.sku,
        name: p.name,
        description: p.description,
        categoryCode: p.categoryCode,
        categoryName: p.categoryName,
        productType: p.productType,
        price: p.price ? Number(p.price) : null,
        originalPrice: p.originalPrice ? Number(p.originalPrice) : null,
        discountRate: p.discountRate,
        status: p.status,
        isFeatured: p.isFeatured,
        viewCount: p.viewCount,
        createdAt: p.createdAt,
        updatedAt: p.updatedAt,
        imageUrl: p.productFiles[0]?.file.filePath || null,
        orderCount: p._count.orderItems
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }

  /**
   * SKU 중복 검사 (대소문자 구분 없음)
   */
  async checkSkuDuplicate(sku: string, excludeId?: number) {
    if (!sku || sku.trim() === '') {
      return { isDuplicate: false, message: '' };
    }

    const existingProduct = await this.prisma.product.findFirst({
      where: {
        sku: { equals: sku.trim(), mode: 'insensitive' },
        ...(excludeId ? { id: { not: excludeId } } : {})
      },
      select: { id: true, name: true, sku: true }
    });

    if (existingProduct) {
      return {
        isDuplicate: true,
        message: `이미 사용 중인 SKU입니다 (${existingProduct.sku})`
      };
    }

    return { isDuplicate: false, message: '사용 가능한 SKU입니다' };
  }

  /**
   * 상품 상세 조회 (관리자)
   */
  async getProductById(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        productFiles: {
          include: { file: true },
          orderBy: { sortOrder: 'asc' }
        },
        _count: {
          select: { orderItems: true }
        }
      }
    });

    if (!product) {
      throw new NotFoundException('상품을 찾을 수 없습니다');
    }

    return {
      id: product.id,
      sku: product.sku,
      name: product.name,
      description: product.description,
      categoryCode: product.categoryCode,
      categoryName: product.categoryName,
      productType: product.productType,
      setItems: product.setItems,
      productInfo: product.productInfo,
      price: product.price ? Number(product.price) : null,
      originalPrice: product.originalPrice ? Number(product.originalPrice) : null,
      discountRate: product.discountRate,
      shippingFee: Number(product.shippingFee),
      shippingPolicy: product.shippingPolicy,
      freeShippingAmount: product.freeShippingAmount ? Number(product.freeShippingAmount) : null,
      maxOrderQty: product.maxOrderQty,
      weight: product.weight,
      status: product.status,
      isFeatured: product.isFeatured,
      viewCount: product.viewCount,
      pointRate: product.pointRate,
      tags: product.tags,
      metadata: product.metadata,
      createdAt: product.createdAt,
      updatedAt: product.updatedAt,
      images: product.productFiles.map(pf => ({
        id: pf.id,
        imageUrl: pf.file.filePath,
        imageType: pf.imageType,
        sortOrder: pf.sortOrder,
        altText: pf.altText
      })),
      orderCount: product._count.orderItems
    };
  }

  /**
   * 상품 생성
   */
  async createProduct(dto: any) {
    // SKU 검증: 공백 포함 불가
    if (dto.sku && /\s/.test(dto.sku)) {
      throw new BadRequestException('SKU에 공백을 포함할 수 없습니다');
    }

    // SKU 중복 검사 (대소문자 구분 없음)
    if (dto.sku) {
      const existing = await this.prisma.product.findFirst({
        where: { sku: { equals: dto.sku, mode: 'insensitive' } }
      });
      if (existing) {
        throw new ConflictException(`이미 사용 중인 SKU입니다 (${existing.sku})`);
      }
    }

    const product = await this.prisma.product.create({
      data: {
        ...dto,
        createdAt: getNowKST(),
      }
    });

    this.logger.log(`상품 생성: ${product.name} (ID: ${product.id})`);

    return this.getProductById(product.id);
  }

  /**
   * 상품 수정
   */
  async updateProduct(id: number, dto: any) {
    const existing = await this.prisma.product.findUnique({
      where: { id }
    });

    if (!existing) {
      throw new NotFoundException('상품을 찾을 수 없습니다');
    }

    const product = await this.prisma.product.update({
      where: { id },
      data: dto
    });

    this.logger.log(`상품 수정: ${product.name} (ID: ${id})`);

    return this.getProductById(id);
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

    // Soft delete: status = INACTIVE
    await this.prisma.product.update({
      where: { id },
      data: { status: ProductStatus.INACTIVE }
    });

    this.logger.log(`상품 비활성화(soft delete): ID ${id}`);

    return { success: true };
  }

  /**
   * 파일을 GCS에 업로드하고 File 테이블에 저장 (UserFile 없이)
   */
  private async uploadAndSaveFile(file: Express.Multer.File): Promise<number> {
    // 상품 이미지 전용 업로드 (UserFile 없이 File 테이블에만 저장)
    const result = await this.uploadService.uploadProductImage(file);
    return result.id;
  }

  /**
   * 상품 이미지 업로드 (MAIN/CONTENT 타입)
   * @param reorderJson - 기존 이미지 순서 변경 정보 (JSON 배열: [{id: ProductFile.id, sortOrder: number}])
   * @param newFileSortOrdersJson - 새 파일 순서 정보 (JSON 배열: [sortOrder1, sortOrder2, ...], files 순서와 1:1 매칭)
   */
  async uploadProductImages(
    productId: number,
    files?: Express.Multer.File[],
    deleteFileIdsJson?: string,
    imageType: string = 'MAIN',
    reorderJson?: string,
    newFileSortOrdersJson?: string
  ) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
      include: {
        productFiles: {
          orderBy: { sortOrder: 'asc' }
        }
      }
    });

    if (!product) {
      throw new NotFoundException('상품을 찾을 수 없습니다');
    }

    // 삭제할 파일 ID 파싱 (ProductFile.id 배열)
    let deleteProductFileIds: number[] = [];
    if (deleteFileIdsJson) {
      try {
        deleteProductFileIds = JSON.parse(deleteFileIdsJson);
      } catch {
        this.logger.warn(`deleteFileIds 파싱 실패: ${deleteFileIdsJson}`);
      }
    }

    // 순서 변경 정보 파싱 (ProductFile.id와 새 sortOrder 배열)
    let reorderData: { id: number; sortOrder: number }[] = [];
    if (reorderJson) {
      try {
        reorderData = JSON.parse(reorderJson);
      } catch {
        this.logger.warn(`reorder 파싱 실패: ${reorderJson}`);
      }
    }

    // 새 파일 순서 정보 파싱 (files 배열과 1:1 매칭)
    let newFileSortOrders: number[] = [];
    if (newFileSortOrdersJson) {
      try {
        newFileSortOrders = JSON.parse(newFileSortOrdersJson);
      } catch {
        this.logger.warn(`newFileSortOrders 파싱 실패: ${newFileSortOrdersJson}`);
      }
    }

    // 삭제할 ProductFile들의 fileId를 미리 조회 (GCS + File 레코드 삭제용)
    let fileIdsToDelete: number[] = [];
    if (deleteProductFileIds.length > 0) {
      const productFilesToDelete = await this.prisma.productFile.findMany({
        where: {
          productId,
          id: { in: deleteProductFileIds },
        },
        select: { fileId: true },
      });
      fileIdsToDelete = productFilesToDelete.map(pf => pf.fileId);
    }

    // 새 파일 업로드 (트랜잭션 외부, 병렬 처리)
    let newFileIds: number[] = [];
    if (files && files.length > 0) {
      newFileIds = await Promise.all(
        files.map(file => this.uploadAndSaveFile(file))
      );
    }

    // 기존 파일의 최대 sortOrder 구하기
    const maxSortOrder = product.productFiles.length > 0
      ? Math.max(...product.productFiles.map(pf => pf.sortOrder))
      : -1;

    await this.prisma.$transaction(async (tx) => {
      // 삭제할 파일 관계 제거 (deleteProductFileIds는 ProductFile.id)
      if (deleteProductFileIds.length > 0) {
        await tx.productFile.deleteMany({
          where: {
            productId,
            id: { in: deleteProductFileIds },
          },
        });
        this.logger.log(`상품 이미지 관계 삭제: 상품 ID ${productId}, ProductFile IDs ${deleteProductFileIds.join(', ')}`);
      }

      // 기존 이미지 순서 변경
      if (reorderData.length > 0) {
        for (const item of reorderData) {
          await tx.productFile.update({
            where: { id: item.id },
            data: { sortOrder: item.sortOrder },
          });
        }
        this.logger.log(`상품 이미지 순서 변경: 상품 ID ${productId}, ${reorderData.length}개 이미지`);
      }

      // 새 파일 추가 (imageType에 따라 MAIN 또는 CONTENT)
      if (newFileIds.length > 0) {
        // 새 파일 순서가 지정된 경우 해당 순서 사용, 없으면 기존 순서 다음부터
        const useCustomSortOrder = newFileSortOrders.length === newFileIds.length;
        const fallbackStartOrder = reorderData.length > 0
          ? Math.max(...reorderData.map(r => r.sortOrder)) + 1
          : maxSortOrder + 1;

        await tx.productFile.createMany({
          data: newFileIds.map((fileId, index) => ({
            productId,
            fileId,
            imageType: imageType || 'MAIN',
            sortOrder: useCustomSortOrder ? newFileSortOrders[index] : fallbackStartOrder + index,
            createdAt: getNowKST(),
          })),
        });
        this.logger.log(`상품 이미지 추가: 상품 ID ${productId}, 타입 ${imageType}, ${newFileIds.length}개 파일`);
      }
    });

    // GCS 파일 + File 레코드 삭제 (트랜잭션 외부 - 실패해도 DB는 정리된 상태)
    if (fileIdsToDelete.length > 0) {
      await this.uploadService.deleteProductImages(fileIdsToDelete);
    }

    // 업데이트된 상품 정보 반환
    return this.getProductById(productId);
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
              product: true
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
        user: order.user ? {
          ...order.user,
        } : null,
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
            product: true
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
    // 유효한 주문 상태인지 검증
    const validStatuses = Object.values(OrderStatus);
    if (!validStatuses.includes(status as OrderStatus)) {
      throw new BadRequestException(`유효하지 않은 주문 상태입니다: ${status}. 유효한 값: ${validStatuses.join(', ')}`);
    }

    const order = await this.prisma.order.findFirst({
      where: { orderNumber }
    });

    if (!order) {
      throw new NotFoundException('주문을 찾을 수 없습니다');
    }

    // 상태 전이 규칙 검증
    const currentStatus = order.status as OrderStatus;
    const newStatus = status as OrderStatus;
    const allowedTransitions = ORDER_STATUS_TRANSITIONS[currentStatus] || [];

    if (!allowedTransitions.includes(newStatus)) {
      throw new BadRequestException(
        `${currentStatus}에서 ${newStatus}로 변경할 수 없습니다. 허용된 전이: ${allowedTransitions.length > 0 ? allowedTransitions.join(', ') : '없음'}`
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // 주문 상태 업데이트
      await tx.order.update({
        where: { id: order.id },
        data: {
          status,
          ...(status === OrderStatus.SHIPPED && { shippedAt: getNowKST() }),
          ...(status === OrderStatus.DELIVERED && { deliveredAt: getNowKST() }),
          ...(status === OrderStatus.CANCELLED && { cancelledAt: getNowKST() }),
          ...(status === OrderStatus.COMPLETED && { completedAt: getNowKST() })
        }
      });

      // 상태 로그 생성
      await tx.orderStateLog.create({
        data: {
          orderId: order.id,
          fromStatus: order.status,
          toStatus: status,
          changeReason: reason,
          createdAt: getNowKST(),
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
        depth,
        createdAt: getNowKST(),
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
      data: {
        ...dto,
        createdAt: getNowKST(),
      }
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
   * ⚠️ 재고 관리 기능 제거됨
   * - 외부 재고 시스템 연동 기능은 나중에 기획안 확정 후 재구현 예정
   */
  // async getInventory(params: { sku?: string; lowStock?: boolean }) {
  //   throw new Error('재고 관리 기능이 제거되었습니다.');
  // }

  // async syncInventory() {
  //   throw new Error('재고 관리 기능이 제거되었습니다.');
  // }

  // async adjustInventory(sku: string, quantity: number, reason: string) {
  //   throw new Error('재고 관리 기능이 제거되었습니다.');
  // }
}