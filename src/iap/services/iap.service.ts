import { Injectable, Logger, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { AppleIapService, AppleVerificationResult } from './apple-iap.service';
import { GoogleIapService, GoogleVerificationResult } from './google-iap.service';
import { VerifyReceiptDto, IAPPlatformType } from '../dto/verify-receipt.dto';
import { IAPReceiptStatus } from '@prisma/client';
import { getNowKST } from '../../common/utils/kst-date.util';

type TransactionClient = Omit<PrismaService, '$connect' | '$disconnect' | '$on' | '$transaction' | '$use' | '$extends'>;
type VerificationResult = AppleVerificationResult | GoogleVerificationResult;

/**
 * IAP 통합 서비스
 * Apple/Google 영수증 검증 및 구매 처리를 통합 관리
 */
@Injectable()
export class IapService {
  private readonly logger = new Logger(IapService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly appleIapService: AppleIapService,
    private readonly googleIapService: GoogleIapService,
  ) {}

  /**
   * 영수증 검증 및 구매 처리
   * 트랜잭션으로 묶어 동시 요청 시 중복 티켓 발급 방지
   * @param userId 사용자 ID
   * @param dto 영수증 검증 요청 DTO
   */
  async verifyAndProcessPurchase(
    userId: number,
    dto: VerifyReceiptDto,
  ): Promise<IapPurchaseResult> {
    this.logger.log(`영수증 검증 시작 - userId: ${userId}, platform: ${dto.platform}`);

    // 1. IAP 상품 조회 (트랜잭션 외부에서 수행 - 변경 없는 조회)
    const iapProduct = await this.findIapProduct(dto.platform, dto.productId);
    if (!iapProduct) {
      throw new BadRequestException('등록되지 않은 IAP 상품입니다.');
    }

    // 2. 플랫폼별 영수증 검증 (외부 API 호출 - 트랜잭션 외부)
    let verificationResult;
    if (dto.platform === IAPPlatformType.APPLE) {
      verificationResult = await this.appleIapService.verifyReceipt(
        dto.receiptData,
        dto.transactionId,
      );
    } else {
      verificationResult = await this.googleIapService.verifyReceipt(
        dto.productId,
        dto.receiptData,
      );

      // Google: orderId 매칭 검증
      if (verificationResult.isValid && verificationResult.orderId) {
        if (dto.transactionId !== verificationResult.orderId) {
          this.logger.warn(
            `Google orderId 불일치 - 요청: ${dto.transactionId}, 응답: ${verificationResult.orderId}`,
          );
        }
      }
    }

    // 검증 실패 시 트랜잭션 없이 실패 기록만 저장
    if (!verificationResult.isValid) {
      const receipt = await this.saveReceipt(userId, dto, iapProduct.id, verificationResult);
      return {
        success: false,
        message: verificationResult.message || '영수증 검증에 실패했습니다.',
        receiptId: receipt.id,
      };
    }

    // 3. 트랜잭션으로 중복 체크 + 저장 + 티켓 발급을 원자적으로 처리
    const result = await this.prisma.$transaction(async (tx) => {
      // 중복 트랜잭션 확인 (트랜잭션 내에서 락 효과)
      const existingReceipt = await tx.iAPReceipt.findUnique({
        where: { transactionId: dto.transactionId },
      });

      if (existingReceipt?.status === 'VERIFIED') {
        throw new ConflictException('이미 처리된 구매입니다.');
      }

      // 영수증 저장
      const receipt = await this.saveReceiptInTx(tx, userId, dto, iapProduct.id, verificationResult);

      // 챌린지 티켓 발급
      const ticket = await this.issueChallengeTicketInTx(tx, userId, iapProduct.productId);

      // 영수증에 티켓 ID 연결
      await tx.iAPReceipt.update({
        where: { id: receipt.id },
        data: { challengeTicketId: ticket.id },
      });

      this.logger.log(`구매 처리 완료 - receiptId: ${receipt.id}, ticketId: ${ticket.id}`);

      return {
        success: true,
        message: '구매가 완료되었습니다.',
        receiptId: receipt.id,
        ticketId: ticket.id,
      };
    });

    // 4. Google Acknowledge는 트랜잭션 성공 후 별도 처리
    // 실패해도 티켓은 이미 발급됨 - 로깅 후 계속 진행
    if (dto.platform === IAPPlatformType.GOOGLE) {
      const acknowledged = await this.googleIapService.acknowledgePurchase(
        dto.productId,
        dto.receiptData,
      );
      if (acknowledged) {
        // Acknowledge 성공 시 시간 기록
        await this.prisma.iAPReceipt.update({
          where: { transactionId: dto.transactionId },
          data: { acknowledgedAt: getNowKST() },
        });
      } else {
        this.logger.error(
          `Google Acknowledge 실패 - transactionId: ${dto.transactionId}. 3일 내 미처리 시 자동 환불 위험`,
        );
        // acknowledgedAt이 NULL인 채로 남아있어 크론잡에서 재시도 가능
      }
    }

    return result;
  }

  /**
   * IAP 상품 조회
   */
  private async findIapProduct(platform: IAPPlatformType, productId: string) {
    if (platform === IAPPlatformType.APPLE) {
      return this.prisma.iAPProduct.findUnique({
        where: { appleProductId: productId },
        include: { product: true },
      });
    } else {
      return this.prisma.iAPProduct.findUnique({
        where: { googleProductId: productId },
        include: { product: true },
      });
    }
  }

  /**
   * 영수증 기록 저장 (트랜잭션 외부용)
   */
  private async saveReceipt(
    userId: number,
    dto: VerifyReceiptDto,
    iapProductId: number,
    verificationResult: VerificationResult,
  ) {
    return this.saveReceiptInTx(this.prisma, userId, dto, iapProductId, verificationResult);
  }

  /**
   * 영수증 기록 저장 (트랜잭션 내부용)
   */
  private async saveReceiptInTx(
    tx: TransactionClient,
    userId: number,
    dto: VerifyReceiptDto,
    iapProductId: number,
    verificationResult: VerificationResult,
  ) {
    const status: IAPReceiptStatus = verificationResult.isValid ? 'VERIFIED' : 'FAILED';
    const purchaseDate = this.extractPurchaseDate(verificationResult);

    // 공통 데이터
    const commonData = {
      verificationResponse: verificationResult.rawResponse || {},
      status,
    };

    // VERIFIED 시 주요 필드도 업데이트
    const updateData = status === 'VERIFIED'
      ? {
          ...commonData,
          purchaseDate,
          expiresDate: this.extractExpiresDate(verificationResult),
          originalTransactionId: this.extractOriginalTransactionId(verificationResult),
        }
      : commonData;

    return tx.iAPReceipt.upsert({
      where: { transactionId: dto.transactionId },
      create: {
        userId,
        iapProductId,
        platform: dto.platform as any,
        transactionId: dto.transactionId,
        originalTransactionId: this.extractOriginalTransactionId(verificationResult),
        purchaseDate,
        expiresDate: this.extractExpiresDate(verificationResult),
        receiptData: dto.receiptData,
        verificationResponse: verificationResult.rawResponse || {},
        status,
      },
      update: updateData,
    });
  }

  /**
   * 챌린지 티켓 발급 (트랜잭션 내부용)
   */
  private async issueChallengeTicketInTx(
    tx: TransactionClient,
    userId: number,
    productId: number,
  ) {
    // 상품 정보 조회
    const product = await tx.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new BadRequestException('상품 정보를 찾을 수 없습니다.');
    }

    // 티켓 발급
    return tx.challengeTicket.create({
      data: {
        userId,
        productId,
        ticketType: 'IAP',
        status: 'AVAILABLE',
        purchasePrice: product.price,
        purchasedAt: getNowKST(),
        expiresAt: this.calculateExpiryDate(30), // 30일 후 만료
      },
    });
  }

  /**
   * 검증 결과에서 purchaseDate 추출
   */
  private extractPurchaseDate(result: VerificationResult): Date {
    if ('purchaseDate' in result && result.purchaseDate) {
      return result.purchaseDate;
    }
    if ('purchaseTime' in result && result.purchaseTime) {
      return result.purchaseTime;
    }
    return getNowKST();
  }

  /**
   * 검증 결과에서 expiresDate 추출
   */
  private extractExpiresDate(result: VerificationResult): Date | undefined {
    if ('expiresDate' in result) {
      return result.expiresDate;
    }
    return undefined;
  }

  /**
   * 검증 결과에서 originalTransactionId 추출
   */
  private extractOriginalTransactionId(result: VerificationResult): string | undefined {
    if ('originalTransactionId' in result) {
      return result.originalTransactionId;
    }
    return undefined;
  }

  /**
   * 만료일 계산 (KST 기준)
   */
  private calculateExpiryDate(days: number): Date {
    const date = getNowKST();
    date.setDate(date.getDate() + days);
    return date;
  }

  /**
   * 사용자의 구매 내역 조회
   */
  async getUserPurchases(userId: number) {
    return this.prisma.iAPReceipt.findMany({
      where: { userId },
      include: {
        iapProduct: {
          include: { product: true },
        },
        challengeTicket: true,
      },
      orderBy: { createdAt: 'desc' },
    });
  }

  /**
   * IAP 상품 목록 조회
   */
  async getIapProducts() {
    return this.prisma.iAPProduct.findMany({
      where: { isActive: true },
      include: { product: true },
      orderBy: { createdAt: 'desc' },
    });
  }
}

/**
 * IAP 구매 처리 결과
 */
export interface IapPurchaseResult {
  success: boolean;
  message: string;
  receiptId?: number;
  ticketId?: number;
}
