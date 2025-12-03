import { Injectable, Logger } from '@nestjs/common';
import { Cron } from '@nestjs/schedule';
import { PrismaService } from '../../common/services/prisma.service';
import { GoogleIapService } from './google-iap.service';
import { getNowKST } from '../../common/utils/kst-date.util';

/**
 * IAP 스케줄러 서비스
 *
 * 1. Google Acknowledge 재시도: 실패한 Acknowledge 건 재처리
 *    - 3일 내 미처리 시 Google에서 자동 환불
 *    - 매 시간 실행하여 실패 건 재시도
 */
@Injectable()
export class IapSchedulerService {
  private readonly logger = new Logger(IapSchedulerService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly googleIapService: GoogleIapService,
  ) {}

  /**
   * Google Acknowledge 재시도
   *
   * 매시간 정각에 실행
   * - VERIFIED 상태이면서 acknowledgedAt이 NULL인 Google 영수증 조회
   * - 3일 이내 건만 재시도 (3일 초과 시 이미 환불됨)
   *
   * Cron 표현식: 0 0 * * * * (초 분 시 일 월 요일)
   * - 0초, 0분, 매시간
   *
   * NOTE: Kubernetes CronJob으로 실행 권장. 멀티 파드 환경에서 중복 실행 방지 필요.
   */
  // @Cron('0 0 * * * *', {
  //   name: 'retry-google-acknowledge',
  //   timeZone: 'Asia/Seoul',
  // })
  async handleGoogleAcknowledgeRetry() {
    this.logger.log('🔄 Google Acknowledge 재시도 스케줄러 시작...');

    const threeDaysAgo = getNowKST();
    threeDaysAgo.setDate(threeDaysAgo.getDate() - 3);

    // 재시도 대상 조회:
    // - Google 플랫폼
    // - VERIFIED 상태 (검증 성공했지만 Acknowledge 실패)
    // - acknowledgedAt이 NULL
    // - 3일 이내 생성
    const pendingReceipts = await this.prisma.iAPReceipt.findMany({
      where: {
        platform: 'GOOGLE',
        status: 'VERIFIED',
        acknowledgedAt: null,
        createdAt: {
          gte: threeDaysAgo,
        },
      },
      include: {
        iapProduct: true,
      },
      orderBy: {
        createdAt: 'asc',
      },
    });

    this.logger.log(`📋 Acknowledge 재시도 대상: ${pendingReceipts.length}건`);

    if (pendingReceipts.length === 0) {
      this.logger.log('재시도 대상이 없습니다.');
      return;
    }

    let successCount = 0;
    let failCount = 0;

    for (const receipt of pendingReceipts) {
      try {
        const productId = receipt.iapProduct.googleProductId;
        if (!productId) {
          this.logger.warn(`Google productId 없음: receiptId=${receipt.id}`);
          failCount++;
          continue;
        }

        this.logger.log(
          `재시도 중: receiptId=${receipt.id}, transactionId=${receipt.transactionId}`,
        );

        const acknowledged = await this.googleIapService.acknowledgePurchase(
          productId,
          receipt.receiptData,
        );

        if (acknowledged) {
          await this.prisma.iAPReceipt.update({
            where: { id: receipt.id },
            data: { acknowledgedAt: getNowKST() },
          });
          successCount++;
          this.logger.log(`✅ Acknowledge 성공: receiptId=${receipt.id}`);
        } else {
          failCount++;
          this.logger.warn(`❌ Acknowledge 실패: receiptId=${receipt.id}`);
        }
      } catch (error) {
        failCount++;
        this.logger.error(
          `Acknowledge 재시도 중 오류: receiptId=${receipt.id}, error=${error.message}`,
        );
      }
    }

    this.logger.log(
      `✅ Google Acknowledge 재시도 완료: 성공 ${successCount}건, 실패 ${failCount}건`,
    );
  }

  /**
   * 수동 실행용 (테스트/긴급 대응)
   */
  async runManually() {
    this.logger.log('🧪 수동 실행 - Google Acknowledge 재시도');
    await this.handleGoogleAcknowledgeRetry();
  }
}
