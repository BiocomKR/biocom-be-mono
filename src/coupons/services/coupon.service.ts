import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ForbiddenException
} from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { getNowKST } from '../../common/utils/kst-date.util';
import {
  UserCouponListResponseDto,
  AvailableCouponsForProductResponseDto,
  UseCouponDto,
  UseCouponResponseDto,
  CouponValidationResponseDto,
  CouponDetailResponseDto,
  DiscountType,
  CouponStatus,
  CouponScopeType
} from '../dto/coupon.dto';

@Injectable()
export class CouponService {
  private readonly logger = new Logger(CouponService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 사용자 보유 쿠폰 목록 조회
   */
  async getUserCoupons(userId: number): Promise<UserCouponListResponseDto> {
    this.logger.log(`사용자 ${userId}의 쿠폰 목록 조회`);

    const userCoupons = await this.prisma.userCoupon.findMany({
      where: { userId },
      include: {
        coupon: {
          include: {
            product: true,
            couponProducts: {
              include: {
                product: true
              }
            }
          }
        }
      },
      orderBy: { issuedAt: 'desc' }
    });

    const now = getNowKST();
    const coupons = userCoupons.map(uc => {
      // 만료 시간 계산
      const remainingMs = uc.expiresAt.getTime() - now.getTime();
      const remainingHours = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60)));

      // 상태 업데이트 (만료된 경우)
      let status = uc.status as CouponStatus;
      if (status === 'ACTIVE' && remainingHours <= 0) {
        status = CouponStatus.EXPIRED;
      }

      // 상품명 결정 (scopeType에 따라)
      let productName = '전체 상품';
      const scopeType = uc.coupon.scopeType as CouponScopeType;
      if (scopeType === CouponScopeType.PRODUCT) {
        if (uc.coupon.couponProducts.length > 0) {
          const productNames = uc.coupon.couponProducts.map(cp => cp.product.name);
          productName = productNames.length > 1
            ? `${productNames[0]} 외 ${productNames.length - 1}개`
            : productNames[0];
        } else if (uc.coupon.product) {
          productName = uc.coupon.product.name;
        }
      } else if (scopeType === CouponScopeType.CATEGORY) {
        productName = `${uc.coupon.categoryCode} 카테고리`;
      }

      return {
        id: uc.id,
        couponId: uc.couponId,
        name: uc.coupon.name,
        description: uc.coupon.description,
        discountType: uc.coupon.discountType as DiscountType,
        discountValue: uc.coupon.discountValue,
        maxDiscountAmount: uc.coupon.maxDiscountAmount,
        productName,
        status,
        issuedAt: uc.issuedAt.toISOString(),
        expiresAt: uc.expiresAt.toISOString(),
        remainingHours,
        imageUrl: uc.coupon.imageUrl
      };
    });

    const totalCount = coupons.length;
    const activeCount = coupons.filter(c => c.status === CouponStatus.ACTIVE && c.remainingHours > 0).length;

    return {
      coupons,
      totalCount,
      activeCount
    };
  }

  /**
   * 특정 상품에 사용 가능한 쿠폰 조회
   * scopeType에 따라 ALL, CATEGORY, PRODUCT 쿠폰 모두 조회
   */
  async getAvailableCouponsForProduct(
    userId: number,
    productId: number
  ): Promise<AvailableCouponsForProductResponseDto> {
    this.logger.log(`사용자 ${userId}의 상품 ${productId}에 사용 가능한 쿠폰 조회`);

    // 상품 정보 조회
    const product = await this.prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      throw new NotFoundException('상품을 찾을 수 없습니다');
    }

    // 해당 상품에 적용 가능한 활성 쿠폰 조회
    // scopeType에 따라 필터링:
    // - ALL: 모든 상품에 적용 가능
    // - CATEGORY: 해당 상품의 카테고리와 일치
    // - PRODUCT: productId 일치 또는 couponProducts에 포함
    const now = getNowKST();
    const availableUserCoupons = await this.prisma.userCoupon.findMany({
      where: {
        userId,
        status: 'ACTIVE',
        expiresAt: { gt: now },
        coupon: {
          isActive: true,
          OR: [
            // ALL: 전체 상품 적용
            { scopeType: CouponScopeType.ALL },
            // CATEGORY: 카테고리 일치
            {
              scopeType: CouponScopeType.CATEGORY,
              categoryCode: product.categoryCode
            },
            // PRODUCT: 기존 productId 방식 (하위 호환)
            {
              scopeType: CouponScopeType.PRODUCT,
              productId
            },
            // PRODUCT: couponProducts 관계 테이블 방식
            {
              scopeType: CouponScopeType.PRODUCT,
              couponProducts: {
                some: { productId }
              }
            }
          ]
        }
      },
      include: {
        coupon: true
      }
    });

    const originalPrice = Number(product.price) || 0;
    let maxDiscount = 0;

    const availableCoupons = availableUserCoupons.map(uc => {
      const remainingMs = uc.expiresAt.getTime() - now.getTime();
      const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));

      // 예상 할인 금액 계산
      let expectedDiscount = 0;
      if (uc.coupon.discountType === 'PERCENTAGE') {
        expectedDiscount = Math.floor(originalPrice * uc.coupon.discountValue / 100);
        if (uc.coupon.maxDiscountAmount) {
          expectedDiscount = Math.min(expectedDiscount, uc.coupon.maxDiscountAmount);
        }
      } else {
        expectedDiscount = Math.min(uc.coupon.discountValue, originalPrice);
      }

      maxDiscount = Math.max(maxDiscount, expectedDiscount);

      return {
        id: uc.id,
        couponId: uc.couponId,
        name: uc.coupon.name,
        description: uc.coupon.description,
        discountType: uc.coupon.discountType as DiscountType,
        discountValue: uc.coupon.discountValue,
        maxDiscountAmount: uc.coupon.maxDiscountAmount,
        expectedDiscount,
        remainingHours,
        imageUrl: uc.coupon.imageUrl
      };
    });

    return {
      productId,
      productName: product.name,
      availableCoupons,
      originalPrice,
      maxDiscount
    };
  }

  /**
   * 쿠폰 유효성 검증
   * scopeType에 따라 ALL, CATEGORY, PRODUCT 쿠폰 검증
   */
  async validateCoupon(userId: number, userCouponId: number, productId: number): Promise<CouponValidationResponseDto> {
    this.logger.log(`사용자 ${userId}의 쿠폰 ${userCouponId} 유효성 검증 (상품: ${productId})`);

    const userCoupon = await this.prisma.userCoupon.findFirst({
      where: {
        id: userCouponId,
        userId,
        status: 'ACTIVE'
      },
      include: {
        coupon: {
          include: {
            product: true,
            couponProducts: true
          }
        }
      }
    });

    if (!userCoupon) {
      return {
        isValid: false,
        message: '유효하지 않은 쿠폰입니다'
      };
    }

    // 만료 확인
    const now = getNowKST();
    if (userCoupon.expiresAt <= now) {
      return {
        isValid: false,
        message: '만료된 쿠폰입니다'
      };
    }

    // 상품 가격 조회
    const product = await this.prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product) {
      return {
        isValid: false,
        message: '상품을 찾을 수 없습니다'
      };
    }

    // scopeType에 따른 상품 적용 가능 여부 확인
    const scopeType = userCoupon.coupon.scopeType as CouponScopeType;
    let isApplicable = false;

    switch (scopeType) {
      case CouponScopeType.ALL:
        isApplicable = true;
        break;
      case CouponScopeType.CATEGORY:
        isApplicable = userCoupon.coupon.categoryCode === product.categoryCode;
        break;
      case CouponScopeType.PRODUCT:
        isApplicable = userCoupon.coupon.couponProducts.some(cp => cp.productId === productId);
        break;
    }

    if (!isApplicable) {
      return {
        isValid: false,
        message: '해당 상품에 사용할 수 없는 쿠폰입니다'
      };
    }

    // 예상 할인 금액 계산
    const originalPrice = Number(product.price) || 0;
    let expectedDiscount = 0;

    if (userCoupon.coupon.discountType === 'PERCENTAGE') {
      expectedDiscount = Math.floor(originalPrice * userCoupon.coupon.discountValue / 100);
      if (userCoupon.coupon.maxDiscountAmount) {
        expectedDiscount = Math.min(expectedDiscount, userCoupon.coupon.maxDiscountAmount);
      }
    } else {
      expectedDiscount = Math.min(userCoupon.coupon.discountValue, originalPrice);
    }

    const remainingMs = userCoupon.expiresAt.getTime() - now.getTime();
    const remainingHours = Math.ceil(remainingMs / (1000 * 60 * 60));

    return {
      isValid: true,
      message: '사용 가능한 쿠폰입니다',
      expectedDiscount,
      remainingHours
    };
  }

  /**
   * 쿠폰 사용 (주문 시 호출)
   * scopeType에 따라 ALL, CATEGORY, PRODUCT 쿠폰 적용
   */
  async useCoupon(userId: number, userCouponId: number, orderId: number): Promise<UseCouponResponseDto> {
    this.logger.log(`사용자 ${userId}가 쿠폰 ${userCouponId} 사용 (주문: ${orderId})`);

    // 쿠폰 유효성 재확인
    const userCoupon = await this.prisma.userCoupon.findFirst({
      where: {
        id: userCouponId,
        userId,
        status: 'ACTIVE'
      },
      include: {
        coupon: {
          include: {
            couponProducts: true
          }
        }
      }
    });

    if (!userCoupon) {
      throw new NotFoundException('유효하지 않은 쿠폰입니다');
    }

    const now = getNowKST();
    if (userCoupon.expiresAt <= now) {
      throw new BadRequestException('만료된 쿠폰입니다');
    }

    // 주문 정보 확인
    const order = await this.prisma.order.findFirst({
      where: {
        id: orderId,
        userId
      },
      include: {
        items: {
          include: {
            product: true
          }
        }
      }
    });

    if (!order) {
      throw new NotFoundException('주문을 찾을 수 없습니다');
    }

    // scopeType에 따라 적용 가능한 상품 찾기
    const scopeType = userCoupon.coupon.scopeType as CouponScopeType;
    const couponProductIds = userCoupon.coupon.couponProducts.map(cp => cp.productId);

    const applicableItems = order.items.filter(item => {
      switch (scopeType) {
        case CouponScopeType.ALL:
          return true;
        case CouponScopeType.CATEGORY:
          return item.product.categoryCode === userCoupon.coupon.categoryCode;
        case CouponScopeType.PRODUCT:
          return couponProductIds.includes(item.product.id);
        default:
          return false;
      }
    });

    if (applicableItems.length === 0) {
      throw new BadRequestException('주문 상품 중 쿠폰을 적용할 수 있는 상품이 없습니다');
    }

    // 할인 금액 계산 (적용 가능한 모든 상품의 합계에 대해)
    const totalApplicablePrice = applicableItems.reduce((sum, item) => {
      return sum + Number(item.productPrice) * item.quantity;
    }, 0);

    let discountAmount = 0;

    if (userCoupon.coupon.discountType === 'PERCENTAGE') {
      discountAmount = Math.floor(totalApplicablePrice * userCoupon.coupon.discountValue / 100);
      if (userCoupon.coupon.maxDiscountAmount) {
        discountAmount = Math.min(discountAmount, userCoupon.coupon.maxDiscountAmount);
      }
    } else {
      discountAmount = Math.min(userCoupon.coupon.discountValue, totalApplicablePrice);
    }

    // 쿠폰 사용 처리
    await this.prisma.userCoupon.update({
      where: { id: userCouponId },
      data: {
        status: 'USED',
        usedAt: now,
        usedOrderId: orderId
      }
    });

    this.logger.log(`쿠폰 ${userCouponId} 사용 완료, 할인 금액: ${discountAmount}원`);

    return {
      success: true,
      message: '쿠폰이 성공적으로 적용되었습니다',
      discountAmount,
      usedCoupon: {
        id: userCoupon.id,
        name: userCoupon.coupon.name,
        discountType: userCoupon.coupon.discountType as DiscountType,
        discountValue: userCoupon.coupon.discountValue,
        usedAt: now.toISOString()
      }
    };
  }

  /**
   * 쿠폰 상세 정보 조회
   * scopeType에 따라 적용 대상 정보 반환
   */
  async getCouponDetail(userId: number, userCouponId: number): Promise<CouponDetailResponseDto> {
    this.logger.log(`사용자 ${userId}의 쿠폰 ${userCouponId} 상세 정보 조회`);

    const userCoupon = await this.prisma.userCoupon.findFirst({
      where: {
        id: userCouponId,
        userId
      },
      include: {
        coupon: {
          include: {
            product: true,
            couponProducts: {
              include: {
                product: true
              }
            }
          }
        }
      }
    });

    if (!userCoupon) {
      throw new NotFoundException('쿠폰을 찾을 수 없습니다');
    }

    const now = getNowKST();
    const remainingMs = userCoupon.expiresAt.getTime() - now.getTime();
    const remainingHours = Math.max(0, Math.ceil(remainingMs / (1000 * 60 * 60)));

    // 상태 업데이트 (만료된 경우)
    let status = userCoupon.status as CouponStatus;
    if (status === 'ACTIVE' && remainingHours <= 0) {
      status = CouponStatus.EXPIRED;
    }

    // scopeType에 따라 상품 정보 결정
    const scopeType = userCoupon.coupon.scopeType as CouponScopeType;
    let productInfo: { id: number; name: string; price?: number };

    if (scopeType === CouponScopeType.ALL) {
      productInfo = { id: 0, name: '전체 상품' };
    } else if (scopeType === CouponScopeType.CATEGORY) {
      productInfo = { id: 0, name: `${userCoupon.coupon.categoryCode} 카테고리` };
    } else if (userCoupon.coupon.couponProducts.length > 0) {
      const products = userCoupon.coupon.couponProducts.map(cp => cp.product);
      const productNames = products.map(p => p.name);
      productInfo = {
        id: products[0].id,
        name: productNames.length > 1
          ? `${productNames[0]} 외 ${productNames.length - 1}개`
          : productNames[0],
        price: Number(products[0].price)
      };
    } else if (userCoupon.coupon.product) {
      productInfo = {
        id: userCoupon.coupon.product.id,
        name: userCoupon.coupon.product.name,
        price: Number(userCoupon.coupon.product.price)
      };
    } else {
      productInfo = { id: 0, name: '상품 정보 없음' };
    }

    return {
      id: userCoupon.id,
      couponId: userCoupon.couponId,
      name: userCoupon.coupon.name,
      description: userCoupon.coupon.description,
      discountType: userCoupon.coupon.discountType as DiscountType,
      discountValue: userCoupon.coupon.discountValue,
      maxDiscountAmount: userCoupon.coupon.maxDiscountAmount,
      product: productInfo,
      status,
      issuedAt: userCoupon.issuedAt.toISOString(),
      expiresAt: userCoupon.expiresAt.toISOString(),
      remainingHours,
      usedAt: userCoupon.usedAt?.toISOString(),
      imageUrl: userCoupon.coupon.imageUrl
    };
  }

  /**
   * 만료된 쿠폰 정리 (배치 작업용)
   */
  async cleanupExpiredCoupons(): Promise<{ cleanedCount: number }> {
    this.logger.log('만료된 쿠폰 정리 작업 시작');

    const now = getNowKST();
    const result = await this.prisma.userCoupon.updateMany({
      where: {
        status: 'ACTIVE',
        expiresAt: { lt: now }
      },
      data: {
        status: 'EXPIRED'
      }
    });

    this.logger.log(`만료된 쿠폰 ${result.count}개 정리 완료`);

    return {
      cleanedCount: result.count
    };
  }
}