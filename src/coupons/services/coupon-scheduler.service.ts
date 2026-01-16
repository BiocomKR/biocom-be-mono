import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { getNowKST } from '../../common/utils/kst-date.util';

/**
 * 쿠폰 만료 스케줄러
 *
 * Kubernetes CronJob에서 매분 호출
 * - expiresAt이 현재 시간보다 이전인 ACTIVE 쿠폰을 EXPIRED로 변경
 */
@Injectable()
export class CouponSchedulerService {
  private readonly logger = new Logger(CouponSchedulerService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 만료된 쿠폰 상태 업데이트
   */
  async handleCouponExpiryCheck() {
    this.logger.log('🔄 쿠폰 만료 체크 스케줄러 시작...');

    try {
      const now = getNowKST();

      const result = await this.prisma.userCoupon.updateMany({
        where: {
          status: 'ACTIVE',
          expiresAt: { lt: now },
        },
        data: {
          status: 'EXPIRED',
        },
      });

      if (result.count > 0) {
        this.logger.log(`✅ 만료 처리된 쿠폰: ${result.count}개`);
      } else {
        this.logger.log('만료 처리할 쿠폰이 없습니다.');
      }

      return { success: true, expiredCount: result.count };
    } catch (error) {
      this.logger.error(`쿠폰 만료 처리 중 오류: ${error.message}`);
      throw error;
    }
  }

  /**
   * 수동 실행용 (테스트/긴급 대응)
   */
  async runManually() {
    this.logger.log('🧪 수동 실행 - 쿠폰 만료 체크');
    return await this.handleCouponExpiryCheck();
  }
}
