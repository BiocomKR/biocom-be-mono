/**
 * 장바구니 관리 서비스 (관리자용)
 * - 전체 장바구니 목록 조회
 * - 사용자별 장바구니 조회
 * - 장바구니 아이템 삭제
 */

import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';

export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 장바구니 목록 조회 (페이징 및 필터링)
   */
  async getCartsWithPagination(
    page: number,
    limit: number,
    filters: {
      userId?: number;
      userName?: string;
      productId?: number;
      productName?: string;
      stockAvailable?: boolean;
      startDate?: string;
      endDate?: string;
    },
    sort: {
      sortBy: string;
      sortOrder: 'asc' | 'desc';
    }
  ): Promise<PaginatedResult<any>> {
    this.logger.log(`장바구니 목록 조회 - page: ${page}, limit: ${limit}`);

    const skip = (page - 1) * limit;

    // CartItem 기준으로 조회 (장바구니 아이템 목록)
    const where: any = {};

    // 사용자 ID 필터
    if (filters.userId) {
      where.cart = { userId: filters.userId };
    }

    // 사용자 이름 검색
    if (filters.userName) {
      where.cart = {
        ...where.cart,
        user: {
          name: { contains: filters.userName, mode: 'insensitive' },
        },
      };
    }

    // 상품 ID 필터
    if (filters.productId) {
      where.productId = filters.productId;
    }

    // 상품명 검색
    if (filters.productName) {
      where.product = {
        name: { contains: filters.productName, mode: 'insensitive' },
      };
    }

    // 재고 가용 여부 필터
    if (filters.stockAvailable !== undefined) {
      where.stockAvailable = filters.stockAvailable;
    }

    // 추가일 범위 필터
    if (filters.startDate || filters.endDate) {
      where.addedAt = {};
      if (filters.startDate) {
        where.addedAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.addedAt.lte = new Date(filters.endDate + 'T23:59:59.999Z');
      }
    }

    // 정렬 조건
    let orderBy: any = {};
    if (sort.sortBy === 'userName') {
      orderBy = { cart: { user: { name: sort.sortOrder } } };
    } else if (sort.sortBy === 'productName') {
      orderBy = { product: { name: sort.sortOrder } };
    } else if (sort.sortBy === 'addedAt') {
      orderBy = { addedAt: sort.sortOrder };
    } else if (sort.sortBy === 'updatedAt') {
      orderBy = { updatedAt: sort.sortOrder };
    } else {
      orderBy = { [sort.sortBy]: sort.sortOrder };
    }

    const [items, total] = await Promise.all([
      this.prisma.cartItem.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          cart: {
            include: {
              user: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  mobile: true,
                },
              },
            },
          },
          product: {
            select: {
              id: true,
              name: true,
              price: true,
              status: true,
              productFiles: {
                where: { imageType: 'MAIN' },
                take: 1,
                select: {
                  file: { select: { filePath: true } },
                },
              },
            },
          },
        },
      }),
      this.prisma.cartItem.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    // 응답 데이터 가공
    const formattedItems = items.map((item) => ({
      id: item.id,
      cartId: item.cartId,
      user: item.cart.user,
      product: {
        id: item.product.id,
        name: item.product.name,
        price: Number(item.product.price),
        status: item.product.status,
        imageUrl: item.product.productFiles?.[0]?.file?.filePath || null,
      },
      quantity: item.quantity,
      subtotal: Number(item.product.price) * item.quantity,
      stockAvailable: item.stockAvailable,
      stockCheckedAt: item.stockCheckedAt,
      addedAt: item.addedAt,
      updatedAt: item.updatedAt,
    }));

    this.logger.log(`장바구니 목록 조회 완료 - 총 ${total}개`);

    return {
      items: formattedItems,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * 사용자별 장바구니 상세 조회
   */
  async getCartByUserId(userId: number): Promise<any> {
    this.logger.log(`사용자 장바구니 조회 - userId: ${userId}`);

    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
            mobile: true,
          },
        },
        items: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
                price: true,
                status: true,
                maxOrderQty: true,
                productFiles: {
                  where: { imageType: 'MAIN' },
                  take: 1,
                  select: {
                    file: { select: { filePath: true } },
                  },
                },
              },
            },
          },
          orderBy: { addedAt: 'desc' },
        },
      },
    });

    if (!cart) {
      throw new NotFoundException(`사용자(${userId})의 장바구니를 찾을 수 없습니다`);
    }

    // 총 금액 및 수량 계산
    const totalPrice = cart.items.reduce((sum, item) => {
      return sum + Number(item.product.price) * item.quantity;
    }, 0);

    const totalQuantity = cart.items.reduce((sum, item) => sum + item.quantity, 0);

    const formattedItems = cart.items.map((item) => ({
      id: item.id,
      product: {
        id: item.product.id,
        name: item.product.name,
        price: Number(item.product.price),
        status: item.product.status,
        maxOrderQty: item.product.maxOrderQty,
        imageUrl: item.product.productFiles?.[0]?.file?.filePath || null,
      },
      quantity: item.quantity,
      subtotal: Number(item.product.price) * item.quantity,
      stockAvailable: item.stockAvailable,
      stockCheckedAt: item.stockCheckedAt,
      addedAt: item.addedAt,
      updatedAt: item.updatedAt,
    }));

    this.logger.log(`사용자 장바구니 조회 완료 - userId: ${userId}, 아이템 수: ${cart.items.length}`);

    return {
      id: cart.id,
      user: cart.user,
      items: formattedItems,
      totalPrice,
      totalQuantity,
      createdAt: cart.createdAt,
      updatedAt: cart.updatedAt,
    };
  }

  /**
   * 장바구니 아이템 삭제 (관리자)
   */
  async deleteCartItem(itemId: number): Promise<void> {
    this.logger.log(`장바구니 아이템 삭제 - itemId: ${itemId}`);

    const item = await this.prisma.cartItem.findUnique({
      where: { id: itemId },
    });

    if (!item) {
      throw new NotFoundException(`장바구니 아이템(${itemId})을 찾을 수 없습니다`);
    }

    await this.prisma.cartItem.delete({
      where: { id: itemId },
    });

    this.logger.log(`장바구니 아이템 삭제 완료 - itemId: ${itemId}`);
  }

  /**
   * 사용자 장바구니 전체 비우기 (관리자)
   */
  async clearUserCart(userId: number): Promise<void> {
    this.logger.log(`사용자 장바구니 비우기 - userId: ${userId}`);

    const cart = await this.prisma.cart.findUnique({
      where: { userId },
    });

    if (!cart) {
      throw new NotFoundException(`사용자(${userId})의 장바구니를 찾을 수 없습니다`);
    }

    await this.prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    this.logger.log(`사용자 장바구니 비우기 완료 - userId: ${userId}`);
  }

  /**
   * 장바구니 통계 조회
   */
  async getCartStatistics(): Promise<any> {
    this.logger.log('장바구니 통계 조회');

    const [
      totalCarts,
      totalItems,
      cartsWithItems,
      recentItems,
    ] = await Promise.all([
      // 전체 장바구니 수
      this.prisma.cart.count(),
      // 전체 아이템 수
      this.prisma.cartItem.count(),
      // 아이템이 있는 장바구니 수
      this.prisma.cart.count({
        where: {
          items: {
            some: {},
          },
        },
      }),
      // 최근 7일 내 추가된 아이템 수
      this.prisma.cartItem.count({
        where: {
          addedAt: {
            gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000),
          },
        },
      }),
    ]);

    // 재고 부족 아이템 수
    const outOfStockItems = await this.prisma.cartItem.count({
      where: { stockAvailable: false },
    });

    this.logger.log('장바구니 통계 조회 완료');

    return {
      totalCarts,
      totalItems,
      cartsWithItems,
      emptyCarts: totalCarts - cartsWithItems,
      recentItemsCount: recentItems,
      outOfStockItems,
    };
  }
}
