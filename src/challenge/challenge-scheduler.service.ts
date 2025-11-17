import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../common/services/prisma.service';
import { UserSubscriptionStatus } from '../common/enums/user-subscription-status.enum';
import { getNowKST } from '../common/utils/kst-date.util';

/**
 * 챌린지 활성화 스케줄러
 *
 * 매일 자정(00:00)에 실행되어:
 * 1. PENDING 상태이면서 startDate가 오늘인 UserChallenge 찾기
 * 2. PENDING → ACTIVE 전환
 * 3. DailyProgress(Day 1) 생성
 * 4. User 상태 → CHALLENGER로 변경
 */
@Injectable()
export class ChallengeSchedulerService {
  private readonly logger = new Logger(ChallengeSchedulerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 매일 자정(00:00)에 챌린지 활성화 실행
   *
   * Cron 표현식: 0 0 * * * (초 분 시 일 월 요일)
   * - 0초, 0시, 매일, 매월, 매주
   */
  @Cron('0 0 * * *', {
    name: 'activate-challenges',
    timeZone: 'Asia/Seoul',
  })
  async handleChallengeActivation() {
    this.logger.log('🕐 챌린지 활성화 스케줄러 시작...');

    const today = new Date();
    today.setHours(0, 0, 0, 0); // 오늘 00:00:00

    const tomorrow = new Date(today);
    tomorrow.setDate(tomorrow.getDate() + 1); // 내일 00:00:00

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

    if (pendingChallenges.length === 0) {
      this.logger.log('활성화할 챌린지가 없습니다.');
      return;
    }

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

      this.logger.log(
        `✅ 챌린지 활성화 완료: userChallengeId=${userChallengeId}, userId=${userId}`,
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
