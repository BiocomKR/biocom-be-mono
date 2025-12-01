import {
  Controller,
  Post,
  Get,
  Body,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { IapService } from './services/iap.service';
import { VerifyReceiptDto, VerifyReceiptResponseDto } from './dto/verify-receipt.dto';

@ApiTags('IAP - 인앱결제')
@Controller('iap')
export class IapController {
  constructor(private readonly iapService: IapService) {}

  @Post('verify')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '영수증 검증 및 구매 처리',
    description: 'Apple/Google 영수증을 검증하고 구매를 처리합니다. 검증 성공 시 챌린지 티켓이 발급됩니다.',
  })
  @ApiResponse({
    status: 200,
    description: '영수증 검증 결과',
    type: VerifyReceiptResponseDto,
  })
  @ApiResponse({ status: 400, description: '잘못된 요청 (등록되지 않은 상품 등)' })
  @ApiResponse({ status: 401, description: '인증 실패' })
  @ApiResponse({ status: 409, description: '이미 처리된 구매' })
  async verifyReceipt(
    @Request() req,
    @Body() dto: VerifyReceiptDto,
  ): Promise<VerifyReceiptResponseDto> {
    const result = await this.iapService.verifyAndProcessPurchase(req.user.id, dto);
    return {
      success: result.success,
      ticketId: result.ticketId,
      message: result.message,
    };
  }

  @Get('products')
  @ApiOperation({
    summary: 'IAP 상품 목록 조회',
    description: '앱에서 구매 가능한 IAP 상품 목록을 조회합니다.',
  })
  @ApiResponse({ status: 200, description: 'IAP 상품 목록' })
  async getProducts() {
    return this.iapService.getIapProducts();
  }

  @Get('purchases')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({
    summary: '내 구매 내역 조회',
    description: '로그인한 사용자의 IAP 구매 내역을 조회합니다.',
  })
  @ApiResponse({ status: 200, description: '구매 내역 목록' })
  @ApiResponse({ status: 401, description: '인증 실패' })
  async getMyPurchases(@Request() req) {
    return this.iapService.getUserPurchases(req.user.id);
  }
}
