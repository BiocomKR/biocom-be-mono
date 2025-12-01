import { Injectable, Logger, BadRequestException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { AppleIapService } from './apple-iap.service';
import { GoogleIapService } from './google-iap.service';
import { VerifyReceiptDto, IAPPlatformType } from '../dto/verify-receipt.dto';
import { IAPReceiptStatus } from '@prisma/client';

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
   * @param userId 사용자 ID
   * @param dto 영수증 검증 요청 DTO
   */
  async verifyAndProcessPurchase(
    userId: number,
    dto: VerifyReceiptDto,
  ): Promise<IapPurchaseResult> {
    this.logger.log(`영수증 검증 시작 - userId: ${userId}, platform: ${dto.platform}`);

    // 1. 중복 트랜잭션 확인
    const existingReceipt = await this.prisma.iAPReceipt.findUnique({
      where: { transactionId: dto.transactionId },
    });

    if (existingReceipt) {
      if (existingReceipt.status === 'VERIFIED') {
        throw new ConflictException('이미 처리된 구매입니다.');
      }
      // 실패했던 검증 재시도 허용
    }

    // 2. IAP 상품 조회
    const iapProduct = await this.findIapProduct(dto.platform, dto.productId);
    if (!iapProduct) {
      throw new BadRequestException('등록되지 않은 IAP 상품입니다.');
    }

    // 3. 플랫폼별 영수증 검증
    let verificationResult;
    if (dto.platform === IAPPlatformType.APPLE) {
      verificationResult = await this.appleIapService.verifyReceipt(
        dto.receiptData,
        dto.transactionId,
      );
    } else {
      verificationResult = await this.googleIapService.verifyReceipt(
        dto.productId,
        dto.receiptData, // Google의 경우 purchaseToken
      );
    }

    // 4. 영수증 기록 저장/업데이트
    const receipt = await this.saveReceipt(userId, dto, iapProduct.id, verificationResult);

    if (!verificationResult.isValid) {
      return {
        success: false,
        message: verificationResult.message || '영수증 검증에 실패했습니다.',
        receiptId: receipt.id,
      };
    }

    // 5. Google의 경우 구매 확인 (Acknowledge) 처리
    if (dto.platform === IAPPlatformType.GOOGLE) {
      await this.googleIapService.acknowledgePurchase(dto.productId, dto.receiptData);
    }

    // 6. 챌린지 티켓 발급
    const ticket = await this.issueChallengeTicket(userId, iapProduct.productId, receipt.id);

    // 7. 영수증에 티켓 ID 연결
    await this.prisma.iAPReceipt.update({
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
   * 영수증 기록 저장
   */
  private async saveReceipt(
    userId: number,
    dto: VerifyReceiptDto,
    iapProductId: number,
    verificationResult: any,
  ) {
    const status: IAPReceiptStatus = verificationResult.isValid ? 'VERIFIED' : 'FAILED';
    const purchaseDate = verificationResult.purchaseDate || verificationResult.purchaseTime || new Date();

    return this.prisma.iAPReceipt.upsert({
      where: { transactionId: dto.transactionId },
      create: {
        userId,
        iapProductId,
        platform: dto.platform as any,
        transactionId: dto.transactionId,
        originalTransactionId: verificationResult.originalTransactionId,
        purchaseDate,
        expiresDate: verificationResult.expiresDate,
        receiptData: dto.receiptData,
        verificationResponse: verificationResult.rawResponse || {},
        status,
      },
      update: {
        verificationResponse: verificationResult.rawResponse || {},
        status,
      },
    });
  }

  /**
   * 챌린지 티켓 발급
   */
  private async issueChallengeTicket(
    userId: number,
    productId: number,
    receiptId: number,
  ) {
    // 상품 정보 조회
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new BadRequestException('상품 정보를 찾을 수 없습니다.');
    }

    // 티켓 발급
    return this.prisma.challengeTicket.create({
      data: {
        userId,
        productId,
        ticketType: 'IAP',
        status: 'AVAILABLE',
        purchasePrice: product.price,
        purchasedAt: new Date(),
        expiresAt: this.calculateExpiryDate(30), // 30일 후 만료
      },
    });
  }

  /**
   * 만료일 계산
   */
  private calculateExpiryDate(days: number): Date {
    const date = new Date();
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
