import {
  Controller,
  Post,
  Param,
  Body,
  UseGuards,
  ParseIntPipe
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RefundService } from './refund.service';

@ApiTags('환불 관리')
@ApiBearerAuth()
@Controller('refund')
@UseGuards(JwtAuthGuard)
export class RefundController {
  constructor(private readonly refundService: RefundService) {}

  /**
   * 환불 승인
   * 환불 요청을 검토하고 승인 처리
   */
  @Post(':id/approve')
  async approveRefund(
    @Param('id', ParseIntPipe) id: number,
    @Body('adminMemo') adminMemo?: string
  ) {
    return this.refundService.approveRefund(id, adminMemo);
  }

  /**
   * 환불 거절
   * 환불 요청을 검토하고 거절 처리
   */
  @Post(':id/reject')
  async rejectRefund(
    @Param('id', ParseIntPipe) id: number,
    @Body('reason') reason: string,
    @Body('adminMemo') adminMemo?: string
  ) {
    return this.refundService.rejectRefund(id, reason, adminMemo);
  }

  /**
   * 관리자 주문 취소 (고객 대신 취소)
   * Refund 레코드 생성 및 즉시 취소 처리
   */
  @Post('admin-cancel/:orderId')
  async adminCancelOrder(
    @Param('orderId', ParseIntPipe) orderId: number,
    @Body('reason') reason: string,
    @Body('adminMemo') adminMemo?: string
  ) {
    return this.refundService.adminCancelOrder(orderId, reason, adminMemo);
  }
}
