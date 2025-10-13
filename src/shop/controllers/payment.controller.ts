import { 
  Controller, 
  Get,
  Post, 
  Body, 
  Param,
  UseGuards,
  Request,
  HttpCode,
  HttpStatus
} from '@nestjs/common';
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

// 쇼핑몰 관련 API 임시 비활성화
@Controller('api/shop/payment')
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