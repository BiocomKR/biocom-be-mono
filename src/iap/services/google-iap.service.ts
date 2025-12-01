import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '../../common/services/config.service';

/**
 * Google Play Developer API를 통한 영수증 검증 서비스
 *
 * Google Play Android Developer API 사용
 * https://developers.google.com/android-publisher/api-ref/rest
 */
@Injectable()
export class GoogleIapService {
  private readonly logger = new Logger(GoogleIapService.name);

  // Google Play Developer API 엔드포인트
  private readonly API_URL = 'https://androidpublisher.googleapis.com/androidpublisher/v3';

  constructor(private readonly configService: ConfigService) {}

  /**
   * Google Play 영수증 검증
   * @param productId 상품 ID
   * @param purchaseToken 구매 토큰
   * @returns 검증 결과
   */
  async verifyReceipt(
    productId: string,
    purchaseToken: string,
  ): Promise<GoogleVerificationResult> {
    this.logger.log(`Google 영수증 검증 시작 - productId: ${productId}`);

    try {
      // 1. Access Token 획득 (Service Account 사용)
      const accessToken = await this.getAccessToken();

      // 2. 구매 정보 조회
      const packageName = this.configService.raw.get<string>('GOOGLE_PACKAGE_NAME');
      if (!packageName) {
        throw new Error('GOOGLE_PACKAGE_NAME이 설정되지 않았습니다.');
      }

      const purchaseInfo = await this.getPurchaseInfo(
        accessToken,
        packageName,
        productId,
        purchaseToken,
      );

      if (!purchaseInfo) {
        return {
          isValid: false,
          error: 'PURCHASE_NOT_FOUND',
          message: '구매 정보를 찾을 수 없습니다.',
        };
      }

      // 3. 구매 상태 확인
      // purchaseState: 0=구매완료, 1=취소, 2=보류중
      if (purchaseInfo.purchaseState !== 0) {
        return {
          isValid: false,
          error: 'INVALID_PURCHASE_STATE',
          message: `구매 상태가 유효하지 않습니다. (state: ${purchaseInfo.purchaseState})`,
        };
      }

      // 4. 검증 결과 반환
      return {
        isValid: true,
        orderId: purchaseInfo.orderId,
        productId: productId,
        purchaseTime: new Date(parseInt(purchaseInfo.purchaseTimeMillis)),
        purchaseState: purchaseInfo.purchaseState,
        consumptionState: purchaseInfo.consumptionState,
        acknowledged: purchaseInfo.acknowledgementState === 1,
        rawResponse: purchaseInfo,
      };
    } catch (error) {
      this.logger.error(`Google 영수증 검증 실패: ${error.message}`, error.stack);
      return {
        isValid: false,
        error: 'VERIFICATION_FAILED',
        message: error.message,
      };
    }
  }

  /**
   * 구매 확인 처리 (Acknowledge)
   * 구매 후 3일 내에 확인하지 않으면 자동 환불됨
   */
  async acknowledgePurchase(
    productId: string,
    purchaseToken: string,
  ): Promise<boolean> {
    try {
      const accessToken = await this.getAccessToken();
      const packageName = this.configService.raw.get<string>('GOOGLE_PACKAGE_NAME');

      const response = await fetch(
        `${this.API_URL}/applications/${packageName}/purchases/products/${productId}/tokens/${purchaseToken}:acknowledge`,
        {
          method: 'POST',
          headers: {
            Authorization: `Bearer ${accessToken}`,
            'Content-Type': 'application/json',
          },
        },
      );

      if (response.ok) {
        this.logger.log(`구매 확인 완료 - productId: ${productId}`);
        return true;
      }

      const errorData = await response.json();
      this.logger.error(`구매 확인 실패: ${JSON.stringify(errorData)}`);
      return false;
    } catch (error) {
      this.logger.error(`구매 확인 중 오류: ${error.message}`);
      return false;
    }
  }

  /**
   * Service Account를 사용하여 Access Token 획득
   */
  private async getAccessToken(): Promise<string> {
    const jwt = await import('jsonwebtoken');

    const serviceAccountEmail = this.configService.raw.get<string>('GOOGLE_SERVICE_ACCOUNT_EMAIL');
    const privateKey = this.configService.raw.get<string>('GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY');

    if (!serviceAccountEmail || !privateKey) {
      throw new Error('Google Service Account 설정이 누락되었습니다.');
    }

    const now = Math.floor(Date.now() / 1000);
    const jwtPayload = {
      iss: serviceAccountEmail,
      scope: 'https://www.googleapis.com/auth/androidpublisher',
      aud: 'https://oauth2.googleapis.com/token',
      iat: now,
      exp: now + 3600,
    };

    const signedJwt = jwt.default.sign(jwtPayload, privateKey.replace(/\\n/g, '\n'), {
      algorithm: 'RS256',
    });

    // JWT를 Access Token으로 교환
    const response = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/x-www-form-urlencoded',
      },
      body: new URLSearchParams({
        grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
        assertion: signedJwt,
      }),
    });

    if (!response.ok) {
      const error = await response.json();
      throw new Error(`Access Token 획득 실패: ${JSON.stringify(error)}`);
    }

    const data = await response.json();
    return data.access_token;
  }

  /**
   * 구매 정보 조회
   */
  private async getPurchaseInfo(
    accessToken: string,
    packageName: string,
    productId: string,
    purchaseToken: string,
  ): Promise<GooglePurchaseInfo | null> {
    const response = await fetch(
      `${this.API_URL}/applications/${packageName}/purchases/products/${productId}/tokens/${purchaseToken}`,
      {
        method: 'GET',
        headers: {
          Authorization: `Bearer ${accessToken}`,
          'Content-Type': 'application/json',
        },
      },
    );

    if (response.ok) {
      return response.json();
    }

    if (response.status === 404) {
      return null;
    }

    const errorData = await response.json();
    throw new Error(`구매 정보 조회 실패: ${JSON.stringify(errorData)}`);
  }
}

/**
 * Google 영수증 검증 결과
 */
export interface GoogleVerificationResult {
  isValid: boolean;
  orderId?: string;
  productId?: string;
  purchaseTime?: Date;
  purchaseState?: number;
  consumptionState?: number;
  acknowledged?: boolean;
  rawResponse?: any;
  error?: string;
  message?: string;
}

/**
 * Google 구매 정보
 */
export interface GooglePurchaseInfo {
  kind: string;
  purchaseTimeMillis: string;
  purchaseState: number; // 0=구매완료, 1=취소, 2=보류중
  consumptionState: number; // 0=미소비, 1=소비됨
  developerPayload?: string;
  orderId: string;
  purchaseType?: number;
  acknowledgementState: number; // 0=미확인, 1=확인됨
  purchaseToken?: string;
  productId?: string;
  quantity?: number;
  obfuscatedExternalAccountId?: string;
  obfuscatedExternalProfileId?: string;
  regionCode?: string;
}
