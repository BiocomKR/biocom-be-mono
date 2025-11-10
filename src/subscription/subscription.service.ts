import { Injectable, NotFoundException, BadRequestException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { UserSubscriptionStatus } from '../common/enums/user-subscription-status.enum';

/**
 * 구독 서비스
 * 사용자의 구독 상태 관리를 담당합니다
 */
@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 구독 활성화
   * @description 사용자를 SUBSCRIBER 상태로 변경합니다 (단, CHALLENGER는 유지)
   * 권한 우선순위: CHALLENGER > SUBSCRIBER > NEWCOMER
   * @param userId 사용자 ID
   * @param orderId 구독 주문 ID (선택)
   */
  async activateSubscription(userId: number, orderId?: number) {
    try {
      this.logger.log(`구독 활성화 시작 - 사용자: ${userId}, 주문: ${orderId}`);

      // 사용자 확인
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          status: true
        }
      });

      if (!user) {
        throw new NotFoundException('사용자를 찾을 수 없습니다');
      }

      // CHALLENGER는 더 높은 권한이므로 유지
      if (user.status === UserSubscriptionStatus.CHALLENGER) {
        this.logger.log(
          `구독 활성화 - 사용자는 이미 CHALLENGER 상태이므로 유지 - 사용자: ${userId}`
        );

        return {
          success: true,
          message: '구독이 활성화되었습니다 (CHALLENGER 상태 유지)',
          data: {
            userId: user.id,
            status: user.status
          }
        };
      }

      // NEWCOMER만 SUBSCRIBER로 변경
      const updatedUser = await this.prisma.user.update({
        where: { id: userId },
        data: { status: UserSubscriptionStatus.SUBSCRIBER }
      });

      this.logger.log(
        `구독 활성화 완료 - 사용자: ${userId}, ` +
        `이전상태: ${user.status} -> 현재상태: ${updatedUser.status}`
      );

      return {
        success: true,
        message: '구독이 활성화되었습니다',
        data: {
          userId: updatedUser.id,
          status: updatedUser.status
        }
      };
    } catch (error) {
      this.logger.error('구독 활성화 실패:', error);
      throw error;
    }
  }

  /**
   * 구독 만료/취소
   * @description 사용자를 NEWCOMER 상태로 복원합니다 (단, 활성 챌린지가 있으면 유지)
   * @param userId 사용자 ID
   */
  async deactivateSubscription(userId: number) {
    try {
      this.logger.log(`구독 만료/취소 처리 시작 - 사용자: ${userId}`);

      return await this.prisma.$transaction(async (tx) => {
        // 1. 사용자 확인
        const user = await tx.user.findUnique({
          where: { id: userId },
          select: {
            id: true,
            email: true,
            status: true,
            userChallenges: {
              where: { status: 'ACTIVE' },
              select: { id: true }
            }
          }
        });

        if (!user) {
          throw new NotFoundException('사용자를 찾을 수 없습니다');
        }

        // 2. 활성 챌린지가 있는지 확인
        const hasActiveChallenge = user.userChallenges.length > 0;

        let newStatus: string;
        if (hasActiveChallenge) {
          // 활성 챌린지가 있으면 CHALLENGER 유지
          newStatus = UserSubscriptionStatus.CHALLENGER;
          this.logger.log(`활성 챌린지가 있어 CHALLENGER 상태 유지 - 사용자: ${userId}`);
        } else {
          // 활성 챌린지가 없으면 NEWCOMER로 복원
          newStatus = UserSubscriptionStatus.NEWCOMER;
          this.logger.log(`활성 챌린지가 없어 NEWCOMER 상태로 복원 - 사용자: ${userId}`);
        }

        // 3. 상태 변경
        const updatedUser = await tx.user.update({
          where: { id: userId },
          data: { status: newStatus }
        });

        this.logger.log(
          `구독 만료/취소 처리 완료 - 사용자: ${userId}, ` +
          `이전상태: ${user.status} -> 현재상태: ${updatedUser.status}`
        );

        return {
          success: true,
          message: '구독이 만료/취소되었습니다',
          data: {
            userId: updatedUser.id,
            status: updatedUser.status,
            hasActiveChallenge
          }
        };
      });
    } catch (error) {
      this.logger.error('구독 만료/취소 처리 실패:', error);
      throw error;
    }
  }

  /**
   * 사용자 구독 상태 조회
   * @param userId 사용자 ID
   */
  async getSubscriptionStatus(userId: number) {
    try {
      this.logger.log(`구독 상태 조회 - 사용자: ${userId}`);

      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          status: true,
          userChallenges: {
            where: { status: 'ACTIVE' },
            select: {
              id: true,
              challengeId: true,
              activatedAt: true,
              expiresAt: true
            }
          }
        }
      });

      if (!user) {
        throw new NotFoundException('사용자를 찾을 수 없습니다');
      }

      return {
        success: true,
        data: {
          userId: user.id,
          email: user.email,
          status: user.status,
          hasActiveChallenge: user.userChallenges.length > 0,
          activeChallenges: user.userChallenges
        }
      };
    } catch (error) {
      this.logger.error('구독 상태 조회 실패:', error);
      throw error;
    }
  }
}
