import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  Query,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus,
  Res
} from '@nestjs/common';
import { Response } from 'express';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBearerAuth,
  ApiBody,
  ApiParam
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PaymentService } from '../services/payment.service';
import {
  PreparePaymentDto,
  ConfirmPaymentDto,
  CancelPaymentDto,
  PaymentResponseDto,
  PaymentWebhookDto
} from '../dto/payment/payment.dto';

@Controller('shop/payment')
export class PaymentController {
  constructor(private readonly paymentService: PaymentService) {}

  /**
   * 결제 준비
   * 클라이언트에서 토스페이먼츠 SDK 초기화용 데이터 제공
   */
  @Post('prepare')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: '결제 준비', 
    description: '주문 정보를 기반으로 결제 준비 데이터를 생성합니다' 
  })
  @ApiBody({ type: PreparePaymentDto })
  @ApiResponse({ status: 200, description: '성공', type: PaymentResponseDto })
  @ApiResponse({ status: 404, description: '주문을 찾을 수 없음' })
  async preparePayment(
    @Request() req,
    @Body() dto: PreparePaymentDto
  ): Promise<PaymentResponseDto> {
    return this.paymentService.preparePayment(req.user.id, dto.orderNumber);
  }

  /**
   * 결제 승인
   * 클라이언트에서 결제 완료 후 서버 승인 처리
   */
  @Post('confirm')
  @ApiOperation({ 
    summary: '결제 승인', 
    description: '토스페이먼츠 결제를 승인하고 주문을 완료합니다' 
  })
  @ApiBody({ type: ConfirmPaymentDto })
  @ApiResponse({ status: 200, description: '성공', type: PaymentResponseDto })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  @ApiResponse({ status: 404, description: '주문을 찾을 수 없음' })
  async confirmPayment(
    @Body() dto: ConfirmPaymentDto
  ): Promise<PaymentResponseDto> {
    return this.paymentService.confirmPayment(dto);
  }

  /**
   * 결제 취소
   */
  @Post('cancel')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: '결제 취소', 
    description: '완료된 결제를 취소합니다' 
  })
  @ApiBody({ type: CancelPaymentDto })
  @ApiResponse({ status: 200, description: '성공', type: PaymentResponseDto })
  @ApiResponse({ status: 400, description: '취소 불가능한 상태' })
  @ApiResponse({ status: 404, description: '주문을 찾을 수 없음' })
  async cancelPayment(
    @Request() req,
    @Body() dto: CancelPaymentDto
  ): Promise<PaymentResponseDto> {
    return this.paymentService.cancelPayment(req.user.id, dto);
  }

  /**
   * 토스페이먼츠 웹훅
   * 결제 상태 변경 알림 수신
   */
  @Post('webhook')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ 
    summary: '토스페이먼츠 웹훅', 
    description: '토스페이먼츠에서 전송하는 결제 상태 변경 웹훅을 처리합니다' 
  })
  @ApiBody({ type: PaymentWebhookDto })
  @ApiResponse({ status: 200, description: '처리 완료' })
  async handleWebhook(
    @Body() dto: PaymentWebhookDto
  ): Promise<{ received: boolean }> {
    await this.paymentService.handleWebhook(dto);
    return { received: true };
  }

  /**
   * 결제 상태 조회
   */
  @Get('status/:orderNumber')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '결제 상태 조회',
    description: '주문의 결제 상태를 조회합니다'
  })
  @ApiParam({ name: 'orderNumber', description: '주문번호' })
  @ApiResponse({ status: 200, description: '성공' })
  @ApiResponse({ status: 404, description: '주문을 찾을 수 없음' })
  async getPaymentStatus(
    @Request() req,
    @Param('orderNumber') orderNumber: string
  ): Promise<any> {
    const payment = await this.paymentService.preparePayment(req.user.id, orderNumber);
    return {
      orderNumber,
      status: payment.status,
      amount: payment.amount,
      paymentKey: payment.paymentKey
    };
  }

}

/**
 * 토스페이먼츠 결제 콜백 컨트롤러
 * WebView에서 URL 감지를 위한 단순 HTML 페이지 반환
 */
@Controller('payment')
export class PaymentCallbackController {
  /**
   * 결제 성공 콜백
   * 토스페이먼츠에서 결제 성공 시 리다이렉트되는 URL
   * Query params: paymentKey, orderId, amount
   */
  @Get('success')
  @ApiOperation({
    summary: '토스 결제 성공 콜백',
    description: 'WebView URL 감지용 단순 HTML 페이지 반환'
  })
  async paymentSuccess(
    @Query('paymentKey') paymentKey: string,
    @Query('orderId') orderId: string,
    @Query('amount') amount: string,
    @Res() res: Response
  ): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>결제 처리중</title>
        <style>
          body {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background-color: #f5f5f5;
          }
          .container {
            text-align: center;
            padding: 20px;
          }
          .spinner {
            border: 4px solid #f3f3f3;
            border-top: 4px solid #3498db;
            border-radius: 50%;
            width: 40px;
            height: 40px;
            animation: spin 1s linear infinite;
            margin: 0 auto 20px;
          }
          @keyframes spin {
            0% { transform: rotate(0deg); }
            100% { transform: rotate(360deg); }
          }
          h1 { color: #333; font-size: 24px; margin: 0 0 10px 0; }
          p { color: #666; font-size: 14px; margin: 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="spinner"></div>
          <h1>결제 처리중입니다</h1>
          <p>잠시만 기다려주세요...</p>
        </div>
      </body>
      </html>
    `;

    res.status(200).send(html);
  }

  /**
   * 결제 실패 콜백
   * 토스페이먼츠에서 결제 실패 시 리다이렉트되는 URL
   * Query params: code, message, orderId
   */
  @Get('fail')
  @ApiOperation({
    summary: '토스 결제 실패 콜백',
    description: 'WebView URL 감지용 단순 HTML 페이지 반환'
  })
  async paymentFail(
    @Query('code') code: string,
    @Query('message') message: string,
    @Query('orderId') orderId: string,
    @Res() res: Response
  ): Promise<void> {
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <meta name="viewport" content="width=device-width, initial-scale=1.0">
        <title>결제 실패</title>
        <style>
          body {
            display: flex;
            justify-content: center;
            align-items: center;
            height: 100vh;
            margin: 0;
            font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
            background-color: #f5f5f5;
          }
          .container {
            text-align: center;
            padding: 20px;
          }
          .icon {
            font-size: 48px;
            color: #e74c3c;
            margin-bottom: 20px;
          }
          h1 { color: #333; font-size: 24px; margin: 0 0 10px 0; }
          p { color: #666; font-size: 14px; margin: 0; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="icon">✕</div>
          <h1>결제에 실패했습니다</h1>
          <p>${message || '결제 중 오류가 발생했습니다'}</p>
        </div>
      </body>
      </html>
    `;

    res.status(200).send(html);
  }
}