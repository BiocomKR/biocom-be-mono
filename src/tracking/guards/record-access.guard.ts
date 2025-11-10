import { Injectable, CanActivate, ExecutionContext, ForbiddenException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { UserSubscriptionStatus } from '../../common/enums/user-subscription-status.enum';

/**
 * 기록 접근 권한 가드
 * 구독 사용자 또는 활성 챌린지 참여자만 기록 기능에 접근 가능
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
              status: 'ACTIVE'
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

      const hasAccess = isSubscriber || hasActiveChallenge;

      if (hasAccess) {
        this.logger.log(
          `기록 접근 권한 승인 - 사용자 ID: ${userId}, ` +
          `구독상태: ${user.status}, ` +
          `활성챌린지: ${hasActiveChallenge ? '있음' : '없음'}`
        );
        return true;
      } else {
        this.logger.warn(
          `기록 접근 권한 거부 - 사용자 ID: ${userId}, ` +
          `구독상태: ${user.status}, ` +
          `활성챌린지: ${hasActiveChallenge ? '있음' : '없음'}`
        );
        throw new ForbiddenException(
          '기록 기능은 구독 사용자 또는 활성 챌린지 참여자만 이용할 수 있습니다'
        );
      }
    } catch (error) {
      if (error instanceof ForbiddenException) {
        throw error;
      }
      
      this.logger.error('기록 접근 권한 확인 중 오류 발생:', error);
      throw new ForbiddenException('권한 확인 중 오류가 발생했습니다');
    }
  }
}