import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../common/services/prisma.service';
import { UserSubscriptionStatus } from '../common/enums/user-subscription-status.enum';
import { getNowKST } from '../common/utils/kst-date.util';

/**
 * 챌린지 활성화 스케줄러
 *
 * 매주 월요일 자정(00:00)에 실행되어:
 * 1. PENDING 상태이면서 startDate가 오늘(월요일)인 UserChallenge 찾기
 * 2. PENDING → ACTIVE 전환
 * 3. DailyProgress(Day 1) 생성
 * 4. User 상태 → CHALLENGER로 변경
 * 5. 영양제 기록 7일치(월~일) 생성
 *
 * 참고: 챌린지 시작일은 월요일만 선택 가능하므로 배치도 월요일에만 실행
 */
@Injectable()
export class ChallengeSchedulerService {
  private readonly logger = new Logger(ChallengeSchedulerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 매주 월요일 00:05에 챌린지 활성화 실행
   *
   * Cron 표현식: 0 5 * * 1 (초 분 시 일 월 요일)
   * - 0초, 5분, 0시, 매일, 매월, 월요일(1)
   * - 월요일: 1 (일요일=0, 월요일=1, 화요일=2, ...)
   * - 만료 배치(00:00) 이후 5분 뒤 실행 (경쟁 상태 방지)
   */
  @Cron('0 5 * * 1', {
    name: 'activate-challenges',
    timeZone: 'Asia/Seoul',
  })
  async handleChallengeActivation() {
    this.logger.log('🕐 챌린지 활성화 스케줄러 시작...');

    const today = getNowKST();
    today.setHours(0, 0, 0, 0); // 오늘 00:00:00 (KST)

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1); // 내일 00:00:00 (KST)

    // 오늘 시작해야 할 PENDING 챌린지 찾기
    const pendingChallenges = await this.prisma.userChallenge.findMany({
      where: {
        status: 'PENDING',
        startDate: {
          gte: today,
          lt: tomorrow,
        },
      },
      include: {
        user: true,
        product: true,
      },
    });

    this.logger.log(
      `📋 오늘 활성화할 챌린지: ${pendingChallenges.length}건`,
    );

    let successCount = 0;
    let failCount = 0;

    // 각 챌린지마다 활성화 실행
    for (const challenge of pendingChallenges) {
      try {
        this.logger.log(
          `처리 중: userChallengeId=${challenge.id}, 상품명=${challenge.product.name}, 사용자=${challenge.user.email}`,
        );

        await this.activateChallenge(challenge.id, challenge.userId);

        successCount++;
      } catch (error: any) {
        this.logger.error(
          `챌린지 활성화 실패: userChallengeId=${challenge.id}, error=${error.message}`,
        );
        failCount++;
      }
    }

    this.logger.log(
      `✅ 챌린지 활성화 스케줄러 완료: 성공 ${successCount}건, 실패 ${failCount}건`,
    );
  }

  /**
   * 매주 월요일 00:10에 챌린지 경험자의 영양제 7일치 생성
   *
   * Cron 표현식: 0 10 * * 1 (초 분 시 일 월 요일)
   * - 0초, 10분, 0시, 매일, 매월, 월요일(1)
   * - 챌린지 활성화 배치(00:05) 이후 5분 뒤 실행 (경쟁 상태 방지)
   *
   * 참고: user_challenges 테이블에 데이터가 있는 사용자
   *       = 챌린지를 한 번이라도 시작했던 사람
   *       = 현재 상태(NEWCOMER/CHALLENGER)와 무관하게 영양제 계속 복용
   */
  @Cron('0 10 * * 1', {
    name: 'create-weekly-supplements',
    timeZone: 'Asia/Seoul',
  })
  async handleWeeklySupplementCreation() {
    this.logger.log('💊 영양제 주간 생성 스케줄러 시작...');

    const now = getNowKST();
    now.setHours(0, 0, 0, 0); // 오늘 00:00:00 (KST)

    // user_challenges 테이블에서 챌린지 경험자 조회 (중복 제거)
    const userChallenges = await this.prisma.userChallenge.findMany({
      select: {
        userId: true,
        user: {
          select: {
            id: true,
            email: true,
          },
        },
      },
      distinct: ['userId'], // userId 기준 중복 제거
    });

    this.logger.log(
      `📋 영양제 생성 대상 사용자: ${userChallenges.length}명 (챌린지 경험자)`,
    );

    if (userChallenges.length === 0) {
      this.logger.log('영양제 생성 대상 사용자가 없습니다.');
      return;
    }

    let successCount = 0;
    let failCount = 0;

    // 각 사용자마다 영양제 7일치 생성
    for (const { user } of userChallenges) {
      try {
        await this.prisma.$transaction(async (tx) => {
          await this.createWeeklySupplementRecords(tx, user.id, now);
        });

        successCount++;
      } catch (error: any) {
        this.logger.error(
          `영양제 생성 실패: userId=${user.id}, email=${user.email}, error=${error.message}`,
        );
        failCount++;
      }
    }

    this.logger.log(
      `✅ 영양제 주간 생성 스케줄러 완료: 성공 ${successCount}명, 실패 ${failCount}명`,
    );
  }

