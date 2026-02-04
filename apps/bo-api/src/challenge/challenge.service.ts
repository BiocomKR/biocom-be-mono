import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { getNowKST } from '../common/utils/kst-date.util';
import { ProductStatus, UserChallengeStatus } from '../common/enums';

/**
 * 백오피스 챌린지 관리 서비스
 */
@Injectable()
export class ChallengeService {
  private readonly logger = new Logger(ChallengeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 챌린지 상품 여부 확인
   */
  private isChallengeProduct(product: any): boolean {
    return product.categoryCode === 'CHALLENGE';
  }

  /**
   * Product.metadata에서 챌린지 정보 추출
   */
  private extractChallengeInfo(product: any) {
    const metadata = (product.metadata as any) || {};
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      totalDays: metadata.totalDays || 21,
      isActive: product.status === ProductStatus.ACTIVE
    };
  }

  /**
   * 모든 챌린지 조회
   */
  async findAllChallenges(options: {
    page: number;
    limit: number;
    status?: string;
    search?: string;
  }) {
    const { page, limit, status, search } = options;
    const skip = (page - 1) * limit;

    const where: any = {
      categoryCode: 'CHALLENGE'
    };

    if (status === 'active') where.status = ProductStatus.ACTIVE;
    if (status === 'inactive') where.status = ProductStatus.INACTIVE;

    if (search) {
      where.OR = [
        { name: { contains: search, mode: 'insensitive' } },
        { description: { contains: search, mode: 'insensitive' } }
      ];
    }

    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        include: {
          _count: {
            select: {
              userChallenges: true,
              challengeMissions: true,
              challengeSurveys: true,
              challengeContents: true
            }
          }
        },
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.product.count({ where })
    ]);

    const challenges = products.map(p => ({
      ...p,
      ...this.extractChallengeInfo(p),
      _count: p._count
    }));

    return {
      challenges,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * 특정 챌린지 상세 조회
   */
  async findChallengeById(id: number) {
    const product = await this.prisma.product.findUnique({
      where: { id },
      include: {
        challengeMissions: {
          include: { mission: true },
          orderBy: { day: 'asc' }
        },
        challengeSurveys: {
          include: { survey: true },
          orderBy: { day: 'asc' }
        },
        contents: {
          orderBy: { sortOrder: 'asc' }
        },
        _count: {
          select: { userChallenges: true }
        }
      }
    });

    if (!product) {
      throw new NotFoundException('챌린지를 찾을 수 없습니다');
    }

    if (!this.isChallengeProduct(product)) {
      throw new BadRequestException('챌린지 상품이 아닙니다');
    }

    return {
      ...product,
      ...this.extractChallengeInfo(product)
    };
  }

  /**
   * 새 챌린지 생성
   */
  async createChallenge(data: {
    name: string;
    description?: string;
    totalDays: number;
    price: number;
    categoryCode?: string;
    categoryName?: string;
    isActive?: boolean;
  }) {
    return await this.prisma.product.create({
      data: {
        sku: `CHALLENGE-${Date.now()}`,
        name: data.name,
        description: data.description,
        productType: 'SINGLE',
        status: data.isActive ? ProductStatus.ACTIVE : ProductStatus.INACTIVE,
        categoryCode: data.categoryCode || 'CHALLENGE',
        categoryName: data.categoryName || '챌린지',
        price: data.price,
        createdAt: getNowKST(),
        metadata: {
          totalDays: data.totalDays
        }
      }
    });
  }

  /**
   * 챌린지 수정
   */
  async updateChallenge(id: number, data: {
    name?: string;
    description?: string;
    totalDays?: number;
    price?: number;
    isActive?: boolean;
  }) {
    const product = await this.prisma.product.findUnique({ where: { id } });

    if (!product || !this.isChallengeProduct(product)) {
      throw new NotFoundException('챌린지를 찾을 수 없습니다');
    }

    const existingMetadata = (product.metadata as any) || {};
    const updateData: any = {};

    if (data.name) updateData.name = data.name;
    if (data.description) updateData.description = data.description;
    if (data.price !== undefined) updateData.price = data.price;
    if (data.isActive !== undefined) updateData.status = data.isActive ? ProductStatus.ACTIVE : ProductStatus.INACTIVE;

    if (data.totalDays) {
      updateData.metadata = {
        ...existingMetadata,
        totalDays: data.totalDays
      };
    }

    return await this.prisma.product.update({
      where: { id },
      data: updateData
    });
  }

  /**
   * 챌린지 삭제
   */
  async deleteChallenge(id: number) {
    const participantCount = await this.prisma.userChallenge.count({
      where: { productId: id }
    });

    if (participantCount > 0) {
      throw new BadRequestException('참여자가 있는 챌린지는 삭제할 수 없습니다');
    }

    // Soft delete: isActive = false (연관 데이터는 유지)
    await this.prisma.product.update({
      where: { id },
      data: { isActive: false }
    });
  }

  /**
   * 챌린지 통계 조회
   */
  async getChallengeStats(productId: number) {
    const [
      product,
      totalParticipants,
      activeParticipants,
      completedParticipants,
      totalMissions,
      totalSurveys,
      totalContents
    ] = await Promise.all([
      this.prisma.product.findUnique({ where: { id: productId } }),
      this.prisma.userChallenge.count({ where: { productId } }),
      this.prisma.userChallenge.count({ where: { productId, status: UserChallengeStatus.ACTIVE } }),
      this.prisma.userChallenge.count({ where: { productId, status: UserChallengeStatus.COMPLETED } }),
      this.prisma.challengeMission.count({ where: { productId, isActive: true } }),
      this.prisma.challengeSurvey.count({ where: { productId, isActive: true } }),
      this.prisma.content.count({ where: { challengeId: productId, isActive: true } })
    ]);

    if (!product || !this.isChallengeProduct(product)) {
      throw new NotFoundException('챌린지를 찾을 수 없습니다');
    }

    const challengeInfo = this.extractChallengeInfo(product);

    return {
      challenge: challengeInfo,
      stats: {
        participants: {
          total: totalParticipants,
          active: activeParticipants,
          completed: completedParticipants,
          dropped: totalParticipants - activeParticipants - completedParticipants,
          completionRate: totalParticipants > 0 ? Math.round((completedParticipants / totalParticipants) * 100) : 0
        },
        content: {
          missions: totalMissions,
          surveys: totalSurveys,
          contents: totalContents,
          total: totalMissions + totalSurveys + totalContents
        }
      }
    };
  }

  /**
   * 챌린지 활성/비활성 전환
   * 주의: Active 챌린지는 단 하나만 존재할 수 있음
   * 다른 챌린지를 활성화하면 기존 Active 챌린지는 자동으로 비활성화됨
   */
  async toggleChallengeStatus(productId: number) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product || !this.isChallengeProduct(product)) {
      throw new NotFoundException('챌린지를 찾을 수 없습니다');
    }

    const newStatus = product.status === ProductStatus.ACTIVE ? ProductStatus.INACTIVE : ProductStatus.ACTIVE;

    // Active로 전환하는 경우: 기존 Active 챌린지를 먼저 비활성화
    if (newStatus === ProductStatus.ACTIVE) {
      await this.prisma.product.updateMany({
        where: {
          categoryCode: 'CHALLENGE',
          status: ProductStatus.ACTIVE,
          id: { not: productId }
        },
        data: { status: ProductStatus.INACTIVE }
      });
      this.logger.log(`기존 Active 챌린지 비활성화 완료 (새로운 Active: ${productId})`);
    }

    return await this.prisma.product.update({
      where: { id: productId },
      data: { status: newStatus }
    });
  }

  /**
   * 챌린지 참여자 목록 조회
   */
  async getChallengeParticipants(options: {
    productId: number;
    page: number;
    limit: number;
    status?: string;
  }) {
    const { productId, page, limit, status } = options;
    const skip = (page - 1) * limit;

    const where: any = { productId };
    if (status) where.status = status;

    const [participants, total] = await Promise.all([
      this.prisma.userChallenge.findMany({
        where,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              mobile: true
            }
          }
        },
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' }
      }),
      this.prisma.userChallenge.count({ where })
    ]);

    return {
      participants,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    };
  }

  /**
   * 챌린지에 미션 추가
   */
  async addMissionToChallenge(productId: number, data: {
    missionId: number;
    day: number;
    requiredCount?: number;
    points?: number;
    isActive?: boolean;
  }) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product || !this.isChallengeProduct(product)) {
      throw new NotFoundException('챌린지를 찾을 수 없습니다');
    }

    return await this.prisma.challengeMission.create({
      data: {
        productId,
        missionId: data.missionId,
        day: data.day,
        requiredCount: data.requiredCount || 1,
        points: data.points || 100,
        isActive: data.isActive ?? true,
        createdAt: getNowKST()
      },
      include: { mission: true }
    });
  }

  /**
   * 챌린지에 설문 추가
   */
  async addSurveyToChallenge(productId: number, data: {
    surveyId: number;
    day: number;
    points?: number;
    isActive?: boolean;
  }) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product || !this.isChallengeProduct(product)) {
      throw new NotFoundException('챌린지를 찾을 수 없습니다');
    }

    return await this.prisma.challengeSurvey.create({
      data: {
        productId,
        surveyId: data.surveyId,
        day: data.day,
        points: data.points || 50,
        isActive: data.isActive ?? true,
        createdAt: getNowKST()
      },
      include: { survey: true }
    });
  }

  /**
   * 챌린지에 컨텐츠 연결 (Content.challengeId 업데이트)
   */
  async addContentToChallenge(productId: number, data: {
    contentId: number;
    weekNumber?: number;
  }) {
    const product = await this.prisma.product.findUnique({ where: { id: productId } });
    if (!product || !this.isChallengeProduct(product)) {
      throw new NotFoundException('챌린지를 찾을 수 없습니다');
    }

    return await this.prisma.content.update({
      where: { id: data.contentId },
      data: {
        challengeId: productId,
        weekNumber: data.weekNumber ?? null,
      }
    });
  }
}
