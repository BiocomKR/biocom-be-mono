import {
  Injectable,
  NotFoundException,
  BadRequestException,
  Logger
} from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import {
  AddCartItemDto,
  UpdateCartItemDto,
  CartItemResponseDto,
  CartResponseDto,
  CartValidationResponseDto
} from '../dto/cart/cart-item.dto';
import { getNowKST } from '../../common/utils/kst-date.util';

@Injectable()
export class CartService {
  private readonly logger = new Logger(CartService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 사용자 장바구니 조회 또는 생성
   */
  private async getOrCreateCart(userId: number): Promise<{ id: number }> {
    let cart = await this.prisma.cart.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!cart) {
      cart = await this.prisma.cart.create({
        data: {
          userId,
          createdAt: getNowKST(),
        },
        select: { id: true },
      });
    }

    return cart;
  }

  /**
   * 장바구니 조회
   */
  async getCart(userId: number): Promise<CartResponseDto> {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: {
              include: {
                images: {
                  where: { imageType: 'MAIN' },
                  take: 1,
                },
              },
            },
          },
          orderBy: { addedAt: 'desc' },
        },
      },
    });

    if (!cart) {
      // 장바구니가 없으면 빈 장바구니 생성
      const newCart = await this.prisma.cart.create({
        data: {
          userId,
          createdAt: getNowKST(),
        },
        include: { items: true },
      });

      return {
        ...newCart,
        items: [],
        totalProductPrice: 0,
        totalQuantity: 0,
      };
    }

    // 총 금액 및 수량 계산
    const totalProductPrice = cart.items.reduce((sum, item) => {
      const price = Number(item.product.price);
      return sum + (price * item.quantity);
    }, 0);

    const totalQuantity = cart.items.reduce((sum, item) => sum + item.quantity, 0);

    // 각 아이템의 소계 계산
    const itemsWithSubtotal = cart.items.map(item => ({
      ...item,
      subtotal: Number(item.product.price) * item.quantity,
    }));

    return {
      ...cart,
      items: itemsWithSubtotal,
      totalProductPrice,
      totalQuantity,
    };
  }

  /**
   * 장바구니에 상품 추가
   */
  async addItem(userId: number, dto: AddCartItemDto): Promise<CartItemResponseDto> {
    // 상품 확인
    const product = await this.prisma.product.findUnique({
      where: { id: dto.productId },
      include: {
        images: {
          where: { imageType: 'MAIN' },
          take: 1,
        },
      },
    });

    if (!product) {
      throw new NotFoundException('상품을 찾을 수 없습니다');
    }

    if (product.status !== 'ACTIVE') {
      throw new BadRequestException('판매 중인 상품이 아닙니다');
    }

    // 최대 주문 수량 체크
    if (dto.quantity > product.maxOrderQty) {
      throw new BadRequestException(`최대 주문 수량은 ${product.maxOrderQty}개입니다`);
    }

    // 장바구니 가져오기 또는 생성
    const cart = await this.getOrCreateCart(userId);

    // 이미 장바구니에 있는지 확인
    const existingItem = await this.prisma.cartItem.findUnique({
      where: {
        cartId_productId: {
          cartId: cart.id,
          productId: dto.productId,
        },
      },
    });

    if (existingItem) {
      // 이미 있으면 수량 증가
      const newQuantity = existingItem.quantity + dto.quantity;

      if (newQuantity > product.maxOrderQty) {
        throw new BadRequestException(`최대 주문 수량은 ${product.maxOrderQty}개입니다`);
      }

      const updatedItem = await this.prisma.cartItem.update({
        where: { id: existingItem.id },
        data: {
          quantity: newQuantity,
          updatedAt: getNowKST(),
        },
        include: {
          product: {
            include: {
              images: {
                where: { imageType: 'MAIN' },
                take: 1,
              },
            },
          },
        },
      });

      return {
        ...updatedItem,
        subtotal: Number(updatedItem.product.price) * updatedItem.quantity,
      };
    }

    // 새로 추가
    const newItem = await this.prisma.cartItem.create({
      data: {
        cartId: cart.id,
        productId: dto.productId,
        quantity: dto.quantity,
        stockAvailable: true,
        addedAt: getNowKST(),
      },
      include: {
        product: {
          include: {
            images: {
              where: { imageType: 'MAIN' },
              take: 1,
            },
          },
        },
      },
    });

    return {
      ...newItem,
      subtotal: Number(newItem.product.price) * newItem.quantity,
    };
  }

  /**
   * 장바구니 아이템 수량 변경
   */
  async updateItemQuantity(
    userId: number,
    itemId: number,
    dto: UpdateCartItemDto
  ): Promise<CartItemResponseDto> {
    // 장바구니 아이템 확인
    const item = await this.prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cart: { userId },
      },
      include: {
        product: true,
      },
    });

    if (!item) {
      throw new NotFoundException('장바구니 아이템을 찾을 수 없습니다');
    }

    // 최대 주문 수량 체크
    if (dto.quantity > item.product.maxOrderQty) {
      throw new BadRequestException(`최대 주문 수량은 ${item.product.maxOrderQty}개입니다`);
    }

    // 수량 업데이트
    const updatedItem = await this.prisma.cartItem.update({
      where: { id: itemId },
      data: {
        quantity: dto.quantity,
        updatedAt: getNowKST(),
      },
      include: {
        product: {
          include: {
            images: {
              where: { imageType: 'MAIN' },
              take: 1,
            },
          },
        },
      },
    });

    return {
      ...updatedItem,
      subtotal: Number(updatedItem.product.price) * updatedItem.quantity,
    };
  }

  /**
   * 장바구니 아이템 삭제
   */
  async removeItem(userId: number, itemId: number): Promise<{ success: boolean }> {
    // 장바구니 아이템 확인
    const item = await this.prisma.cartItem.findFirst({
      where: {
        id: itemId,
        cart: { userId },
      },
    });

    if (!item) {
      throw new NotFoundException('장바구니 아이템을 찾을 수 없습니다');
    }

    await this.prisma.cartItem.delete({
      where: { id: itemId },
    });

    return { success: true };
  }

  /**
   * 장바구니 전체 비우기
   */
  async clearCart(userId: number): Promise<{ success: boolean }> {
    const cart = await this.getOrCreateCart(userId);

    await this.prisma.cartItem.deleteMany({
      where: { cartId: cart.id },
    });

    return { success: true };
  }

  /**
   * 장바구니 재고 검증
   */
  async validateCart(userId: number): Promise<CartValidationResponseDto> {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      include: {
        items: {
          include: {
            product: true,
          },
        },
      },
    });

    if (!cart || cart.items.length === 0) {
      return {
        valid: true,
        message: '장바구니가 비어있습니다',
      };
    }

    const invalidItems: CartItemResponseDto[] = [];

    // 각 아이템의 재고 확인
    for (const item of cart.items) {
      // 상품 상태 확인
      if (item.product.status !== 'ACTIVE') {
        invalidItems.push({
          ...item,
          stockAvailable: false,
          subtotal: 0,
        });
        continue;
      }

      // TODO: 실제 재고 API 호출
      // 현재는 모의로 처리
      const mockStock = Math.floor(Math.random() * 100);
      const isAvailable = mockStock >= item.quantity;

      // 재고 상태 업데이트
      await this.prisma.cartItem.update({
        where: { id: item.id },
        data: {
          stockAvailable: isAvailable,
          stockCheckedAt: getNowKST(),
        },
      });

      if (!isAvailable) {
        invalidItems.push({
          ...item,
          stockAvailable: false,
          subtotal: 0,
        });
      }
    }

    if (invalidItems.length > 0) {
      return {
        valid: false,
        invalidItems,
        message: '재고가 부족한 상품이 있습니다',
      };
    }

    return {
      valid: true,
      message: '모든 상품이 구매 가능합니다',
    };
  }

  /**
   * 장바구니 아이템 수 조회
   */
  async getCartItemCount(userId: number): Promise<number> {
    const cart = await this.prisma.cart.findUnique({
      where: { userId },
      select: { id: true },
    });

    if (!cart) {
      return 0;
    }

    const count = await this.prisma.cartItem.count({
      where: { cartId: cart.id },
    });

    return count;
  }
}