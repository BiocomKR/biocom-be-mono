import { Controller, Post, Body, Headers, HttpCode, Logger, RawBodyRequest, Req } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiExcludeEndpoint } from '@nestjs/swagger';
import { Request } from 'express';
import { WebhookService } from './services/webhook.service';
import { AppleWebhookDto, GoogleWebhookDto } from './dto/webhook.dto';
import { ConfigService } from '../common/services/config.service';

/**
 * IAP 웹훅 컨트롤러
 * Apple S2S Notification / Google RTDN 수신
 */
@ApiTags('IAP - Webhook')
@Controller('iap/webhook')
export class WebhookController {
  private readonly logger = new Logger(WebhookController.name);

  constructor(
    private readonly webhookService: WebhookService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * Apple App Store Server Notification V2
   * https://developer.apple.com/documentation/appstoreservernotifications
   */
  @Post('apple')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Apple S2S Notification',
    description: 'Apple App Store Server에서 전송하는 웹훅을 수신합니다. (환불, 구독 갱신 등)',
  })
  @ApiResponse({ status: 200, description: '웹훅 수신 성공' })
  async handleAppleWebhook(@Body() dto: AppleWebhookDto) {
    this.logger.log('Apple 웹훅 수신');

    try {
      // JWS 디코딩 (서명 검증은 TODO)
      const payload = this.decodeAppleJWS(dto.signedPayload);
      const result = await this.webhookService.processAppleWebhook(payload);
      return result;
    } catch (error) {
      this.logger.error(`Apple 웹훅 처리 실패: ${error.message}`, error.stack);
      // Apple은 200 응답이 아니면 재시도하므로 에러여도 200 반환
      return { success: false, message: error.message };
    }
  }

  /**
   * Google Play Real-time Developer Notification
   * https://developer.android.com/google/play/billing/rtdn-reference
   */
  @Post('google')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Google RTDN',
    description: 'Google Play에서 전송하는 웹훅을 수신합니다. (환불, 구독 갱신 등)',
  })
  @ApiResponse({ status: 200, description: '웹훅 수신 성공' })
  async handleGoogleWebhook(@Body() dto: GoogleWebhookDto) {
    this.logger.log('Google 웹훅 수신');

    // TODO: Google Pub/Sub 메시지 검증 추가 (보안 강화 필수)
    // - 메시지 발신자가 Google인지 확인
    // - Pub/Sub Push 인증 토큰 검증 (Authorization 헤더)
    // - https://cloud.google.com/pubsub/docs/authenticate-push-subscriptions

    try {
      // Base64 디코딩
      const decodedData = Buffer.from(dto.message.data, 'base64').toString('utf-8');
      const payload = JSON.parse(decodedData);
      const result = await this.webhookService.processGoogleWebhook(payload);
      return result;
    } catch (error) {
      this.logger.error(`Google 웹훅 처리 실패: ${error.message}`, error.stack);
      // Google Pub/Sub도 200 응답이 아니면 재시도
      return { success: false, message: error.message };
    }
  }

  /**
   * Apple JWS 디코딩 (서명 검증 없이 페이로드만 추출)
   * TODO: Apple 인증서 체인으로 JWS 서명 검증 추가 (보안 강화 필수)
   * - Apple 루트 인증서 다운로드 및 체인 검증
   * - jose 또는 node-jose 라이브러리 사용 권장
   */
  private decodeAppleJWS(jws: string): any {
    const parts = jws.split('.');
    if (parts.length !== 3) {
      throw new Error('Invalid JWS format');
    }

    const payload = Buffer.from(parts[1], 'base64url').toString('utf-8');
    const decoded = JSON.parse(payload);

    // 내부의 signedTransactionInfo도 디코딩
    if (decoded.data?.signedTransactionInfo) {
      decoded.data.signedTransactionInfo = this.decodeAppleJWS(decoded.data.signedTransactionInfo);
    }
    if (decoded.data?.signedRenewalInfo) {
      decoded.data.signedRenewalInfo = this.decodeAppleJWS(decoded.data.signedRenewalInfo);
    }

    return decoded;
  }
}