  /**
   * 챌린지 활성화 처리
   *
   * @param userChallengeId - UserChallenge ID
   * @param userId - 사용자 ID
   */
  private async activateChallenge(userChallengeId: number, userId: number) {
    return await this.prisma.$transaction(async (tx) => {
      const now = getNowKST();

      // 1. UserChallenge를 ACTIVE로 전환
      await tx.userChallenge.update({
        where: { id: userChallengeId },
        data: {
          status: 'ACTIVE',
          updatedAt: now,
        },
      });

      // 2. DailyProgress(Day 1) 생성
      await tx.dailyProgress.create({
        data: {
          userChallengeId,
          day: 1,
          date: new Date(now.getFullYear(), now.getMonth(), now.getDate()),
          createdAt: now,
        },
      });

      // 3. User 상태를 CHALLENGER로 변경
      await tx.user.update({
        where: { id: userId },
        data: {
          status: UserSubscriptionStatus.CHALLENGER,
          updatedAt: now,
        },
      });

      // 4. 영양제 기록 7일치 생성 (월요일 ~ 일요일)
      await this.createWeeklySupplementRecords(tx, userId, now);

      this.logger.log(
        `✅ 챌린지 활성화 완료: userChallengeId=${userChallengeId}, userId=${userId}`,
      );
    });
  }

  /**
   * 영양제 기록 7일치 생성 (월요일 ~ 일요일)
   *
   * @param tx - Prisma Transaction Client
   * @param userId - 사용자 ID
   * @param baseDate - 기준 날짜 (월요일)
   */
  private async createWeeklySupplementRecords(
    tx: any,
    userId: number,
    baseDate: Date,
  ) {
    // 사용자의 활성화된 영양제 루틴 조회
    const supplementRoutines = await tx.userSupplementRoutine.findMany({
      where: {
        userId,
        isActive: true,
      },
      orderBy: {
        displayOrder: 'asc',
      },
    });

    if (supplementRoutines.length === 0) {
      this.logger.warn(
        `영양제 루틴이 없습니다: userId=${userId}, 영양제 기록 생성 스킵`,
      );
      return;
    }

    this.logger.log(
      `영양제 루틴 조회 완료: userId=${userId}, 영양제 개수=${supplementRoutines.length}`,
    );

    const recordsToCreate = [];

    // 월요일부터 일요일까지 7일
    for (let dayOffset = 0; dayOffset < 7; dayOffset++) {
      // KST 기준 날짜 생성
      const recordDate = getNowKST();
      recordDate.setDate(baseDate.getDate() + dayOffset);
      recordDate.setHours(0, 0, 0, 0); // 00:00:00 (KST)

      // 각 영양제마다 기록 생성
      for (const routine of supplementRoutines) {
        recordsToCreate.push({
          userId,
          userChallengeId: null, // 영양제는 챌린지와 무관
          recordType: 'SUPPLEMENTS',
          metadata: {
            productId: routine.productId,
            morning: false,
            afternoon: false,
            evening: false,
          },
          date: recordDate,
          createdAt: getNowKST(),
          updatedAt: getNowKST(),
        });
      }
    }

    // 한 번에 모든 레코드 생성
    await tx.userRecord.createMany({
      data: recordsToCreate,
    });

    this.logger.log(
      `✅ 영양제 기록 생성 완료: userId=${userId}, 총 ${recordsToCreate.length}건 (7일 × ${supplementRoutines.length}개)`,
    );
  }

