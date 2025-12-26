import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../../common/services/config.service';

/**
 * Apple App Store Server API를 통한 영수증 검증 서비스
 *
 * App Store Server API v2 사용 (JWT 인증)
 * https://developer.apple.com/documentation/appstoreserverapi
 */
@Injectable()
export class AppleIapService {
  private readonly logger = new Logger(AppleIapService.name);

  // App Store Server API 엔드포인트
  private readonly PRODUCTION_URL = 'https://api.storekit.itunes.apple.com';
  private readonly SANDBOX_URL = 'https://api.storekit-sandbox.itunes.apple.com';

  constructor(private readonly configService: ConfigService) {}

  /**
   * Apple 영수증 검증
   * @param receiptData Base64 인코딩된 영수증 데이터
   * @param transactionId 트랜잭션 ID
   * @returns 검증 결과
   */
  async verifyReceipt(
    receiptData: string,
    transactionId: string,
  ): Promise<AppleVerificationResult> {
    this.logger.log(`Apple 영수증 검증 시작 - transactionId: ${transactionId}`);

    try {
      // 1. JWT 생성 (App Store Connect API Key 사용)
      const jwt = await this.generateJWT();

      // 2. 트랜잭션 정보 조회
      const transactionInfo = await this.getTransactionInfo(jwt, transactionId);

      if (!transactionInfo) {
        return {
          isValid: false,
          error: 'TRANSACTION_NOT_FOUND',
          message: '트랜잭션을 찾을 수 없습니다.',
        };
      }

      // 3. 검증 결과 반환
      return {
        isValid: true,
        transactionId: transactionInfo.transactionId,
        originalTransactionId: transactionInfo.originalTransactionId,
        productId: transactionInfo.productId,
        purchaseDate: new Date(transactionInfo.purchaseDate),
        expiresDate: transactionInfo.expiresDate
          ? new Date(transactionInfo.expiresDate)
          : undefined,
        environment: transactionInfo.environment,
        rawResponse: transactionInfo,
      };
    } catch (error) {
      this.logger.error(`Apple 영수증 검증 실패: ${error.message}`, error.stack);
      return {
        isValid: false,
        error: 'VERIFICATION_FAILED',
        message: error.message,
      };
    }
  }

  /**
   * App Store Server API용 JWT 생성
   * ES256 알고리즘 사용
   */
  private async generateJWT(): Promise<string> {
    const crypto = await import('crypto');
    const jwt = await import('jsonwebtoken');

    const privateKey = this.configService.raw.get<string>('APPLE_IAP_PRIVATE_KEY');
    const keyId = this.configService.raw.get<string>('APPLE_IAP_KEY_ID');
    const issuerId = this.configService.raw.get<string>('APPLE_IAP_ISSUER_ID');
    const bundleId = this.configService.raw.get<string>('APPLE_BUNDLE_ID');

    if (!privateKey || !keyId || !issuerId || !bundleId) {
      throw new Error('Apple IAP 설정이 누락되었습니다.');
    }

    const now = Math.floor(Date.now() / 1000);
    const payload = {
      iss: issuerId,
      iat: now,
      exp: now + 3600, // 1시간 유효
      aud: 'appstoreconnect-v1',
      bid: bundleId,
    };

    const token = jwt.default.sign(payload, privateKey, {
      algorithm: 'ES256',
      header: {
        alg: 'ES256',
        kid: keyId,
        typ: 'JWT',
      },
    });

    return token;
  }

  /**
   * 트랜잭션 정보 조회
   */
  private async getTransactionInfo(
    jwt: string,
    transactionId: string,
  ): Promise<AppleTransactionInfo | null> {
    // 환경에 따라 API 호출 순서 결정
    // Production 환경에서는 Production URL 먼저 시도
    const isProduction = this.configService.raw.get<string>('NODE_ENV') === 'prod';
    const urls = isProduction
      ? [this.PRODUCTION_URL, this.SANDBOX_URL]
      : [this.SANDBOX_URL, this.PRODUCTION_URL];

    for (const baseUrl of urls) {
      try {
        const response = await fetch(
          `${baseUrl}/inApps/v1/transactions/${transactionId}`,
          {
            method: 'GET',
            headers: {
              Authorization: `Bearer ${jwt}`,
              'Content-Type': 'application/json',
            },
          },
        );

        if (response.ok) {
          const data = await response.json();
          // signedTransactionInfo를 디코딩
          const transactionInfo = this.decodeJWS(data.signedTransactionInfo);
          return transactionInfo;
        }

        if (response.status === 404) {
          continue; // 다른 환경에서 시도
        }

        const errorData = await response.json();
        this.logger.warn(`Apple API 오류: ${JSON.stringify(errorData)}`);
      } catch (error) {
        this.logger.warn(`${baseUrl} 호출 실패: ${error.message}`);
      }
    }

    return null;
  }

  /**
   * Apple JWS 디코딩
   */
  private decodeJWS(jws: string): AppleTransactionInfo {
    const parts = jws.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWS format');
    }

    const payload = Buffer.from(parts[1], 'base64url').toString('utf-8');
    return JSON.parse(payload);
  }
}

/**
 * Apple 영수증 검증 결과
 */
export interface AppleVerificationResult {
  isValid: boolean;
  transactionId?: string;
  originalTransactionId?: string;
  productId?: string;
  purchaseDate?: Date;
  expiresDate?: Date;
  environment?: string;
  rawResponse?: any;
  error?: string;
  message?: string;
}

/**
 * Apple 트랜잭션 정보
 */
export interface AppleTransactionInfo {
  transactionId: string;
  originalTransactionId: string;
  productId: string;
  purchaseDate: number;
  expiresDate?: number;
  environment: string;
  bundleId: string;
  type: string;
  inAppOwnershipType: string;
}
