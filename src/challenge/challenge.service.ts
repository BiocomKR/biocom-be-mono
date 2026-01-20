import { Injectable, ConflictException, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { Logger } from '@nestjs/common';
import {
  // ⚠️ 배송 관련 함수 import 제거됨 (도시락 배송 정책 폐지)
  // calculateDeliveryArrivalDate,
  // calculateDeliveryStartDate,
  calculateEndDate,
  formatDateToString,
  parseStringToDate,
  stringToKSTDate,
  isValidStartDate,
  getAvailableStartDates
} from './utils/challenge-date.util';
import {
  SetStartDateDto,
  ChallengeScheduleResponseDto
} from './dto/challenge-schedule.dto';
import { UserSubscriptionStatus } from '../common/enums/user-subscription-status.enum';
import { getNowKST, calculateChallengeDay } from '../common/utils/kst-date.util';
import { ChallengeTicketStatus, UserChallengeStatus } from '../common/enums/challenge-ticket-status.enum';
import { ProductStatus } from '../common/enums';

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
      isActive: product.status === ProductStatus.ACTIVE
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
          status: ProductStatus.ACTIVE,
          categoryCode: 'CHALLENGE'
        },
        include: {
          productFiles: {
            where: { imageType: 'MAIN' },
            take: 1,
            include: { file: true }
          }
        },
        orderBy: { createdAt: 'desc' }
      });

      const challengeProducts = products
        .filter(p => this.isChallengeProduct(p))
        .map(product => ({
          id: product.id,
          name: product.name,
          description: product.description,
          price: product.price || 0,
          imageUrl: product.productFiles?.[0]?.file?.filePath || null,
        }));

      this.logger.log(`구매 가능한 챌린지 ${challengeProducts.length}개 조회 완료`);

      return { success: true, data: challengeProducts };
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
          status: UserChallengeStatus.ACTIVE
        },
        include: {
          product: true,
          ticket: true
        },
        orderBy: { id: 'desc' }
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
      console.log('🔥 DEBUG - activatedAt from DB:', activeChallenge.activatedAt);
      console.log('🔥 DEBUG - activatedAt ISO:', activeChallenge.activatedAt.toISOString());
      const currentDay = calculateChallengeDay(activeChallenge.activatedAt);
      console.log('🔥 DEBUG - calculated currentDay:', currentDay);
      const weekNumber = Math.ceil(currentDay / 7);
      const challengeInfo = this.extractChallengeInfo(activeChallenge.product);

      // 오늘의 챌린지_미션 매핑 ID 조회
      const todayMissions = await this.prisma.challengeMission.findMany({
        where: {
          productId,
          day: currentDay,
          isActive: true
        },
        select: {
          id: true
        },
        orderBy: { sortOrder: 'asc' }
      });

      // 오늘의 챌린지_설문 매핑 정보 조회
      const todaySurveys = await this.prisma.challengeSurvey.findMany({
        where: {
          productId,
          day: currentDay,
          isActive: true
        },
        select: {
          id: true,
          day: true,
          survey: {
            select: {
              type: true
            }
          }
        },
        orderBy: { day: 'asc' }
      });

      const result = {
        // 기본 챌린지 정보
        userChallengeId: activeChallenge.id,
        productId: activeChallenge.productId,
        challenge: challengeInfo,
        activatedAt: activeChallenge.activatedAt,
        expiresAt: activeChallenge.expiresAt,
        currentDay,
        totalPoints: activeChallenge.totalPoints,
        status: activeChallenge.status,

        // 오늘의 활동 ID들
        missionIds: todayMissions.map(m => m.id),
        surveys: todaySurveys.map(s => ({
          id: s.id,
          day: s.day,
          type: s.survey.type
        }))
      };

      this.logger.log(`사용자 ${userId}의 활성 챌린지 조회 완료: ${challengeInfo.name} (${currentDay}일차)`);
      this.logger.log(`- 오늘의 미션 ${todayMissions.length}개, 설문 ${todaySurveys.length}개`);
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
          where: { userId, status: UserChallengeStatus.ACTIVE }
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

        if (ticket.product.status !== ProductStatus.ACTIVE) {
          throw new BadRequestException('비활성화된 챌린지입니다');
        }

        const challengeInfo = this.extractChallengeInfo(ticket.product);

        // 3. 챌린지 활성화 (KST 기준)
        const now = getNowKST();
        const expiresAt = new Date(now.getTime() + challengeInfo.totalDays * 24 * 60 * 60 * 1000);

        const userChallenge = await tx.userChallenge.create({
          data: {
            userId,
            productId: ticket.productId,
            ticketId,
            activatedAt: now,
            expiresAt,
            purchasedAt: ticket.purchaseDate, // 티켓 구매 일시
            status: UserChallengeStatus.PENDING, // 시작일 설정 전까지는 PENDING 상태
            createdAt: now,
          },
          include: { product: true }
        });

        // 4. 티켓 상태는 PURCHASED 유지 (start-date API에서 변경)
        // DailyProgress와 CHALLENGER 상태 변경은 크론잡에서 처리 (시작일이 되면)

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

  // ==================== 백오피스 관리용 메서드들 ====================

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
      timestamp: getNowKST()
    };
  }

  // ==================== 시작일 설정 시스템 ====================

  /**
   * 빠른 챌린지 시작 (All-in-One)
   * @description 챌린지 조회 → 구매 → 활성화 → 시작일 설정을 한 번에 처리합니다
   * @param userId 사용자 ID
   * @param startDate 시작일 (YYYY-MM-DD)
   */
  async quickStartChallenge(userId: number, startDate: string): Promise<{ success: boolean; data: ChallengeScheduleResponseDto }> {
    try {
      this.logger.log(`빠른 챌린지 시작 - 사용자: ${userId}, 시작일: ${startDate}`);

      return await this.prisma.$transaction(async (tx) => {
        // 1. 이너뷰티 챌린지 조회
        const product = await tx.product.findFirst({
          where: {
            name: '이너뷰티 챌린지',
            categoryCode: 'CHALLENGE',
            status: UserChallengeStatus.ACTIVE
          }
        });

        if (!product) {
          throw new NotFoundException('이너뷰티 챌린지를 찾을 수 없습니다');
        }

        const productId = product.id;

        // 2. 이미 활성 챌린지가 있는지 확인
        const existingActive = await tx.userChallenge.findFirst({
          where: { userId, status: UserChallengeStatus.ACTIVE }
        });

        if (existingActive) {
          throw new ConflictException('이미 활성화된 챌린지가 있습니다. 한 번에 하나의 챌린지만 진행할 수 있습니다.');
        }

        // 3. 이미 구매한 티켓이 있는지 확인 (PURCHASED 또는 ACTIVATED 상태)
        let ticket = await tx.challengeTicket.findFirst({
          where: {
            userId,
            productId,
            status: { in: [ChallengeTicketStatus.PURCHASED, ChallengeTicketStatus.ACTIVATED] }
          }
        });

        // 4. 티켓이 없으면 무료 티켓 발급
        // [제거됨] Order/OrderItem 생성 로직
        // - 챌린지는 주문 플로우와 분리됨
        // - ChallengeTicket만 생성 (orderItemId = null)
        if (!ticket) {
          const now = getNowKST();

          ticket = await tx.challengeTicket.create({
            data: {
              userId,
              productId,
              // orderItemId: null (주문과 무관한 무료 티켓)
              ticketType: 'QUICK_START',
              status: ChallengeTicketStatus.PURCHASED,
              purchaseDate: now,
              createdAt: now
            }
          });

          this.logger.log(`챌린지 티켓 무료 발급 완료 - 티켓 ID: ${ticket.id}`);
        }

        // 5. 티켓으로 UserChallenge 생성 (PENDING 상태)
        const pendingChallenge = await tx.userChallenge.findFirst({
          where: {
            ticketId: ticket.id,
            status: UserChallengeStatus.PENDING
          }
        });

        let userChallengeId: number;

        if (!pendingChallenge) {
          const challengeInfo = this.extractChallengeInfo(product);
          const now = getNowKST();
          const expiresAt = new Date(now.getTime() + challengeInfo.totalDays * 24 * 60 * 60 * 1000);

          const newChallenge = await tx.userChallenge.create({
            data: {
              userId,
              productId,
              ticketId: ticket.id,
              activatedAt: now,
              expiresAt,
              purchasedAt: ticket.purchaseDate,
              status: UserChallengeStatus.PENDING,
              createdAt: now
            }
          });

          userChallengeId = newChallenge.id;
          this.logger.log(`챌린지 활성화 완료 - UserChallenge ID: ${userChallengeId}`);
        } else {
          userChallengeId = pendingChallenge.id;
        }

        // 6. 시작일 설정 (기존 setStartDate 로직 재사용)
        const startDateString = startDate;
        const startDateObj = parseStringToDate(startDateString);
        const today = getNowKST();
        today.setUTCHours(0, 0, 0, 0);

        // 월요일 & 다음주부터 3주간 범위 검증
        if (!isValidStartDate(startDateObj, today)) {
          const availableDates = getAvailableStartDates(today);
          const availableDatesStr = availableDates.map(d => formatDateToString(d)).join(', ');
          throw new BadRequestException(
            `시작일은 다음주부터 3주간의 월요일만 선택 가능합니다. 선택 가능한 날짜: ${availableDatesStr}`
          );
        }

        // 종료일 계산
        const endDateObj = calculateEndDate(startDateObj);

        // KST 날짜/시간 객체 생성
        const startDateKST = stringToKSTDate(startDateString, 0, 0, 0);
        const endYear = endDateObj.getFullYear();
        const endMonth = endDateObj.getMonth() + 1;
        const endDay = endDateObj.getDate();
        const endDateKST = stringToKSTDate(
          `${endYear}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`,
          23, 59, 59
        );

        // 현재 시간 (시작일 설정 시점)
        const now = getNowKST();

        // UserChallenge 업데이트
        const userChallenge = await tx.userChallenge.update({
          where: { id: userChallengeId },
          data: {
            activatedAt: startDateKST,
            expiresAt: endDateKST,
            startDateSetAt: now, // 시작일 설정 시점 기록
          }
        });

        // 티켓 상태를 ACTIVATED로 변경
        await tx.challengeTicket.update({
          where: { id: ticket.id },
          data: { status: ChallengeTicketStatus.ACTIVATED }
        });

        // 응답 데이터 생성
        const responseData: ChallengeScheduleResponseDto = {
          id: userChallenge.id,
          challengeCode: product.sku, // 챌린지 코드 (GA4 이벤트용)
          startDate: formatDateToString(userChallenge.activatedAt),
          endDate: formatDateToString(userChallenge.expiresAt),
          isConfirmed: true,
          canModify: false,
          purchasedAt: ticket.purchaseDate,
          createdAt: userChallenge.createdAt
        };

        this.logger.log(`빠른 챌린지 시작 완료 - 챌린지: ${product.sku}, 시작일: ${responseData.startDate}, 종료일: ${responseData.endDate}`);
        return { success: true, data: responseData };
      });
    } catch (error) {
      this.logger.error('빠른 챌린지 시작 실패:', error);
      throw error;
    }
  }

  //--------------------- TEST ---------------------
  /**
   * 테스트용 빠른 챌린지 시작 (배열로 다수 처리)
   * startDate는 '2025-12-29' 고정
   * @param userIds 사용자 ID 배열
   */
  async quickStartChallengeTest(userIds: number[]) {
    const FIXED_START_DATE = '2025-12-29';
    this.logger.log(`[테스트] 사전 챌린지 시작: ${userIds.length}명, 시작일: ${FIXED_START_DATE}`);

    const results = [];

    for (const userId of userIds) {
      try {
        const result = await this.quickStartChallenge(userId, FIXED_START_DATE);
        this.logger.log(`[테스트] 챌린지 시작 성공: userId=${userId}`);
        results.push({ success: true, userId, data: result.data });
      } catch (error) {
        this.logger.error(`[테스트] 챌린지 시작 실패: userId=${userId} - ${error.message}`);
        results.push({ success: false, userId, error: error.message });
      }
    }

    this.logger.log(`[테스트] 사전 챌린지 시작 완료: 성공 ${results.filter(r => r.success).length}명 / 전체 ${userIds.length}명`);

    return results;
  }

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
      // 일정 정보는 이제 userChallenge에 직접 저장됨 (activatedAt/expiresAt 사용)
      const responseData: ChallengeScheduleResponseDto = {
        id: userChallenge.id,
        challengeCode: ticket.product?.sku || '', // 챌린지 코드 (GA4 이벤트용)
        startDate: userChallenge.activatedAt ? formatDateToString(userChallenge.activatedAt) : null,
        endDate: userChallenge.expiresAt ? formatDateToString(userChallenge.expiresAt) : null,
        isConfirmed: true, // 일정 설정 시 바로 확정됨
        canModify: false,   // 설정 후 수정 불가
        purchasedAt: ticket.purchaseDate,
        createdAt: userChallenge.createdAt
      };

      this.logger.log(`챌린지 일정 조회 완료 - 챌린지: ${responseData.challengeCode}, 시작일: ${responseData.startDate}`);
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
          where: { userId, status: UserChallengeStatus.ACTIVE }
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

        // 2-2. 이 티켓으로 생성된 PENDING 상태 챌린지 찾기
        const pendingChallenge = await tx.userChallenge.findFirst({
          where: {
            ticketId: ticket.id,
            status: UserChallengeStatus.PENDING
          }
        });

        if (!pendingChallenge) {
          this.logger.error(`PENDING 챌린지를 찾을 수 없음 - 티켓 ${ticket.id}`);
          throw new NotFoundException('활성화된 챌린지를 찾을 수 없습니다. 먼저 챌린지를 활성화해주세요.');
        }

        // 3. 상품(챌린지) 정보 조회
        const product = await tx.product.findUnique({
          where: { id: productId }
        });

        if (!product) {
          throw new NotFoundException('챌린지 상품을 찾을 수 없습니다');
        }

        // 4. 날짜 유효성 검증
        const startDateString = setStartDateDto.startDate; // "2025-11-03"
        const startDate = parseStringToDate(startDateString);
        const today = getNowKST();
        today.setUTCHours(0, 0, 0, 0);

        // 4-1. 월요일인지 확인 & 다음주부터 3주간 범위인지 확인
        if (!isValidStartDate(startDate, today)) {
          const availableDates = getAvailableStartDates(today);
          const availableDatesStr = availableDates.map(d => formatDateToString(d)).join(', ');
          throw new BadRequestException(
            `시작일은 다음주부터 3주간의 월요일만 선택 가능합니다. 선택 가능한 날짜: ${availableDatesStr}`
          );
        }

        // 5. 종료일 계산 (로컬 Date로 계산)
        // ⚠️ 배송 관련 계산 제거됨 (도시락 배송 정책 폐지)
        // const deliveryArrivalDate = await calculateDeliveryArrivalDate(startDate); // 시작일 전주 금요일 (공휴일 체크)
        // const deliveryStartDate = await calculateDeliveryStartDate(deliveryArrivalDate); // 배송도착일 2일전 (공휴일 체크)
        const endDate = calculateEndDate(startDate); // 시작일 +20일

        // 6. KST 날짜/시간 객체 생성 (Prisma 저장용)
        const startDateKST = stringToKSTDate(startDateString, 0, 0, 0); // 00:00:00

        // ⚠️ 배송 관련 KST 날짜 생성 제거됨 (도시락 배송 정책 폐지)
        // // 배송시작일 KST
        // const deliveryStartYear = deliveryStartDate.getFullYear();
        // const deliveryStartMonth = deliveryStartDate.getMonth() + 1;
        // const deliveryStartDay = deliveryStartDate.getDate();
        // const deliveryStartDateKST = stringToKSTDate(
        //   `${deliveryStartYear}-${String(deliveryStartMonth).padStart(2, '0')}-${String(deliveryStartDay).padStart(2, '0')}`
        // );

        // // 배송도착예정일 KST
        // const deliveryArrivalYear = deliveryArrivalDate.getFullYear();
        // const deliveryArrivalMonth = deliveryArrivalDate.getMonth() + 1;
        // const deliveryArrivalDay = deliveryArrivalDate.getDate();
        // const deliveryArrivalDateKST = stringToKSTDate(
        //   `${deliveryArrivalYear}-${String(deliveryArrivalMonth).padStart(2, '0')}-${String(deliveryArrivalDay).padStart(2, '0')}`
        // );

        // 종료일 KST
        const endYear = endDate.getFullYear();
        const endMonth = endDate.getMonth() + 1;
        const endDay = endDate.getDate();
        const endDateKST = stringToKSTDate(`${endYear}-${String(endMonth).padStart(2, '0')}-${String(endDay).padStart(2, '0')}`, 23, 59, 59); // 23:59:59

        const now = getNowKST();
        const nowKST = stringToKSTDate(
          `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}-${String(now.getDate()).padStart(2, '0')}`,
          now.getHours(),
          now.getMinutes(),
          now.getSeconds()
        );

        // 7. UserChallenge 업데이트 (일정 정보 추가, PENDING 상태 유지)
        // ⚠️ startDate/endDate 필드 제거됨 - activatedAt/expiresAt 사용
        const userChallenge = await tx.userChallenge.update({
          where: { id: pendingChallenge.id },
          data: {
            activatedAt: startDateKST,
            expiresAt: endDateKST,
            startDateSetAt: nowKST, // 시작일 설정 시점 기록
            // status는 PENDING 유지 (크론잡에서 ACTIVE로 변경)
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
          challengeCode: product.sku, // 챌린지 코드 (GA4 이벤트용)
          startDate: formatDateToString(userChallenge.activatedAt),
          endDate: formatDateToString(userChallenge.expiresAt),
          isConfirmed: true,
          canModify: false,
          purchasedAt: ticket.purchaseDate,
          createdAt: userChallenge.createdAt
        };

        this.logger.log(`챌린지 시작일 설정 완료 - 챌린지: ${product.sku}, 시작일: ${responseData.startDate}, 종료일: ${responseData.endDate}`);
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
            status: UserChallengeStatus.ACTIVE
          }
        });

        if (!userChallenge) {
          throw new NotFoundException('활성화된 챌린지를 찾을 수 없습니다');
        }

        await tx.userChallenge.update({
          where: { id: userChallenge.id },
          data: { status: UserChallengeStatus.EXPIRED }
        });

        // 2. 다른 활성 챌린지가 있는지 확인
        const otherActiveChallenges = await tx.userChallenge.count({
          where: {
            userId,
            status: UserChallengeStatus.ACTIVE,
            id: { not: userChallenge.id }
          }
        });

        // 3. 다른 활성 챌린지가 없으면 구독 여부 확인 후 상태 변경
        // 권한 우선순위: CHALLENGER > SUBSCRIBER > NEWCOMER
        if (otherActiveChallenges === 0) {
          // 활성 구독이 있는지 확인 (KST 기준)
          const now = getNowKST();
          const activeSubscription = await tx.challengeTicket.findFirst({
            where: {
              userId,
              ticketType: 'SUBSCRIPTION',
              status: UserChallengeStatus.ACTIVE,
              endDate: { gt: now } // 만료되지 않은 구독
            }
          });

          const newStatus = activeSubscription
            ? UserSubscriptionStatus.SUBSCRIBER
            : UserSubscriptionStatus.NEWCOMER;

          await tx.user.update({
            where: { id: userId },
            data: { status: newStatus }
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
