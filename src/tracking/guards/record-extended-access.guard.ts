import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { UserSubscriptionStatus, UserChallengeStatus } from '../../common/enums';

/**
 * 기록 확장 접근 권한 가드
 * 구독 사용자 OR 활성 챌린지 참여자 OR 과거 챌린지 구매자만 기록 기능에 접근 가능
 */
@Injectable()
export class RecordExtendedAccessGuard implements CanActivate {
  private readonly logger = new Logger(RecordExtendedAccessGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id || request.user?.userId;

    if (!userId) {
      throw new ForbiddenException('인증이 필요합니다');
    }

    try {
      this.logger.log(`기록 확장 접근 권한 확인 - 사용자 ID: ${userId}`);

      // 사용자 정보 조회
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          status: true,
          userChallenges: {
            select: {
              id: true,
              status: true
            }
          }
        }
      });

      if (!user) {
        throw new ForbiddenException('사용자를 찾을 수 없습니다');
      }

      // 1️⃣ 구독 사용자 체크 (newcomer가 아닌 경우)
      const isSubscriber = user.status !== UserSubscriptionStatus.NEWCOMER;

      // 2️⃣ 활성 챌린지 참여자 체크
      const hasActiveChallenge = user.userChallenges.some(uc => uc.status === UserChallengeStatus.ACTIVE);

      // 3️⃣ 과거 챌린지 구매자 체크 (하나라도 챌린지 이력이 있으면)
      const hasPastChallenge = user.userChallenges.length > 0;

      const hasAccess = isSubscriber || hasActiveChallenge || hasPastChallenge;

      if (hasAccess) {
        this.logger.log(
          `기록 확장 접근 권한 승인 - 사용자 ID: ${userId}, ` +
          `구독상태: ${user.status}, ` +
          `활성챌린지: ${hasActiveChallenge ? '있음' : '없음'}, ` +
          `과거챌린지: ${hasPastChallenge ? '있음' : '없음'}`
        );
        return true;
      } else {
        this.logger.warn(
          `기록 확장 접근 권한 거부 - 사용자 ID: ${userId}, ` +
          `구독상태: ${user.status}, ` +
          `챌린지이력: ${hasPastChallenge ? '있음' : '없음'}`
        );
        throw new ForbiddenException(
          '기록 기능은 구독 사용자 또는 챌린지 참여자만 이용할 수 있습니다'
        );
      }
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }

      this.logger.error('기록 확장 접근 권한 확인 중 오류 발생:', error);
      throw new ForbiddenException('권한 확인 중 오류가 발생했습니다');
    }
  }
}
