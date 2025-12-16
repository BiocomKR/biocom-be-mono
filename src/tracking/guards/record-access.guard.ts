import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { UserSubscriptionStatus } from '../../common/enums/user-subscription-status.enum';
import { UserChallengeStatus } from '../../common/enums/challenge-ticket-status.enum';

/**
 * 기록 접근 권한 가드
 * 모든 사용자 접근 허용, NEWCOMER는 예시 데이터 제공
 */
@Injectable()
export class RecordAccessGuard implements CanActivate {
  private readonly logger = new Logger(RecordAccessGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const userId = request.user?.id || request.user?.userId;

    if (!userId) {
      throw new ForbiddenException('인증이 필요합니다');
    }

    try {
      this.logger.log(`기록 접근 권한 확인 - 사용자 ID: ${userId}`);

      // 사용자 정보 조회
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          status: true,
          userChallenges: {
            where: {
              status: UserChallengeStatus.ACTIVE
            },
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
      const hasActiveChallenge = user.userChallenges.length > 0;

      // 3️⃣ 가장 최근 챌린지 상태 체크 (PENDING이면 가짜 데이터 표시)
      const latestChallenge = await this.prisma.userChallenge.findFirst({
        where: { userId: userId },
        orderBy: { id: 'desc' },
        select: { status: true }
      });

      // 최근 챌린지가 PENDING이 아닌 경우에만 실제 데이터 접근 허용
      const hasValidChallengeHistory = latestChallenge
        ? latestChallenge.status !== UserChallengeStatus.PENDING
        : false;

      const hasRealAccess = isSubscriber || hasActiveChallenge || hasValidChallengeHistory;

      // NEWCOMER 여부를 request에 플래그로 추가 (Service에서 분기 처리용)
      request.isNewcomer = !hasRealAccess;

      if (hasRealAccess) {
        this.logger.log(
          `기록 접근 권한 승인 (실제 데이터) - 사용자 ID: ${userId}, ` +
          `구독상태: ${user.status}, ` +
          `활성챌린지: ${hasActiveChallenge ? '있음' : '없음'}, ` +
          `챌린지이력: ${hasValidChallengeHistory ? '있음' : '없음'}`
        );
      } else {
        this.logger.log(
          `기록 접근 권한 승인 (예시 데이터) - 사용자 ID: ${userId}, ` +
          `구독상태: ${user.status}, ` +
          `활성챌린지: ${hasActiveChallenge ? '있음' : '없음'}, ` +
          `챌린지이력: ${hasValidChallengeHistory ? '있음' : '없음'}`
        );
      }

      return true; // 모든 사용자 접근 허용
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }

      this.logger.error('기록 접근 권한 확인 중 오류 발생:', error);
      throw new ForbiddenException('권한 확인 중 오류가 발생했습니다');
    }
  }
}