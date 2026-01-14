import { Injectable, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { getNowKST } from '../common/utils/kst-date.util';

interface GetCouponsParams {
  search?: string;
  discountType?: string;
  scopeType?: string;
  isActive?: boolean;
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
  page?: number;
  limit?: number;
}

interface GetIssuedCouponsParams {
  status?: string;
  page?: number;
  limit?: number;
}

@Injectable()
export class CouponService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 쿠폰 코드 중복 검사
   */
  async checkCodeDuplicate(code: string, excludeId?: number) {
    if (!code) {
      return { isDuplicate: false };
    }

    const where: any = { code };
    if (excludeId) {
      where.id = { not: excludeId };
    }

    const existing = await this.prisma.coupon.findFirst({ where });
    return { isDuplicate: !!existing };
  }

  /**
   * 쿠폰 목록 조회
   */
  async getCoupons(params: GetCouponsParams) {
    const {
      search,
      discountType,
      scopeType,
      isActive,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      page = 1,
      limit = 10,
    } = params;

    const where: any = {};

    // 검색어 필터
    if (search) {
      where.OR = [
        { name: { contains: search } },
        { code: { contains: search } },
        { description: { contains: search } },
      ];
    }

    // 할인 타입 필터
    if (discountType) {
      where.discountType = discountType;
    }

    // 적용 범위 필터
    if (scopeType) {
      where.scopeType = scopeType;
    }

    // 활성화 상태 필터
    if (isActive !== undefined) {
      where.isActive = isActive;
    }

    // 정렬 설정
    const orderBy: any = {};
    if (sortBy) {
      orderBy[sortBy] = sortOrder;
    }

    // 전체 개수 조회
    const total = await this.prisma.coupon.count({ where });

    // 목록 조회
    const coupons = await this.prisma.coupon.findMany({
      where,
      orderBy,
      skip: (page - 1) * limit,
      take: limit,
      include: {
        product: {
          select: { id: true, name: true },
        },
        couponProducts: {
          include: {
            product: { select: { id: true, name: true } },
          },
        },
        _count: {
          select: { userCoupons: true },
        },
      },
    });

    // 각 쿠폰별 사용자쿠폰 상태별 통계
    const couponsWithStats = await Promise.all(
      coupons.map(async (coupon) => {
        const statusCounts = await this.prisma.userCoupon.groupBy({
          by: ['status'],
          where: { couponId: coupon.id },
          _count: true,
        });

        const stats = {
          total: coupon._count.userCoupons,
          active: 0,
          used: 0,
          expired: 0,
        };

        statusCounts.forEach((item) => {
          if (item.status === 'ACTIVE') stats.active = item._count;
          else if (item.status === 'USED') stats.used = item._count;
          else if (item.status === 'EXPIRED') stats.expired = item._count;
        });

        return {
          ...coupon,
          issuedStats: stats,
        };
      }),
    );

    return {
      items: couponsWithStats,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 쿠폰 통계 조회
   */
  async getCouponStats() {
    const totalCoupons = await this.prisma.coupon.count();
    const activeCoupons = await this.prisma.coupon.count({
      where: { isActive: true },
    });

    const totalIssuedCoupons = await this.prisma.userCoupon.count();

    const userCouponsByStatus = await this.prisma.userCoupon.groupBy({
      by: ['status'],
      _count: true,
    });

    const statusStats = {
      active: 0,
      used: 0,
      expired: 0,
    };

    userCouponsByStatus.forEach((item) => {
      if (item.status === 'ACTIVE') statusStats.active = item._count;
      else if (item.status === 'USED') statusStats.used = item._count;
      else if (item.status === 'EXPIRED') statusStats.expired = item._count;
    });

    return {
      totalCoupons,
      activeCoupons,
      inactiveCoupons: totalCoupons - activeCoupons,
      totalIssuedCoupons,
      ...statusStats,
    };
  }

  /**
   * 쿠폰 상세 조회
   */
  async getCouponById(id: number) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
      include: {
        product: {
          select: { id: true, name: true },
        },
        couponProducts: {
          include: {
            product: { select: { id: true, name: true } },
          },
        },
        _count: {
          select: { userCoupons: true },
        },
      },
    });

    if (!coupon) {
      throw new NotFoundException('쿠폰을 찾을 수 없습니다.');
    }

    // 상태별 통계
    const statusCounts = await this.prisma.userCoupon.groupBy({
      by: ['status'],
      where: { couponId: id },
      _count: true,
    });

    const issuedStats = {
      total: coupon._count.userCoupons,
      active: 0,
      used: 0,
      expired: 0,
    };

    statusCounts.forEach((item) => {
      if (item.status === 'ACTIVE') issuedStats.active = item._count;
      else if (item.status === 'USED') issuedStats.used = item._count;
      else if (item.status === 'EXPIRED') issuedStats.expired = item._count;
    });

    return {
      ...coupon,
      issuedStats,
    };
  }

  /**
   * 쿠폰 생성
   */
  async createCoupon(dto: any) {
    const {
      code,
      name,
      description,
      discountType,
      discountValue,
      maxDiscountAmount,
      scopeType,
      categoryCode,
      productId,
      productIds,
      validHours,
      isActive,
      imageUrl,
    } = dto;

    // 코드 중복 체크
    if (code) {
      const existing = await this.prisma.coupon.findUnique({
        where: { code },
      });
      if (existing) {
        throw new BadRequestException('이미 사용 중인 쿠폰 코드입니다.');
      }
    }

    const now = getNowKST();

    const coupon = await this.prisma.coupon.create({
      data: {
        code: code || null,
        name,
        description,
        discountType,
        discountValue,
        maxDiscountAmount,
        scopeType: scopeType || 'PRODUCT',
        categoryCode,
        productId,
        validHours: validHours || 48,
        isActive: isActive ?? true,
        imageUrl,
        createdAt: now,
      },
    });

    // 다중 상품 연결 (scopeType이 PRODUCT이고 productIds가 있는 경우)
    if (scopeType === 'PRODUCT' && productIds && productIds.length > 0) {
      await this.prisma.couponProduct.createMany({
        data: productIds.map((pid: number) => ({
          couponId: coupon.id,
          productId: pid,
        })),
      });
    }

    return this.getCouponById(coupon.id);
  }

  /**
   * 쿠폰 수정
   */
  async updateCoupon(id: number, dto: any) {
    const existing = await this.prisma.coupon.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('쿠폰을 찾을 수 없습니다.');
    }

    const {
      code,
      name,
      description,
      discountType,
      discountValue,
      maxDiscountAmount,
      scopeType,
      categoryCode,
      productId,
      productIds,
      validHours,
      isActive,
      imageUrl,
    } = dto;

    // 코드 중복 체크 (자기 자신 제외)
    if (code && code !== existing.code) {
      const codeExists = await this.prisma.coupon.findFirst({
        where: { code, id: { not: id } },
      });
      if (codeExists) {
        throw new BadRequestException('이미 사용 중인 쿠폰 코드입니다.');
      }
    }

    await this.prisma.coupon.update({
      where: { id },
      data: {
        code: code || null,
        name,
        description,
        discountType,
        discountValue,
        maxDiscountAmount,
        scopeType,
        categoryCode,
        productId,
        validHours,
        isActive,
        imageUrl,
      },
    });

    // 다중 상품 연결 업데이트
    if (scopeType === 'PRODUCT' && productIds !== undefined) {
      // 기존 연결 삭제
      await this.prisma.couponProduct.deleteMany({
        where: { couponId: id },
      });

      // 새 연결 생성
      if (productIds && productIds.length > 0) {
        await this.prisma.couponProduct.createMany({
          data: productIds.map((pid: number) => ({
            couponId: id,
            productId: pid,
          })),
        });
      }
    }

    return this.getCouponById(id);
  }

  /**
   * 쿠폰 삭제
   */
  async deleteCoupon(id: number) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
      include: {
        _count: { select: { userCoupons: true } },
      },
    });

    if (!coupon) {
      throw new NotFoundException('쿠폰을 찾을 수 없습니다.');
    }

    // 발급된 쿠폰이 있으면 삭제 불가
    if (coupon._count.userCoupons > 0) {
      throw new BadRequestException(
        '발급된 쿠폰이 있어 삭제할 수 없습니다. 비활성화를 사용해주세요.',
      );
    }

    await this.prisma.coupon.delete({
      where: { id },
    });

    return { success: true, message: '쿠폰이 삭제되었습니다.' };
  }

  /**
   * 쿠폰 활성화/비활성화 토글
   */
  async toggleCouponActive(id: number) {
    const coupon = await this.prisma.coupon.findUnique({
      where: { id },
    });

    if (!coupon) {
      throw new NotFoundException('쿠폰을 찾을 수 없습니다.');
    }

    const updated = await this.prisma.coupon.update({
      where: { id },
      data: { isActive: !coupon.isActive },
    });

    return {
      success: true,
      isActive: updated.isActive,
      message: updated.isActive ? '쿠폰이 활성화되었습니다.' : '쿠폰이 비활성화되었습니다.',
    };
  }

  /**
   * 사용자 쿠폰 발급 내역 조회
   */
  async getIssuedCoupons(couponId: number, params: GetIssuedCouponsParams) {
    const { status, page = 1, limit = 10 } = params;

    const coupon = await this.prisma.coupon.findUnique({
      where: { id: couponId },
    });

    if (!coupon) {
      throw new NotFoundException('쿠폰을 찾을 수 없습니다.');
    }

    const where: any = { couponId };

    if (status) {
      where.status = status;
    }

    const total = await this.prisma.userCoupon.count({ where });

    const userCoupons = await this.prisma.userCoupon.findMany({
      where,
      orderBy: { issuedAt: 'desc' },
      skip: (page - 1) * limit,
      take: limit,
      include: {
        user: {
          select: { id: true, name: true, mobile: true },
        },
        usedOrder: {
          select: { id: true, orderNumber: true },
        },
      },
    });

    return {
      items: userCoupons,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
