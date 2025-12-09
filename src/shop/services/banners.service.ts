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

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 활성화된 배너 목록 조회
   * 현재 날짜 기준으로 표시 가능한 배너만 반환
   *
   * @param bannerType 배너 타입 (SHOP, HOME, EVENT 등) - 선택사항
   * @param userStatus 유저 상태 (NEWCOMER, CHALLENGER, SUBSCRIBER) - 선택사항
   * @returns 배너 목록 (sortOrder 기준 정렬)
   */
  async getActiveBanners(bannerType?: string, userStatus?: string): Promise<BannerDto[]> {
    this.logger.log(`활성 배너 조회 시작 (타입: ${bannerType || '전체'}, 유저상태: ${userStatus || '전체'})`);

    const now = getNowKST();

    const banners = await this.prisma.banner.findMany({
      where: {
        isActive: true,
        ...(bannerType && { bannerType }), // bannerType이 있으면 필터 추가
        OR: [
          // startDate, endDate 모두 null인 경우 (무제한 노출)
          {
            AND: [
              { startDate: null },
              { endDate: null }
            ]
          },
          // startDate만 설정된 경우 (종료일 없음)
          {
            AND: [
              { startDate: { lte: now } },
              { endDate: null }
            ]
          },
          // endDate만 설정된 경우 (시작일 없음)
          {
            AND: [
              { startDate: null },
              { endDate: { gte: now } }
            ]
          },
          // startDate, endDate 둘 다 설정된 경우
          {
            AND: [
              { startDate: { lte: now } },
              { endDate: { gte: now } }
            ]
          }
        ]
      },
      orderBy: {
        sortOrder: 'asc'
      },
      select: {
        id: true,
        bannerType: true,
        title: true,
        imageUrl: true,
        linkUrl: true,
        linkType: true,
        description: true,
        targetStatuses: true
      }
    });

    // userStatus 필터링 (빈 배열 = 전체 공개, 배열에 포함되면 노출)
    const filteredBanners = userStatus
      ? banners.filter((b: typeof banners[0]) => b.targetStatuses.length === 0 || b.targetStatuses.includes(userStatus))
      : banners;

    this.logger.log(`활성 배너 ${filteredBanners.length}개 조회 완료 (전체: ${banners.length}개)`);

    // targetStatuses 필드 제거 후 반환
    return filteredBanners.map(({ targetStatuses, ...rest }) => rest);
  }
}
