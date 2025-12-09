import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { BannerDto } from '../dto/banner.dto';
import { getNowKST } from '../../common/utils/kst-date.util';

/**
 * 배너 서비스
 * 배너 조회 로직을 담당
 */
@Injectable()
export class BannersService {
  private readonly logger = new Logger(BannersService.name);

  // 메모리 캐시 (TTL 60초)
  private cache: { data: any[]; expiry: number } | null = null;
  private readonly CACHE_TTL = 60 * 1000; // 60초

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 활성화된 배너 목록 조회
   * 현재 날짜 기준으로 표시 가능한 배너만 반환
   * 메모리 캐시 사용 (60초 TTL)
   *
   * @param bannerType 배너 타입 (SHOP, HOME, EVENT 등) - 선택사항
   * @param userStatus 유저 상태 (NEWCOMER, CHALLENGER, SUBSCRIBER) - 선택사항
   * @returns 배너 목록 (sortOrder 기준 정렬)
   */
  async getActiveBanners(bannerType?: string, userStatus?: string): Promise<BannerDto[]> {
    // 캐시에서 전체 배너 조회
    const allBanners = await this.getAllBannersFromCache();

    // bannerType 필터링
    let filteredBanners = bannerType
      ? allBanners.filter((b) => b.bannerType === bannerType)
      : allBanners;

    // userStatus 필터링 (빈 배열 = 전체 공개, 배열에 포함되면 노출)
    filteredBanners = userStatus
      ? filteredBanners.filter((b) => b.targetStatuses.length === 0 || b.targetStatuses.includes(userStatus))
      : filteredBanners;

    // targetStatuses 필드 제거 후 반환
    return filteredBanners.map(({ targetStatuses, ...rest }) => rest);
  }

  /**
   * 캐시에서 전체 배너 조회 (없으면 DB에서 가져와서 캐싱)
   */
  private async getAllBannersFromCache(): Promise<any[]> {
    const now = Date.now();

    // 캐시 히트
    if (this.cache && this.cache.expiry > now) {
      return this.cache.data;
    }

    // 캐시 미스 - DB 조회
    const nowKST = getNowKST();
    const banners = await this.prisma.banner.findMany({
      where: {
        isActive: true,
        OR: [
          { AND: [{ startDate: null }, { endDate: null }] },
          { AND: [{ startDate: { lte: nowKST } }, { endDate: null }] },
          { AND: [{ startDate: null }, { endDate: { gte: nowKST } }] },
          { AND: [{ startDate: { lte: nowKST } }, { endDate: { gte: nowKST } }] },
        ],
      },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        bannerType: true,
        title: true,
        imageUrl: true,
        linkUrl: true,
        linkType: true,
        description: true,
        targetStatuses: true,
      },
    });

    // 캐시 저장
    this.cache = { data: banners, expiry: now + this.CACHE_TTL };
    this.logger.log(`배너 캐시 갱신 (${banners.length}개, TTL: 60초)`);

    return banners;
  }
}
