import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { Logger } from '@nestjs/common';
import {
  calculateDeliveryDate,
  calculateEndDate,
  formatDateToString,
  parseStringToDate,
  stringToKSTDate
} from './utils/challenge-date.util';
import {
  SetStartDateDto,
  ChallengeScheduleResponseDto
} from './dto/challenge-schedule.dto';
import { UserSubscriptionStatus } from '../common/enums/user-subscription-status.enum';
import { getKoreanNow } from '../common/utils/korea-date.util';
import { getNowKST, calculateChallengeDay } from '../common/utils/kst-date.util';
import { ChallengeTicketStatus, UserChallengeStatus } from '../common/enums/challenge-ticket-status.enum';

/**
 * 챌린지 서비스
 * 챌린지 관련 비즈니스 로직을 처리합니다
 *
 * ⚠️ 중요: Challenge 마스터 테이블이 제거되었습니다
 * - 챌린지는 이제 Product 테이블에 저장됩니다
 * - challengeId는 productId로 변경되었습니다
 * - 챌린지 구분: Product.categoryCode = 'CHALLENGE'
 * - Product.metadata 구조: { totalDays: number }
 */
@Injectable()
export class ChallengeService {
  private readonly logger = new Logger(ChallengeService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 챌린지 상품 여부 확인 헬퍼 함수
   * ⚠️ category_code 기반으로 구분 (metadata가 아닌!)
   * @param product 상품 객체
   */
  private isChallengeProduct(product: any): boolean {
    return product.categoryCode === 'CHALLENGE';
  }

  /**
   * Product.metadata에서 챌린지 정보 추출
   * @param product 상품 객체
   */
  private extractChallengeInfo(product: any) {
    const metadata = (product.metadata as any) || {};
    return {
      id: product.id,
      name: product.name,
      description: product.description,
      totalDays: metadata.totalDays || 21,
      isActive: product.status === 'ACTIVE'
    };
  }

  /**
   * 구매 가능한 챌린지 목록 조회
   * @description 챌린지 타입의 활성 상품들을 조회합니다
   */
  async getAvailableChallenges() {
    try {
      this.logger.log('구매 가능한 챌린지 목록 조회 시작');

      // categoryCode가 CHALLENGE인 상품만 조회
      const products = await this.prisma.product.findMany({
        where: {
          status: 'ACTIVE',
          categoryCode: 'CHALLENGE'
        },
        include: {
          options: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      const result = products
        .filter(p => this.isChallengeProduct(p))
        .map(product => {
          const challengeInfo = this.extractChallengeInfo(product);
          return {
            id: challengeInfo.id,
            name: challengeInfo.name,
            description: challengeInfo.description,
            totalDays: challengeInfo.totalDays,
            isActive: challengeInfo.isActive,
            products: [{
              id: product.id,
              name: product.name,
              price: product.options[0]?.price || 0
            }]
          };
        });

      this.logger.log(`구매 가능한 챌린지 ${result.length}개 조회 완료`);
      return { success: true, data: result };
    } catch (error) {
      this.logger.error('구매 가능한 챌린지 목록 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 사용자의 챌린지 수행권 조회
   * @description 구매했지만 아직 활성화하지 않은 이용권 목록을 조회합니다 (PURCHASED 상태만)
   * @param userId 사용자 ID
   */
  async getMyTickets(userId: number) {
    try {
      this.logger.log(`사용자 ${userId}의 챌린지 수행권 조회 시작`);

      const tickets = await this.prisma.challengeTicket.findMany({
        where: {
          userId,
          status: ChallengeTicketStatus.PURCHASED // 활성화 가능한 티켓만
        },
        include: {
          product: true
        },
        orderBy: { purchaseDate: 'desc' }
      });

      const result = tickets
        .filter(ticket => ticket.product && this.isChallengeProduct(ticket.product))
        .map(ticket => {
          const challengeInfo = this.extractChallengeInfo(ticket.product);

          return {
            id: ticket.id,
            challenge: {
              id: challengeInfo.id,
              name: challengeInfo.name,
              description: challengeInfo.description,
              totalDays: challengeInfo.totalDays,
              isActive: challengeInfo.isActive
            },
            purchaseDate: ticket.purchaseDate,
            status: ticket.status
          };
        });

      this.logger.log(`사용자 ${userId}의 활성화 가능한 챌린지 수행권 ${result.length}개 조회 완료`);
      return { success: true, data: result };
    } catch (error) {
      this.logger.error('챌린지 수행권 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 사용자의 현재 활성 챌린지 조회 + 오늘의 활동 통합
   * @param userId 사용자 ID
   */
  async getMyActiveChallenge(userId: number) {
    try {
      this.logger.log(`사용자 ${userId}의 활성 챌린지 + 오늘 활동 조회 시작`);

      const activeChallenge = await this.prisma.userChallenge.findFirst({
        where: {
          userId,
          status: 'ACTIVE'
        },
        include: {
          product: true,
          ticket: true
        }
      });

      if (!activeChallenge) {
        this.logger.log(`사용자 ${userId}의 활성 챌린지 없음`);
        return { success: true, data: null };
      }

      if (!activeChallenge.product || !this.isChallengeProduct(activeChallenge.product)) {
        throw new NotFoundException('챌린지 상품 정보를 찾을 수 없습니다');
      }

      const productId = activeChallenge.productId;
      // activatedAt 기준으로 현재 챌린지 일차 계산
      const currentDay = calculateChallengeDay(activeChallenge.activatedAt);
      const weekNumber = Math.ceil(currentDay / 7);
      const challengeInfo = this.extractChallengeInfo(activeChallenge.product);

      // 오늘의 미션 조회
      const missions = await this.prisma.challengeMission.findMany({
        where: {
          productId,
          day: currentDay,
          isActive: true
        },
        include: { mission: true },
        orderBy: { sortOrder: 'asc' }
      });

      // 오늘의 설문 조회
      const surveys = await this.prisma.challengeSurvey.findMany({
        where: {
          productId,
          day: currentDay,
          isActive: true
        },
        include: {
          survey: {
            include: {
              surveyQuestions: {
                orderBy: { sortOrder: 'asc' }
              }
            }
          }
        }
      });

      // 오늘의 퀴즈 조회
      const quizzes = await this.prisma.challengeQuiz.findMany({
        where: {
          productId,
          day: currentDay,
          isActive: true
        },
        include: { quiz: true },
        orderBy: { sortOrder: 'asc' }
      });

      // ⚠️ 컨텐츠 조회 제거됨
      // - challenge_contents 테이블 제거로 인해 제거
      // - Content.accessLevel 기반 접근 제어로 변경
      // - 컨텐츠는 별도 Content API에서 조회

      // ⚠️ 기록 항목 조회 제거됨
      // - RecordItem 테이블 삭제로 인해 제거
      // - 기록 관련 정보는 missions 테이블(type='RECORD')에서 관리

      const result = {
        // 기본 챌린지 정보
        id: activeChallenge.id,
        challenge: challengeInfo,
        activatedAt: activeChallenge.activatedAt,
        expiresAt: activeChallenge.expiresAt,
        currentDay: activeChallenge.currentDay,
        totalPoints: activeChallenge.totalPoints,
        status: activeChallenge.status,

        // 오늘의 활동 (통합)
        todayActivities: {
          currentDay,
          todayDate: new Date(),
          missions: missions.map(cm => ({
            id: cm.id,
            mission: cm.mission,
            points: cm.points,
            sortOrder: cm.sortOrder
          })),
          surveys: surveys.map(cs => ({
            id: cs.id,
            survey: cs.survey
          })),
          quizzes: quizzes.map(cq => ({
            id: cq.id,
            quiz: cq.quiz,
            sortOrder: cq.sortOrder
          }))
        }
      };

      this.logger.log(`사용자 ${userId}의 활성 챌린지 + 오늘 활동 조회 완료: ${challengeInfo.name} (${currentDay}일차)`);
      this.logger.log(`- 미션 ${missions.length}개, 설문 ${surveys.length}개, 퀴즈 ${quizzes.length}개`);
      return { success: true, data: result };
    } catch (error) {
      this.logger.error('활성 챌린지 + 오늘 활동 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 챌린지 활성화 (수행권 사용)
   * @param userId 사용자 ID
   * @param ticketId 수행권 ID
   */
  async activateChallenge(userId: number, ticketId: number) {
    try {
      this.logger.log(`사용자 ${userId}의 챌린지 활성화 시작 - 수행권 ${ticketId}`);

      return await this.prisma.$transaction(async (tx) => {
        // 1. 이미 활성 챌린지가 있는지 확인
        const existingActive = await tx.userChallenge.findFirst({
          where: { userId, status: 'ACTIVE' }
        });

        if (existingActive) {
          throw new ConflictException('이미 활성화된 챌린지가 있습니다');
        }

        // 2. 수행권 확인
        const ticket = await tx.challengeTicket.findFirst({
          where: {
            id: ticketId,
            userId,
            status: ChallengeTicketStatus.PURCHASED
          },
          include: { product: true }
        });

        if (!ticket) {
          throw new NotFoundException('사용 가능한 수행권을 찾을 수 없습니다');
        }

        // 2-1. 티켓 소유자 재확인 (보안 강화)
        if (ticket.userId !== userId) {
          this.logger.error(`티켓 소유권 불일치 - 티켓 ${ticketId}: 소유자 ${ticket.userId}, 요청자 ${userId}`);
          throw new BadRequestException('본인의 이용권만 사용할 수 있습니다');
        }

        // 2-2. 이 티켓으로 이미 생성된 챌린지가 있는지 확인 (재사용 방지)
        const existingChallengeWithTicket = await tx.userChallenge.findFirst({
          where: { ticketId }
        });

        if (existingChallengeWithTicket) {
          this.logger.error(`티켓 재사용 시도 - 티켓 ${ticketId}는 이미 UserChallenge ${existingChallengeWithTicket.id}에서 사용됨`);
          throw new ConflictException('이미 사용된 이용권입니다');
        }

        if (!ticket.product || !this.isChallengeProduct(ticket.product)) {
          throw new BadRequestException('챌린지 상품이 아닙니다');
        }

        if (ticket.product.status !== 'ACTIVE') {
          throw new BadRequestException('비활성화된 챌린지입니다');
        }

        const challengeInfo = this.extractChallengeInfo(ticket.product);

        // 3. 챌린지 활성화
        const now = new Date();
        const expiresAt = new Date(now.getTime() + challengeInfo.totalDays * 24 * 60 * 60 * 1000);

        const userChallenge = await tx.userChallenge.create({
          data: {
            userId,
            productId: ticket.productId,
            ticketId,
            activatedAt: now,
            expiresAt,
            currentDay: 1,
            status: 'ACTIVE',
            createdAt: getNowKST(),
          },
          include: { product: true }
        });

        // 4. 수행권 상태 변경 및 기간 설정 (KST 기준)
        const startDate = getKoreanNow();
        const endDate = new Date(startDate.getTime() + challengeInfo.totalDays * 24 * 60 * 60 * 1000);

        await tx.challengeTicket.update({
          where: { id: ticketId },
          data: {
            status: ChallengeTicketStatus.ACTIVATED,
            startDate,
            endDate
          }
        });

        // 5. 사용자 구독 상태를 CHALLENGER로 변경 (무조건 CHALLENGER가 최우선)
        await tx.user.update({
          where: { id: userId },
          data: { subscriptionStatus: UserSubscriptionStatus.CHALLENGER }
        });

        // 6. 첫날(Day 1) 진행 상황 생성
        await tx.dailyProgress.create({
          data: {
            userChallengeId: userChallenge.id,
            day: 1,
            date: new Date(now.getFullYear(), now.getMonth(), now.getDate())
          }
        });

        const result = {
          userChallengeId: userChallenge.id,
          challengeName: challengeInfo.name,
          activatedAt: userChallenge.activatedAt,
          expiresAt: userChallenge.expiresAt,
          totalDays: challengeInfo.totalDays,
          currentDay: 1
        };

        this.logger.log(`사용자 ${userId}의 챌린지 활성화 완료: ${challengeInfo.name}, 구독상태: CHALLENGER로 변경`);
        return { success: true, data: result };
      });
    } catch (error) {
      this.logger.error('챌린지 활성화 실패:', error);
      throw error;
    }
  }

  /**
   * 챌린지 진행 상황 조회
   * @param userId 사용자 ID
   * @param productId 챌린지 상품 ID
   */
  async getChallengeProgress(userId: number, productId: number) {
    try {
      this.logger.log(`사용자 ${userId}의 챌린지 ${productId} 진행 상황 조회 시작`);

      const userChallenge = await this.prisma.userChallenge.findFirst({
        where: { userId, productId },
        include: {
          product: true,
          dailyProgress: {
            orderBy: { day: 'asc' }
          }
        }
      });

      if (!userChallenge) {
        throw new NotFoundException('해당 챌린지를 찾을 수 없습니다');
      }

      if (!userChallenge.product || !this.isChallengeProduct(userChallenge.product)) {
        throw new NotFoundException('챌린지 상품 정보를 찾을 수 없습니다');
      }

      const challengeInfo = this.extractChallengeInfo(userChallenge.product);

      const progressData = userChallenge.dailyProgress.map(progress => ({
        day: progress.day,
        date: progress.date,
        missions: {
          total: progress.missionsTotal,
          completed: progress.missionsCompleted
        },
        surveys: {
          total: progress.surveysTotal,
          completed: progress.surveysCompleted
        },
        quizzes: {
          total: progress.quizzesTotal,
          correct: progress.quizzesCorrect
        },
        contents: {
          total: progress.contentsTotal,
          viewed: progress.contentsViewed
        },
        records: {
          total: progress.trackingsTotal,
          completed: progress.trackingsCompleted
        },
        pointsEarned: progress.pointsEarned
      }));

      const result = {
        challenge: challengeInfo,
        activatedAt: userChallenge.activatedAt,
        currentDay: userChallenge.currentDay,
        totalPoints: userChallenge.totalPoints,
        status: userChallenge.status,
        progress: progressData
      };

      this.logger.log(`챌린지 진행 상황 조회 완료 - ${progressData.length}일차 데이터`);
      return { success: true, data: result };
    } catch (error) {
      this.logger.error('챌린지 진행 상황 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 오늘의 챌린지 활동 조회
   * @param userId 사용자 ID
   * @param productId 챌린지 상품 ID
   */
  async getTodayActivities(userId: number, productId: number) {
    try {
      this.logger.log(`사용자 ${userId}의 오늘 활동 조회 시작 - 챌린지 ${productId}`);

      const userChallenge = await this.prisma.userChallenge.findFirst({
        where: { userId, productId, status: 'ACTIVE' },
        include: { product: true }
      });

      if (!userChallenge) {
        throw new NotFoundException('활성화된 챌린지를 찾을 수 없습니다');
      }

      // activatedAt 기준으로 현재 챌린지 일차 계산
      const currentDay = calculateChallengeDay(userChallenge.activatedAt);
      const weekNumber = Math.ceil(currentDay / 7);

      // 오늘의 미션 조회
      const missions = await this.prisma.challengeMission.findMany({
        where: {
          productId,
          day: currentDay,
          isActive: true
        },
        include: { mission: true },
        orderBy: { sortOrder: 'asc' }
      });

      // 오늘의 설문 조회
      const surveys = await this.prisma.challengeSurvey.findMany({
        where: {
          productId,
          day: currentDay,
          isActive: true
        },
        include: { survey: true }
      });

      // 오늘의 퀴즈 조회
      const quizzes = await this.prisma.challengeQuiz.findMany({
        where: {
          productId,
          day: currentDay,
          isActive: true
        },
        include: { quiz: true },
        orderBy: { sortOrder: 'asc' }
      });

      // ⚠️ 컨텐츠 조회 제거됨
      // - challenge_contents 테이블 제거로 인해 제거
      // - Content.accessLevel 기반 접근 제어로 변경
      // - 컨텐츠는 별도 Content API에서 조회

      // ⚠️ 기록 항목 조회 제거됨
      // - RecordItem 테이블 삭제로 인해 제거
      // - 기록 관련 정보는 missions 테이블(type='RECORD')에서 관리

      const result = {
        currentDay,
        todayDate: new Date(),
        missions: missions.map(cm => ({
          id: cm.id,
          mission: cm.mission,
          points: cm.points
        })),
        surveys: surveys.map(cs => ({
          id: cs.id,
          survey: cs.survey
        })),
        quizzes: quizzes.map(cq => ({
          id: cq.id,
          quiz: cq.quiz
        }))
      };

      this.logger.log(`오늘의 활동 조회 완료 - 미션 ${missions.length}개, 설문 ${surveys.length}개, 퀴즈 ${quizzes.length}개`);
      return { success: true, data: result };
    } catch (error) {
      this.logger.error('오늘의 활동 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 챌린지 완료 리포트 조회
   * @param userId 사용자 ID
   * @param productId 챌린지 상품 ID
   */
  async getChallengeReport(userId: number, productId: number) {
    try {
      this.logger.log(`사용자 ${userId}의 챌린지 ${productId} 리포트 조회 시작`);

      const userChallenge = await this.prisma.userChallenge.findFirst({
        where: { userId, productId },
        include: {
          product: true,
          dailyProgress: true
        }
      });

      if (!userChallenge) {
        throw new NotFoundException('해당 챌린지를 찾을 수 없습니다');
      }

      if (userChallenge.status !== 'COMPLETED') {
        throw new BadRequestException('완료되지 않은 챌린지입니다');
      }

      if (!userChallenge.product || !this.isChallengeProduct(userChallenge.product)) {
        throw new NotFoundException('챌린지 상품 정보를 찾을 수 없습니다');
      }

      const challengeInfo = this.extractChallengeInfo(userChallenge.product);

      // 통계 계산
      const totalDays = userChallenge.dailyProgress.length;
      const totalMissions = userChallenge.dailyProgress.reduce((sum, p) => sum + p.missionsTotal, 0);
      const completedMissions = userChallenge.dailyProgress.reduce((sum, p) => sum + p.missionsCompleted, 0);
      const totalPoints = userChallenge.totalPoints;

      const result = {
        challenge: challengeInfo,
        summary: {
          completedDays: totalDays,
          totalMissions,
          completedMissions,
          completionRate: totalMissions > 0 ? Math.round((completedMissions / totalMissions) * 100) : 0,
          totalPoints
        },
        activatedAt: userChallenge.activatedAt,
        completedAt: userChallenge.updatedAt
      };

      this.logger.log(`챌린지 리포트 조회 완료 - 완주률 ${result.summary.completionRate}%`);
      return { success: true, data: result };
    } catch (error) {
      this.logger.error('챌린지 리포트 조회 실패:', error);
      throw error;
    }
  }

  // ==================== 백오피스 관리용 메서드들 ====================

  /**
   * 모든 챌린지 조회 (백오피스용)
   * @description 챌린지 타입의 상품들을 조회합니다
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

    if (status === 'active') where.status = 'ACTIVE';
    if (status === 'inactive') where.status = 'INACTIVE';

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
              challengeQuizzes: true,
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
   * 특정 챌린지 상세 조회 (백오피스용)
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
        challengeQuizzes: {
          include: { quiz: true },
          orderBy: { day: 'asc' }
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
   * 새 챌린지 생성 (백오피스용)
   * @description 챌린지 타입의 상품을 생성합니다
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
        status: data.isActive ? 'ACTIVE' : 'INACTIVE',
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
   * 챌린지 수정 (백오피스용)
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
    if (data.isActive !== undefined) updateData.status = data.isActive ? 'ACTIVE' : 'INACTIVE';

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
   * 챌린지 삭제 (백오피스용)
   */
  async deleteChallenge(id: number) {
    // 참여자가 있는지 확인
    const participantCount = await this.prisma.userChallenge.count({
      where: { productId: id }
    });

    if (participantCount > 0) {
      throw new BadRequestException('참여자가 있는 챌린지는 삭제할 수 없습니다');
    }

    // 관련 데이터 삭제
    await this.prisma.$transaction(async (tx) => {
      await tx.challengeMission.deleteMany({ where: { productId: id } });
      await tx.challengeSurvey.deleteMany({ where: { productId: id } });
      await tx.challengeQuiz.deleteMany({ where: { productId: id } });
      // challengeContent 제거됨 (Content.accessLevel 기반으로 변경)
      await tx.product.delete({ where: { id } });
    });
  }

  /**
   * 챌린지 참여자 목록 조회 (백오피스용)
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
        skip,
        take: limit,
        include: {
          user: {
            select: { id: true, email: true, name: true, points: true }
          },
          product: {
            select: { id: true, name: true }
          },
          _count: {
            select: { dailyProgress: true }
          }
        },
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
   * 챌린지에 미션 추가 (백오피스용)
   */
  async addMissionToChallenge(productId: number, data: {
    missionId: number;
    day: number;
    points?: number;
    isActive?: boolean;
  }) {
    return await this.prisma.challengeMission.create({
      data: {
        productId,
        missionId: data.missionId,
        day: data.day,
        points: data.points || 100,
        isActive: data.isActive ?? true,
        createdAt: getNowKST(),
      },
      include: {
        mission: true
      }
    });
  }

  /**
   * 챌린지에 설문 추가 (백오피스용)
   */
  async addSurveyToChallenge(productId: number, data: {
    surveyId: number;
    day: number;
    isActive?: boolean;
  }) {
    return await this.prisma.challengeSurvey.create({
      data: {
        productId,
        surveyId: data.surveyId,
        day: data.day,
        isActive: data.isActive ?? true,
        createdAt: getNowKST(),
      },
      include: {
        survey: true
      }
    });
  }

  /**
   * 챌린지에 퀴즈 추가 (백오피스용)
   */
  async addQuizToChallenge(productId: number, data: {
    quizId: number;
    day: number;
    isActive?: boolean;
  }) {
    return await this.prisma.challengeQuiz.create({
      data: {
        productId,
        quizId: data.quizId,
        day: data.day,
        isActive: data.isActive ?? true,
        createdAt: getNowKST(),
      },
      include: {
        quiz: true
      }
    });
  }

  /**
   * 챌린지에 컨텐츠 추가 (백오피스용)
   */
  /**
   * ⚠️ 제거됨: 챌린지에 컨텐츠 추가
   * - challenge_contents 테이블 제거로 인해 제거
   * - Content.accessLevel 기반 접근 제어로 변경
   */
  async addContentToChallenge(productId: number, data: {
    contentId: number;
    weekNumber: number;
    isActive?: boolean;
  }) {
    throw new BadRequestException('이 기능은 더 이상 지원되지 않습니다. Content.accessLevel을 사용하세요.');
  }

  /**
   * 챌린지 통계 조회 (백오피스용)
   */
  async getChallengeStats(productId: number) {
    const [
      product,
      totalParticipants,
      activeParticipants,
      completedParticipants,
      totalMissions,
      totalSurveys,
      totalQuizzes
    ] = await Promise.all([
      this.prisma.product.findUnique({ where: { id: productId } }),
      this.prisma.userChallenge.count({ where: { productId } }),
      this.prisma.userChallenge.count({ where: { productId, status: 'ACTIVE' } }),
      this.prisma.userChallenge.count({ where: { productId, status: 'COMPLETED' } }),
      this.prisma.challengeMission.count({ where: { productId, isActive: true } }),
      this.prisma.challengeSurvey.count({ where: { productId, isActive: true } }),
      this.prisma.challengeQuiz.count({ where: { productId, isActive: true } })
    ]);

    // challengeContent 제거됨
    const totalContents = 0;

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
          quizzes: totalQuizzes,
          contents: totalContents,
          total: totalMissions + totalSurveys + totalQuizzes + totalContents
        }
      }
    };
  }

  /**
   * 챌린지 활성/비활성 전환 (백오피스용)
   */
  async toggleChallengeStatus(productId: number) {
    const product = await this.prisma.product.findUnique({
      where: { id: productId }
    });

    if (!product || !this.isChallengeProduct(product)) {
      throw new NotFoundException('챌린지를 찾을 수 없습니다');
    }

    const newStatus = product.status === 'ACTIVE' ? 'INACTIVE' : 'ACTIVE';

    return await this.prisma.product.update({
      where: { id: productId },
      data: { status: newStatus }
    });
  }

  /**
   * 챌린지 설문 전후 비교 조회
   * @param userId 사용자 ID
   * @param productId 챌린지 상품 ID
   */
  async getChallengeSurveyComparison(userId: number, productId: number) {
    this.logger.log(`챌린지 설문 전후 비교 조회 - 사용자: ${userId}, 챌린지: ${productId}`);

    const result = await this.prisma.userChallengeSurveyResult.findUnique({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    });

    if (!result) {
      throw new NotFoundException('챌린지 설문 결과를 찾을 수 없습니다.');
    }

    // Before 동물 캐릭터 정보
    const beforeHealthTypeAnimal = result.beforeHealthType
      ? await this.prisma.healthTypeAnimal.findFirst({
          where: { healthType: result.beforeHealthType },
        })
      : null;

    // After 동물 캐릭터 정보
    const afterHealthTypeAnimal = result.afterHealthType
      ? await this.prisma.healthTypeAnimal.findFirst({
          where: { healthType: result.afterHealthType },
        })
      : null;

    return {
      success: true,
      data: {
        userId,
        productId,
        before: {
          category: result.beforeHealthType,
          animalCharacter: beforeHealthTypeAnimal?.animalName,
          characterKeyword: beforeHealthTypeAnimal?.catchphrase,
          detailedFeatures: beforeHealthTypeAnimal?.symptoms,
          scores: {
            skinHealth: result.beforeScoreSkinHealth,
            metabolism: result.beforeScoreMetabolism,
            immune: result.beforeScoreImmune,
            gutHealth: result.beforeScoreGutHealth,
          },
          completedAt: result.beforeCompletedAt,
        },
        after: result.afterHealthType ? {
          category: result.afterHealthType,
          animalCharacter: afterHealthTypeAnimal?.animalName,
          characterKeyword: afterHealthTypeAnimal?.catchphrase,
          detailedFeatures: afterHealthTypeAnimal?.symptoms,
          scores: {
            skinHealth: result.afterScoreSkinHealth,
            metabolism: result.afterScoreMetabolism,
            immune: result.afterScoreImmune,
            gutHealth: result.afterScoreGutHealth,
          },
          completedAt: result.afterCompletedAt,
        } : null,
        scoreComparison: {
          skinHealth: {
            before: result.beforeScoreSkinHealth || 0,
            after: result.afterScoreSkinHealth || 0,
            change: (result.afterScoreSkinHealth || 0) - (result.beforeScoreSkinHealth || 0),
            improvement: result.beforeScoreSkinHealth
              ? Math.round(((result.afterScoreSkinHealth || 0) - result.beforeScoreSkinHealth) / result.beforeScoreSkinHealth * 100 * 100) / 100
              : 0
          },
          metabolism: {
            before: result.beforeScoreMetabolism || 0,
            after: result.afterScoreMetabolism || 0,
            change: (result.afterScoreMetabolism || 0) - (result.beforeScoreMetabolism || 0),
            improvement: result.beforeScoreMetabolism
              ? Math.round(((result.afterScoreMetabolism || 0) - result.beforeScoreMetabolism) / result.beforeScoreMetabolism * 100 * 100) / 100
              : 0
          },
          immune: {
            before: result.beforeScoreImmune || 0,
            after: result.afterScoreImmune || 0,
            change: (result.afterScoreImmune || 0) - (result.beforeScoreImmune || 0),
            improvement: result.beforeScoreImmune
              ? Math.round(((result.afterScoreImmune || 0) - result.beforeScoreImmune) / result.beforeScoreImmune * 100 * 100) / 100
              : 0
          },
          gutHealth: {
            before: result.beforeScoreGutHealth || 0,
            after: result.afterScoreGutHealth || 0,
            change: (result.afterScoreGutHealth || 0) - (result.beforeScoreGutHealth || 0),
            improvement: result.beforeScoreGutHealth
              ? Math.round(((result.afterScoreGutHealth || 0) - result.beforeScoreGutHealth) / result.beforeScoreGutHealth * 100 * 100) / 100
              : 0
          }
        }
      },
      timestamp: new Date()
    };
  }

  // ==================== 시작일 설정 시스템 ====================

  /**
   * 챌린지 일정 조회
   * @description 사용자의 챌린지 일정 정보를 조회합니다
   * @param userId 사용자 ID
   * @param productId 챌린지 상품 ID
   */
  async getChallengeSchedule(userId: number, productId: number): Promise<{ success: boolean; data: ChallengeScheduleResponseDto }> {
    try {
      this.logger.log(`챌린지 일정 조회 시작 - 사용자: ${userId}, 챌린지: ${productId}`);

      // 사용자 챌린지 확인
      const userChallenge = await this.prisma.userChallenge.findFirst({
        where: { userId, productId },
        include: {
          ticket: {
            include: {
              product: true
            }
          }
        }
      });

      if (!userChallenge) {
        throw new NotFoundException('해당 챌린지를 찾을 수 없습니다');
      }

      const ticket = userChallenge.ticket;

      // ⚠️ challenge_schedules 테이블은 삭제되고 user_challenges로 통합되었음
      // 일정 정보는 이제 userChallenge에 직접 저장됨
      const responseData: ChallengeScheduleResponseDto = {
        id: userChallenge.id,
        startDate: userChallenge.startDate ? formatDateToString(userChallenge.startDate) : null,
        deliveryDate: userChallenge.deliveryDate ? formatDateToString(userChallenge.deliveryDate) : null,
        endDate: userChallenge.endDate ? formatDateToString(userChallenge.endDate) : null,
        isConfirmed: true, // 일정 설정 시 바로 확정됨
        canModify: false,   // 설정 후 수정 불가
        purchasedAt: ticket.purchaseDate,
        createdAt: userChallenge.createdAt
      };

      this.logger.log(`챌린지 일정 조회 완료 - 시작일: ${responseData.startDate}, 확정여부: ${responseData.isConfirmed}`);
      return { success: true, data: responseData };
    } catch (error) {
      this.logger.error('챌린지 일정 조회 실패:', error);
      throw error;
    }
  }

  /**
   * 챌린지 시작일 설정
   * @description 처음으로 시작일을 설정합니다 (아직 설정되지 않은 경우)
   * @param userId 사용자 ID
   * @param productId 챌린지 상품 ID
   * @param setStartDateDto 시작일 설정 데이터
   */
  async setStartDate(userId: number, productId: number, setStartDateDto: SetStartDateDto): Promise<{ success: boolean; data: ChallengeScheduleResponseDto }> {
    try {
      this.logger.log(`챌린지 시작일 설정 시작 - 사용자: ${userId}, 챌린지: ${productId}, 시작일: ${setStartDateDto.startDate}`);

      if (!userId) {
        throw new BadRequestException('사용자 ID가 필요합니다');
      }

      return await this.prisma.$transaction(async (tx) => {
        // 1. 이미 활성 챌린지가 있는지 확인
        const existingActive = await tx.userChallenge.findFirst({
          where: { userId, status: 'ACTIVE' }
        });

        if (existingActive) {
          throw new ConflictException('이미 활성화된 챌린지가 있습니다. 한 번에 하나의 챌린지만 진행할 수 있습니다.');
        }

        // 2. PURCHASED 상태의 티켓 찾기 (동일 상품의 티켓은 1개만 존재)
        const ticket = await tx.challengeTicket.findFirst({
          where: {
            userId,
            productId,
            status: ChallengeTicketStatus.PURCHASED
          }
        });

        if (!ticket) {
          throw new NotFoundException('사용 가능한 챌린지 이용권을 찾을 수 없습니다');
        }

        // 2-1. 티켓 소유자 재확인 (보안 강화)
        if (ticket.userId !== userId) {
          this.logger.error(`티켓 소유권 불일치 - 티켓 ${ticket.id}: 소유자 ${ticket.userId}, 요청자 ${userId}`);
          throw new BadRequestException('본인의 이용권만 사용할 수 있습니다');
        }

        // 2-2. 이 티켓으로 이미 생성된 챌린지가 있는지 확인 (재사용 방지)
        const existingChallengeWithTicket = await tx.userChallenge.findFirst({
          where: { ticketId: ticket.id }
        });

        if (existingChallengeWithTicket) {
          this.logger.error(`티켓 재사용 시도 - 티켓 ${ticket.id}는 이미 UserChallenge ${existingChallengeWithTicket.id}에서 사용됨`);
          throw new ConflictException('이미 사용된 이용권입니다');
        }

        // 3. 상품(챌린지) 정보 조회
        const product = await tx.product.findUnique({
          where: { id: productId }
        });

        if (!product) {
          throw new NotFoundException('챌린지 상품을 찾을 수 없습니다');
        }

        // 4. 날짜 유효성 검증
        const startDateString = setStartDateDto.startDate; // "2025-10-20"
        const startDate = parseStringToDate(startDateString);
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        if (startDate < today) {
          throw new BadRequestException('시작일은 오늘 이후여야 합니다');
        }

        // 5. 배송일과 종료일 계산 (로컬 Date로 계산)
        const deliveryDate = calculateDeliveryDate(startDate);
        const endDate = calculateEndDate(startDate);

        // 6. KST 날짜/시간 객체 생성 (Prisma 저장용)
        const [startYear, startMonth, startDay] = startDateString.split('-').map(Number);
        const startDateKST = stringToKSTDate(startDateString, 0, 0, 0); // 00:00:00

        const deliveryYear = deliveryDate.getFullYear();
        const deliveryMonth = deliveryDate.getMonth() + 1;
        const deliveryDay = deliveryDate.getDate();
        const deliveryDateKST = stringToKSTDate(`${deliveryYear}-${String(deliveryMonth).padStart(2, '0')}-${String(deliveryDay).padStart(2, '0')}`);

        const endYear = endDate.getFullYear();
        const endMonth = endDate.getMonth() + 1;
        const endDay = endDate.getDate();
        const endDateKST = stringToKSTDate(`${endYear}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`, 23, 59, 59); // 23:59:59

        const now = new Date();
        const nowKST = stringToKSTDate(
          `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
          now.getHours(),
          now.getMinutes(),
          now.getSeconds()
        );

        // 7. UserChallenge 생성 (티켓 활성화 + 일정 정보 포함)
        const userChallenge = await tx.userChallenge.create({
          data: {
            user: { connect: { id: userId } },
            product: { connect: { id: productId } },
            ticket: { connect: { id: ticket.id } },
            activatedAt: nowKST,
            startDate: startDateKST,
            deliveryDate: deliveryDateKST,
            endDate: endDateKST,
            expiresAt: endDateKST,
            purchasedAt: ticket.purchaseDate,
            status: 'ACTIVE',
            createdAt: nowKST,
          }
        });

        // 8. 티켓 상태를 ACTIVATED로 변경
        await tx.challengeTicket.update({
          where: { id: ticket.id },
          data: { status: ChallengeTicketStatus.ACTIVATED }
        });

        // 9. 응답 데이터 생성
        const responseData: ChallengeScheduleResponseDto = {
          id: userChallenge.id,
          startDate: formatDateToString(userChallenge.startDate!),
          deliveryDate: formatDateToString(userChallenge.deliveryDate!),
          endDate: formatDateToString(userChallenge.endDate!),
          isConfirmed: true,
          canModify: false,
          purchasedAt: ticket.purchaseDate,
          createdAt: userChallenge.createdAt
        };

        this.logger.log(`챌린지 시작일 설정 완료 및 활성화 - 시작일: ${responseData.startDate}, 배송일: ${responseData.deliveryDate}, 종료일: ${responseData.endDate}, 상태: ACTIVE`);
        return { success: true, data: responseData };
      });
    } catch (error) {
      this.logger.error('챌린지 시작일 설정 실패:', error);
      throw error;
    }
  }

  // ⚠️ updateStartDate, confirmStartDate 메서드 제거됨
  // - 시작일은 한번 설정하면 수정 불가
  // - 시작일 설정 시 바로 확정 및 ACTIVE 상태로 변경됨

  /**
   * 챌린지 완료 처리
   * @description 챌린지를 완료 상태로 변경하고 사용자 구독 상태를 복원합니다
   * @param userId 사용자 ID
   * @param productId 챌린지 상품 ID
   */
  async completeChallenge(userId: number, productId: number) {
    try {
      this.logger.log(`챌린지 완료 처리 시작 - 사용자: ${userId}, 챌린지: ${productId}`);

      return await this.prisma.$transaction(async (tx) => {
        // 1. UserChallenge 완료 처리
        const userChallenge = await tx.userChallenge.findFirst({
          where: {
            userId,
            productId,
            status: 'ACTIVE'
          }
        });

        if (!userChallenge) {
          throw new NotFoundException('활성화된 챌린지를 찾을 수 없습니다');
        }

        await tx.userChallenge.update({
          where: { id: userChallenge.id },
          data: { status: 'COMPLETED' }
        });

        // 2. 다른 활성 챌린지가 있는지 확인
        const otherActiveChallenges = await tx.userChallenge.count({
          where: {
            userId,
            status: 'ACTIVE',
            id: { not: userChallenge.id }
          }
        });

        // 3. 다른 활성 챌린지가 없으면 구독 여부 확인 후 상태 변경
        // 권한 우선순위: CHALLENGER > SUBSCRIBER > NEWCOMER
        if (otherActiveChallenges === 0) {
          // 활성 구독이 있는지 확인 (KST 기준)
          const now = getKoreanNow();
          const activeSubscription = await tx.challengeTicket.findFirst({
            where: {
              userId,
              ticketType: 'SUBSCRIPTION',
              status: 'ACTIVE',
              endDate: { gt: now } // 만료되지 않은 구독
            }
          });

          const newStatus = activeSubscription
            ? UserSubscriptionStatus.SUBSCRIBER
            : UserSubscriptionStatus.NEWCOMER;

          await tx.user.update({
            where: { id: userId },
            data: { subscriptionStatus: newStatus }
          });

          this.logger.log(`사용자 ${userId}의 구독상태를 ${newStatus}로 변경 (챌린지 완료)`);
        }

        this.logger.log(`챌린지 완료 처리 완료 - 사용자: ${userId}, 챌린지: ${productId}`);
        return { success: true, message: '챌린지가 완료되었습니다' };
      });
    } catch (error) {
      this.logger.error('챌린지 완료 처리 실패:', error);
      throw error;
    }
  }

  /**
   * 챌린지 만료 처리
   * @description 챌린지를 만료 상태로 변경하고 사용자 구독 상태를 복원합니다
   * @param userId 사용자 ID
   * @param productId 챌린지 상품 ID
   */
  async expireChallenge(userId: number, productId: number) {
    try {
      this.logger.log(`챌린지 만료 처리 시작 - 사용자: ${userId}, 챌린지: ${productId}`);

      return await this.prisma.$transaction(async (tx) => {
        // 1. UserChallenge 만료 처리
        const userChallenge = await tx.userChallenge.findFirst({
          where: {
            userId,
            productId,
            status: 'ACTIVE'
          }
        });

        if (!userChallenge) {
          throw new NotFoundException('활성화된 챌린지를 찾을 수 없습니다');
        }

        await tx.userChallenge.update({
          where: { id: userChallenge.id },
          data: { status: 'EXPIRED' }
        });

        // 2. 다른 활성 챌린지가 있는지 확인
        const otherActiveChallenges = await tx.userChallenge.count({
          where: {
            userId,
            status: 'ACTIVE',
            id: { not: userChallenge.id }
          }
        });

        // 3. 다른 활성 챌린지가 없으면 구독 여부 확인 후 상태 변경
        // 권한 우선순위: CHALLENGER > SUBSCRIBER > NEWCOMER
        if (otherActiveChallenges === 0) {
          // 활성 구독이 있는지 확인 (KST 기준)
          const now = getKoreanNow();
          const activeSubscription = await tx.challengeTicket.findFirst({
            where: {
              userId,
              ticketType: 'SUBSCRIPTION',
              status: 'ACTIVE',
              endDate: { gt: now } // 만료되지 않은 구독
            }
          });

          const newStatus = activeSubscription
            ? UserSubscriptionStatus.SUBSCRIBER
            : UserSubscriptionStatus.NEWCOMER;

          await tx.user.update({
            where: { id: userId },
            data: { subscriptionStatus: newStatus }
          });

          this.logger.log(`사용자 ${userId}의 구독상태를 ${newStatus}로 변경 (챌린지 만료)`);
        }

        this.logger.log(`챌린지 만료 처리 완료 - 사용자: ${userId}, 챌린지: ${productId}`);
        return { success: true, message: '챌린지가 만료되었습니다' };
      });
    } catch (error) {
      this.logger.error('챌린지 만료 처리 실패:', error);
      throw error;
    }
  }

}
