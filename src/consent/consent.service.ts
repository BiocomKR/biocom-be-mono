import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';

export interface CreateConsentDto {
  code: string;
  title: string;
  content?: string;
  version: string;
  category: string;
  isRequired: boolean;
  displayOrder?: number;
}

export interface UpdateConsentDto {
  title?: string;
  content?: string;
  isRequired?: boolean;
  displayOrder?: number;
}

@Injectable()
export class ConsentService {
  private readonly logger = new Logger(ConsentService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 약관 목록 조회 (페이징, 필터링)
   */
  async getConsentsWithPagination(
    page: number,
    limit: number,
    filters: {
      search?: string;
      code?: string;
      category?: string;
      isActive?: boolean;
      isRequired?: boolean;
      includeDeleted?: boolean;
    },
    sort: { sortBy: string; sortOrder: 'asc' | 'desc' },
  ) {
    const skip = (page - 1) * limit;

    const where: any = {};

    // 삭제된 약관 포함 여부
    if (!filters.includeDeleted) {
      where.deletedAt = null;
    }

    // 검색어
    if (filters.search) {
      where.OR = [
        { code: { contains: filters.search, mode: 'insensitive' } },
        { title: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    // 코드 필터
    if (filters.code) {
      where.code = filters.code;
    }

    // 카테고리 필터
    if (filters.category) {
      where.category = filters.category;
    }

    // 활성 여부
    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    // 필수 여부
    if (filters.isRequired !== undefined) {
      where.isRequired = filters.isRequired;
    }

    const orderBy: any = {};
    orderBy[sort.sortBy] = sort.sortOrder;

    const [items, total] = await Promise.all([
      this.prisma.consent.findMany({
        where,
        orderBy,
        skip,
        take: limit,
      }),
      this.prisma.consent.count({ where }),
    ]);

    return {
      items,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }

  /**
   * 약관 상세 조회
   */
  async getConsentById(id: number) {
    const consent = await this.prisma.consent.findUnique({
      where: { id },
      include: {
        _count: {
          select: { userConsents: true },
        },
      },
    });

    if (!consent) {
      throw new NotFoundException(`ID ${id}인 약관을 찾을 수 없습니다.`);
    }

    return consent;
  }

  /**
   * 약관 생성
   */
  async createConsent(dto: CreateConsentDto) {
    this.logger.log(`약관 생성: ${dto.code} v${dto.version}`);

    // 중복 확인
    const existing = await this.prisma.consent.findFirst({
      where: {
        code: dto.code,
        version: dto.version,
      },
    });

    if (existing) {
      throw new BadRequestException(`${dto.code} v${dto.version} 약관이 이미 존재합니다.`);
    }

    const consent = await this.prisma.consent.create({
      data: {
        code: dto.code,
        title: dto.title,
        content: dto.content,
        version: dto.version,
        category: dto.category,
        isRequired: dto.isRequired,
        isActive: false, // 생성 시 비활성
        displayOrder: dto.displayOrder ?? 0,
      },
    });

    return consent;
  }

  /**
   * 약관 수정
   */
  async updateConsent(id: number, dto: UpdateConsentDto) {
    this.logger.log(`약관 수정: ID ${id}`);

    const existing = await this.prisma.consent.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`ID ${id}인 약관을 찾을 수 없습니다.`);
    }

    if (existing.deletedAt) {
      throw new BadRequestException('삭제된 약관은 수정할 수 없습니다.');
    }

    const consent = await this.prisma.consent.update({
      where: { id },
      data: dto,
    });

    return consent;
  }

  /**
   * 약관 삭제 (soft delete)
   */
  async deleteConsent(id: number) {
    this.logger.log(`약관 삭제: ID ${id}`);

    const existing = await this.prisma.consent.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`ID ${id}인 약관을 찾을 수 없습니다.`);
    }

    // 해당 코드의 모든 버전 삭제
    await this.prisma.consent.updateMany({
      where: { code: existing.code },
      data: {
        deletedAt: new Date(),
        isActive: false,
      },
    });

    return { message: `${existing.code} 약관이 삭제되었습니다.` };
  }

  /**
   * 약관 버전 활성화
   * 같은 코드의 다른 버전은 비활성화
   */
  async activateConsent(id: number) {
    this.logger.log(`약관 활성화: ID ${id}`);

    const consent = await this.prisma.consent.findUnique({
      where: { id },
    });

    if (!consent) {
      throw new NotFoundException(`ID ${id}인 약관을 찾을 수 없습니다.`);
    }

    if (consent.deletedAt) {
      throw new BadRequestException('삭제된 약관은 활성화할 수 없습니다.');
    }

    // 트랜잭션으로 처리
    await this.prisma.$transaction(async (tx: any) => {
      // 같은 코드의 기존 활성 버전 비활성화
      await tx.consent.updateMany({
        where: {
          code: consent.code,
          isActive: true,
        },
        data: { isActive: false },
      });

      // 선택한 버전 활성화
      await tx.consent.update({
        where: { id },
        data: { isActive: true },
      });
    });

    return await this.getConsentById(id);
  }

  /**
   * 새 버전 생성 (기존 버전 복제 후 활성화)
   */
  async createNewVersion(id: number, newVersion: string) {
    this.logger.log(`약관 새 버전 생성: ID ${id} -> v${newVersion}`);

    const existing = await this.prisma.consent.findUnique({
      where: { id },
    });

    if (!existing) {
      throw new NotFoundException(`ID ${id}인 약관을 찾을 수 없습니다.`);
    }

    // 중복 확인
    const versionExists = await this.prisma.consent.findFirst({
      where: {
        code: existing.code,
        version: newVersion,
      },
    });

    if (versionExists) {
      throw new BadRequestException(`${existing.code} v${newVersion} 버전이 이미 존재합니다.`);
    }

    // 트랜잭션으로 새 버전 생성 및 활성화
    const newConsent = await this.prisma.$transaction(async (tx: any) => {
      // 기존 활성 버전 비활성화
      await tx.consent.updateMany({
        where: {
          code: existing.code,
          isActive: true,
        },
        data: { isActive: false },
      });

      // 새 버전 생성 (활성화)
      return tx.consent.create({
        data: {
          code: existing.code,
          title: existing.title,
          content: existing.content,
          version: newVersion,
          category: existing.category,
          isRequired: existing.isRequired,
          isActive: true,
          displayOrder: existing.displayOrder,
        },
      });
    });

    return newConsent;
  }

  /**
   * 특정 약관의 버전 목록 조회
   */
  async getConsentVersions(code: string) {
    const versions = await this.prisma.consent.findMany({
      where: {
        code,
        deletedAt: null,
      },
      orderBy: { createdAt: 'desc' },
      include: {
        _count: {
          select: { userConsents: true },
        },
      },
    });

    return versions;
  }

  /**
   * 약관 동의 현황 통계 조회
   */
  async getConsentStatistics() {
    this.logger.log('약관 동의 현황 통계 조회');

    // 전체 사용자 수
    const totalUsers = await this.prisma.user.count({
      where: { deletedAt: null },
    });

    // 활성 약관 목록 조회
    const activeConsents = await this.prisma.consent.findMany({
      where: {
        isActive: true,
        deletedAt: null,
      },
      orderBy: { displayOrder: 'asc' },
    });

    // 각 약관별 동의 통계
    const consentStats = await Promise.all(
      activeConsents.map(async (consent) => {
        const agreedCount = await this.prisma.userConsent.count({
          where: {
            consentId: consent.id,
            isAgreed: true,
          },
        });

        return {
          id: consent.id,
          code: consent.code,
          title: consent.title,
          version: consent.version,
          isRequired: consent.isRequired,
          agreedCount,
          rate: totalUsers > 0
            ? Math.round((agreedCount / totalUsers) * 100 * 100) / 100
            : 0,
        };
      }),
    );

    return {
      summary: {
        totalUsers,
        totalConsents: activeConsents.length,
      },
      byConsent: consentStats,
    };
  }

  /**
   * 약관 순서 일괄 변경 (드래그앤드롭)
   * 카테고리 내에서의 순서만 변경
   */
  async reorderConsents(orderedIds: number[], category: string) {
    this.logger.log(`약관 순서 일괄 변경: ${category} 카테고리 - ${orderedIds.join(', ')}`);

    // 해당 카테고리의 약관인지 검증
    const consents = await this.prisma.consent.findMany({
      where: {
        id: { in: orderedIds },
        category,
        deletedAt: null,
      },
    });

    if (consents.length !== orderedIds.length) {
      throw new BadRequestException('유효하지 않은 약관이 포함되어 있습니다.');
    }

    // 트랜잭션으로 해당 카테고리 내 순서만 업데이트
    await this.prisma.$transaction(
      orderedIds.map((id, index) =>
        this.prisma.consent.update({
          where: { id },
          data: { displayOrder: index },
        }),
      ),
    );

    return { success: true };
  }

  /**
   * 약관 동의 목록 조회 (페이징, 필터링)
   */
  async getUserConsentsWithPagination(
    page: number,
    limit: number,
    filters: {
      search?: string;
      consentId?: number;
      isAgreed?: boolean;
      startDate?: string;
      endDate?: string;
    },
    sort: { sortBy: string; sortOrder: 'asc' | 'desc' },
  ) {
    const skip = (page - 1) * limit;

    const where: any = {};

    // 약관 ID 필터
    if (filters.consentId) {
      where.consentId = filters.consentId;
    }

    // 동의 여부 필터
    if (filters.isAgreed !== undefined) {
      where.isAgreed = filters.isAgreed;
    }

    // 날짜 필터
    if (filters.startDate || filters.endDate) {
      where.agreedAt = {};
      if (filters.startDate) {
        where.agreedAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.agreedAt.lte = new Date(filters.endDate + 'T23:59:59');
      }
    }

    // 사용자 검색
    let userIds: number[] | undefined;
    if (filters.search) {
      const users = await this.prisma.user.findMany({
        where: {
          OR: [
            { name: { contains: filters.search, mode: 'insensitive' } },
            { email: { contains: filters.search, mode: 'insensitive' } },
            { mobile: { contains: filters.search } },
          ],
        },
        select: { id: true },
      });
      userIds = users.map((u: any) => u.id);

      if (userIds.length === 0) {
        return {
          items: [],
          pagination: {
            page,
            limit,
            total: 0,
            totalPages: 0,
          },
        };
      }
      where.userId = { in: userIds };
    }

    const orderBy: any = {};
    const sortField = sort.sortBy === 'agreedAt' ? 'agreedAt' : 'createdAt';
    orderBy[sortField] = sort.sortOrder;

    const [items, total] = await Promise.all([
      this.prisma.userConsent.findMany({
        where,
        orderBy,
        skip,
        take: limit,
        include: {
          consent: {
            select: {
              id: true,
              code: true,
              title: true,
              version: true,
            },
          },
        },
      }),
      this.prisma.userConsent.count({ where }),
    ]);

    // 사용자 정보 조회
    const userIdList = [...new Set(items.map((item: any) => item.userId))];
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIdList } },
      select: { id: true, name: true, email: true, mobile: true },
    });
    const userMap = new Map(users.map((u: any) => [u.id, u]));

    const itemsWithUser = items.map((item: any) => ({
      ...item,
      user: userMap.get(item.userId) || null,
    }));

    return {
      items: itemsWithUser,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    };
  }
}
