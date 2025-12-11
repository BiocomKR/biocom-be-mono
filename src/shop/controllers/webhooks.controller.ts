import {
  Controller,
  Post,
  Body,
  Logger,
  HttpCode,
  HttpStatus,
  Headers,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { WebhooksService } from '../services/webhooks.service';
import { RawBodyRequest } from '@nestjs/common';
import { Request } from 'express';
import * as crypto from 'crypto';

/**
 * 토스페이먼츠 웹훅 컨트롤러
 *
 * 역할:
 * - 토스페이먼츠 서버에서 전송하는 웹훅 이벤트 수신
 * - 가상계좌 입금 완료, 결제 취소 등 비동기 결제 상태 변경 처리
 *
 * 주의사항:
 * - 반드시 200 OK 응답 (토스가 재시도하지 않도록)
 * - 멱등성 보장 (같은 웹훅이 여러 번 올 수 있음)
 * - 30초 이내 응답 필수
 */
@ApiTags('Webhooks')
@Controller('webhooks/toss')
export class WebhooksController {
  private readonly logger = new Logger(WebhooksController.name);
  private readonly webhookSecretKey = process.env.TOSS_WEBHOOK_SECRET_KEY;

  constructor(private readonly webhooksService: WebhooksService) {}

  /**
   * 토스 웹훅 서명 검증
   *
   * 토스페이먼츠 공식 문서 기준:
   * - 서명 생성: HMAC_SHA256(secretKey, ${payload}:${transmissionTime})
   * - 헤더: tosspayments-webhook-signature, tosspayments-webhook-transmission-time
   *
   * @param rawBody - Raw request body (문자열)
   * @param signature - tosspayments-webhook-signature 헤더 값
   * @param transmissionTime - tosspayments-webhook-transmission-time 헤더 값
   * @returns 검증 성공 여부
   */
  private verifyWebhookSignature(
    rawBody: string,
    signature: string,
    transmissionTime: string,
  ): boolean {
    if (!this.webhookSecretKey) {
      this.logger.warn('⚠️ TOSS_WEBHOOK_SECRET_KEY 미설정 - 서명 검증 건너뜀');
      return true; // 개발 환경에서 키 미설정 시 통과
    }

    try {
      // 토스 공식 문서: HMAC_SHA256(secretKey, ${payload}:${transmissionTime})
      const message = `${rawBody}:${transmissionTime}`;
      const expectedSignature = crypto
        .createHmac('sha256', this.webhookSecretKey)
        .update(message)
        .digest('base64');

      const isValid = signature === expectedSignature;

      if (!isValid) {
        this.logger.error(
          `❌ 웹훅 서명 불일치: expected=${expectedSignature}, received=${signature}`,
        );
      }

      return isValid;
    } catch (error: any) {
      this.logger.error(`❌ 웹훅 서명 검증 오류: ${error.message}`);
      return false;
    }
  }

  /**
   * 토스페이먼츠 결제 웹훅 수신
   *
   * @description
   * 토스페이먼츠 서버가 결제 상태 변경 시 자동으로 호출하는 엔드포인트
   *
   * 처리 이벤트:
   * 1. Payment.Approved - 결제 승인 완료 (가상계좌 입금, 계좌이체 완료)
   * 2. Payment.Canceled - 결제 취소 완료
   * 3. Payment.Failed - 결제 실패
   *
   * @param webhookData - 토스가 보내는 웹훅 데이터
   * @param signature - 토스 서명 (보안 검증용, 선택적)
   * @returns 200 OK (항상)
   */
  @Post('payment')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '토스페이먼츠 웹훅 수신',
    description: '가상계좌 입금 완료, 결제 취소 등 비동기 결제 이벤트 처리',
  })
  @ApiResponse({
    status: 200,
    description: '웹훅 수신 성공 (항상 200 반환)',
    schema: {
      example: { success: true },
    },
  })
  async handleTossPaymentWebhook(
    @Req() req: RawBodyRequest<Request>,
    @Body() webhookData: any,
    @Headers('tosspayments-webhook-signature') signature?: string,
    @Headers('tosspayments-webhook-transmission-time') transmissionTime?: string,
  ) {
    this.logger.log(
      `🔔 토스 웹훅 수신: ${JSON.stringify(webhookData, null, 2)}`,
    );

    try {
      // 1. 서명 검증 (헤더가 있는 경우에만)
      if (signature && transmissionTime) {
        // NestJS rawBody 옵션으로 설정된 rawBody (Buffer)
        const rawBody = req.rawBody?.toString() || JSON.stringify(webhookData);
        const isValid = this.verifyWebhookSignature(
          rawBody,
          signature,
          transmissionTime,
        );

        if (!isValid) {
          this.logger.error('❌ 웹훅 서명 검증 실패 - 요청 거부');
          throw new UnauthorizedException('Invalid webhook signature');
        }

        this.logger.log('✅ 웹훅 서명 검증 성공');
      } else {
        this.logger.warn('⚠️ 웹훅 서명 헤더 없음 - 검증 건너뜀');
      }

      // 2. 웹훅 데이터 처리
      await this.webhooksService.handleTossWebhook(webhookData);

      this.logger.log(`✅ 토스 웹훅 처리 완료`);

      // 토스에게 200 OK 응답 (필수!)
      return { success: true };
    } catch (error: any) {
      this.logger.error(`❌ 토스 웹훅 처리 실패: ${error.message}`);
      this.logger.error(error.stack);

      // 서명 검증 실패는 401 반환
      if (error instanceof UnauthorizedException) {
        throw error;
      }

      // 그 외 에러는 200 OK 반환 (토스 재시도 방지)
      // 토스는 5xx 에러를 받으면 최대 10번 재시도함
      return { success: false, error: error.message };
    }
  }
}
