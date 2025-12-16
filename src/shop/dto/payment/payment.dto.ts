import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsNumber, IsOptional, IsObject, Min, MaxLength } from 'class-validator';

/**
 * 결제 준비 요청 DTO
 */
export class PreparePaymentDto {
  @ApiProperty({ description: '주문번호' })
  @IsString()
  orderNumber: string;
}

/**
 * 결제 승인 요청 DTO
 *
 * 참고: 앱에서 orderId로 보내며, 이 값은 우리 시스템의 orderNumber(O2025...)입니다.
 * 토스페이먼츠 API에도 orderId 필드로 그대로 전달됩니다.
 */
export class ConfirmPaymentDto {
  @ApiProperty({ description: '토스페이먼츠 결제키' })
  @IsString()
  paymentKey: string;

  @ApiProperty({ description: '주문번호 (O2025... 형식)' })
  @IsString()
  orderId: string;

  @ApiProperty({ description: '결제 금액' })
  @IsNumber()
  @Min(100)
  amount: number;
}

/**
 * 결제 취소 요청 DTO
 */
export class CancelPaymentDto {
  @ApiProperty({ description: '주문번호' })
  @IsString()
  orderNumber: string;

  @ApiProperty({ description: '취소 사유' })
  @IsString()
  @MaxLength(200)
  cancelReason: string;

  @ApiPropertyOptional({ description: '부분 취소 금액 (미입력 시 전액 취소)' })
  @IsOptional()
  @IsNumber()
  @Min(1)
  cancelAmount?: number;

  @ApiPropertyOptional({ description: '환불 계좌 정보 (가상계좌 결제 시)' })
  @IsOptional()
  @IsObject()
  refundAccount?: {
    bank: string;
    accountNumber: string;
    holderName: string;
  };
}

/**
 * 결제 응답 DTO
 */
export class PaymentResponseDto {
  @ApiProperty({ description: '주문 ID' })
  orderId: number;

  @ApiProperty({ description: '주문번호' })
  orderNumber: string;

  @ApiProperty({ description: '결제 금액' })
  amount: number;

  @ApiProperty({ description: '주문명' })
  orderName: string;

  @ApiProperty({ description: '구매자명' })
  customerName: string;

  @ApiProperty({ description: '구매자 이메일' })
  customerEmail: string;

  @ApiProperty({ description: '토스페이먼츠 결제키', nullable: true })
  paymentKey: string | null;

  @ApiProperty({ description: '결제 상태' })
  status: string;
}

/**
 * 토스페이먼츠 웹훅 DTO
 */
export class PaymentWebhookDto {
  @ApiProperty({ description: '이벤트 타입' })
  eventType: string;

  @ApiProperty({ description: '이벤트 발생 시간' })
  createdAt: string;

  @ApiProperty({ description: '결제 데이터' })
  data: {
    paymentKey: string;
    orderId: string;
    status: string;
    transactionKey?: string;
    failure?: {
      code: string;
      message: string;
    };
  };
}