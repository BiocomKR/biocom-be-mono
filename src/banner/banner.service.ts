import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { Prisma } from '@prisma/client';
import { getNowKST } from '../common/utils/kst-date.util';

@Injectable()
export class BannerService {
  private readonly logger = new Logger(BannerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 배너 목록 조회
   */
  async getBanners(params: {
    bannerType?: string;
    isActive?: boolean;
    search?: string;
    sortBy?: string;
    sortOrder?: 'asc' | 'desc';
    page: number;
    limit: number;
  }) {
    const { bannerType, isActive, search, sortBy, sortOrder, page, limit } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.BannerWhereInput = {};
    if (bannerType) where.bannerType = bannerType;
    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.OR = [
        { title: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } },
      ];
    }

    // 정렬 설정 (기본: bannerType asc → sortOrder asc)
    let orderBy: Prisma.BannerOrderByWithRelationInput[] = [
      { bannerType: 'asc' },
      { sortOrder: 'asc' },
    ];
    if (sortBy) {
      const order = sortOrder || 'asc';
      switch (sortBy) {
        case 'title': orderBy = [{ title: order }]; break;
        case 'sortOrder': orderBy = [{ bannerType: 'asc' }, { sortOrder: order }]; break;
        case 'createdAt': orderBy = [{ createdAt: order }]; break;
        case 'startDate': orderBy = [{ startDate: order }]; break;
        default: orderBy = [{ bannerType: 'asc' }, { sortOrder: 'asc' }];
      }
    }

    const [banners, total] = await Promise.all([
      this.prisma.banner.findMany({
        where,
        skip,
        take: limit,
        orderBy,
      }),
      this.prisma.banner.count({ where }),
    ]);

    return {
      items: banners,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 배너 상세 조회
   */
  async getBannerById(id: number) {
    const banner = await this.prisma.banner.findUnique({
      where: { id },
    });

    if (!banner) {
      throw new NotFoundException('배너를 찾을 수 없습니다');
    }

    return banner;
  }

  /**
   * 배너 생성
   */
  async createBanner(dto: {
    title: string;
    imageUrl: string;
    linkUrl?: string;
    linkType?: string;
    description?: string;
    sortOrder?: number;
    isActive?: boolean;
    startDate?: Date;
    endDate?: Date;
    bannerType?: string;
    targetStatuses?: string[];
  }) {
    const banner = await this.prisma.banner.create({
      data: {
        title: dto.title,
        imageUrl: dto.imageUrl,
        linkUrl: dto.linkUrl,
        linkType: dto.linkType || 'INTERNAL',
        description: dto.description,
        sortOrder: dto.sortOrder ?? 0,
        isActive: dto.isActive ?? true,
        startDate: dto.startDate,
        endDate: dto.endDate,
        bannerType: dto.bannerType || 'HOME',
        targetStatuses: dto.targetStatuses ?? [],
        createdAt: getNowKST(),
      },
    });

    this.logger.log(`배너 생성: ${banner.title} (ID: ${banner.id})`);

    return banner;
  }

  /**
   * 배너 수정
   */
  async updateBanner(
    id: number,
    dto: {
      title?: string;
      imageUrl?: string;
      linkUrl?: string;
      linkType?: string;
      description?: string;
      sortOrder?: number;
      isActive?: boolean;
      startDate?: Date;
      endDate?: Date;
      bannerType?: string;
      targetStatuses?: string[];
    },
  ) {
    const existing = await this.prisma.banner.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('배너를 찾을 수 없습니다');
    }

    const banner = await this.prisma.banner.update({
      where: { id },
      data: dto,
    });

    this.logger.log(`배너 수정: ${banner.title} (ID: ${id})`);

    return banner;
  }

  /**
   * 배너 삭제
   */
  async deleteBanner(id: number) {
    const existing = await this.prisma.banner.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('배너를 찾을 수 없습니다');
    }

    await this.prisma.banner.delete({ where: { id } });

    this.logger.log(`배너 삭제: ID ${id}`);

    return { success: true };
  }

  /**
   * 배너 활성화/비활성화 토글
   */
  async toggleBannerActive(id: number) {
    const existing = await this.prisma.banner.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException('배너를 찾을 수 없습니다');
    }

    const banner = await this.prisma.banner.update({
      where: { id },
      data: { isActive: !existing.isActive },
    });

    this.logger.log(`배너 활성화 토글: ${banner.title} -> ${banner.isActive}`);

    return banner;
  }

  /**
   * 배너 정렬 순서 일괄 변경
   */
  async updateBannerOrders(orders: { id: number; sortOrder: number }[]) {
    await this.prisma.$transaction(
      orders.map((order) =>
        this.prisma.banner.update({
          where: { id: order.id },
          data: { sortOrder: order.sortOrder },
        }),
      ),
    );

    this.logger.log(`배너 정렬 순서 변경: ${orders.length}개`);

    return { success: true };
  }
}