  /**
   * 매일 자정(00:00)에 만료된 챌린지 자동 처리
   *
   * Cron 표현식: 0 0 * * * (초 분 시 일 월 요일)
   * - 0초, 0분, 0시, 매일, 매월, 매주
   *
   * 참고: endDate가 오늘보다 이전인 ACTIVE 챌린지를 EXPIRED로 변경
   *       다른 활성 챌린지가 없으면 사용자 상태를 SUBSCRIBER 또는 NEWCOMER로 변경
   */
  @Cron('0 0 * * *', {
    name: 'expire-challenges',
    timeZone: 'Asia/Seoul',
  })
  async handleChallengeExpiration() {
    this.logger.log('⏰ 챌린지 만료 처리 스케줄러 시작...');

    const now = getNowKST();
    now.setHours(0, 0, 0, 0); // 오늘 00:00:00 (KST)

    // 오늘 기준으로 만료된 챌린지 찾기 (endDate < 오늘)
    const expiredChallenges = await this.prisma.userChallenge.findMany({
      where: {
        status: 'ACTIVE',
        endDate: {
          lt: now, // endDate가 오늘보다 이전
        },
      },
      include: {
        user: true,
        product: true,
      },
    });

    this.logger.log(
      `📋 만료 처리할 챌린지: ${expiredChallenges.length}건`,
    );

    if (expiredChallenges.length === 0) {
      this.logger.log('만료 처리할 챌린지가 없습니다.');
      return;
    }

    let successCount = 0;
    let failCount = 0;

    // 각 챌린지마다 만료 처리 실행
    for (const challenge of expiredChallenges) {
      try {
        this.logger.log(
          `처리 중: userChallengeId=${challenge.id}, 상품명=${challenge.product.name}, 사용자=${challenge.user.email}, 종료일=${challenge.endDate}`,
        );

        await this.expireChallenge(challenge.id, challenge.userId);

        successCount++;
      } catch (error: any) {
        this.logger.error(
          `챌린지 만료 실패: userChallengeId=${challenge.id}, error=${error.message}`,
        );
        failCount++;
      }
    }

    this.logger.log(
      `✅ 챌린지 만료 처리 스케줄러 완료: 성공 ${successCount}건, 실패 ${failCount}건`,
    );
  }

  /**
   * 챌린지 만료 처리 (내부 함수)
   *
   * @param userChallengeId - UserChallenge ID
   * @param userId - 사용자 ID
   */
  private async expireChallenge(userChallengeId: number, userId: number) {
    return await this.prisma.$transaction(async (tx) => {
      const now = getNowKST();

      // 1. UserChallenge를 EXPIRED로 변경
      await tx.userChallenge.update({
        where: { id: userChallengeId },
        data: {
          status: 'EXPIRED',
          updatedAt: now,
        },
      });

      // 2. 다른 활성 챌린지가 있는지 확인
      const otherActiveChallenges = await tx.userChallenge.count({
        where: {
          userId,
          status: 'ACTIVE',
          id: { not: userChallengeId },
        },
      });

      // 3. 다른 활성 챌린지가 없으면 구독 여부 확인 후 상태 변경
      // 권한 우선순위: CHALLENGER > SUBSCRIBER > NEWCOMER
      if (otherActiveChallenges === 0) {
        // 활성 구독이 있는지 확인 (KST 기준)
        const activeSubscription = await tx.challengeTicket.findFirst({
          where: {
            userId,
            ticketType: 'SUBSCRIPTION',
            status: 'ACTIVE',
            endDate: { gt: now }, // 만료되지 않은 구독
          },
        });

        const newStatus = activeSubscription
          ? UserSubscriptionStatus.SUBSCRIBER
          : UserSubscriptionStatus.NEWCOMER;

        await tx.user.update({
          where: { id: userId },
          data: {
            status: newStatus,
            updatedAt: now,
          },
        });

        this.logger.log(
          `사용자 상태 변경: userId=${userId}, ${UserSubscriptionStatus.CHALLENGER} → ${newStatus}`,
        );
      }

      this.logger.log(
        `✅ 챌린지 만료 완료: userChallengeId=${userChallengeId}, userId=${userId}`,
      );
    });
  }

  /**
   * 수동 실행용 (테스트)
   *
   * 형님이 테스트할 때 호출하면 즉시 챌린지 활성화 실행
   */
  async runManually() {
    this.logger.log('🧪 수동 실행 - 챌린지 활성화 스케줄러');
    await this.handleChallengeActivation();
  }
}
