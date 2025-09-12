import { 
  Controller, 
  Get, 
  Post,
  Put,
  Param,
  Body,
  UseGuards
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiBody
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { ShippingService } from './shipping.service';
import { 
  UpdateShippingDto,
  ShippingResponseDto,
  TrackingResponseDto
} from './dto/shipping.dto';

// 쇼핑몰 관련 API 임시 비활성화
@Controller('api/shipping')
export class ShippingController {
  constructor(private readonly shippingService: ShippingService) {}

  /**
   * 배송 정보 조회
   */
  @Get('order/:orderNumber')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ summary: '배송 정보 조회', description: '주문의 배송 정보를 조회합니다' })
  @ApiParam({ name: 'orderNumber', description: '주문번호' })
  @ApiResponse({ status: 200, description: '성공', type: ShippingResponseDto })
  @ApiResponse({ status: 404, description: '배송 정보를 찾을 수 없음' })
  async getShipping(
    @Param('orderNumber') orderNumber: string
  ): Promise<ShippingResponseDto> {
    return this.shippingService.findShippingByOrder(orderNumber);
  }

  // 운송장 등록은 관리자 기능 - /api/management/shipping으로 이동

  // 배송 시작은 관리자 기능 - /api/management/shipping으로 이동

  // 배송 완료는 관리자 기능 - /api/management/shipping으로 이동

  /**
   * 배송 추적
   */
  @Get('track/:trackingNumber')
  @ApiOperation({ 
    summary: '배송 추적', 
    description: '운송장 번호로 배송을 추적합니다' 
  })
  @ApiParam({ name: 'trackingNumber', description: '운송장 번호' })
  @ApiResponse({ status: 200, description: '성공', type: TrackingResponseDto })
  @ApiResponse({ status: 404, description: '배송 정보를 찾을 수 없음' })
  async trackShipping(
    @Param('trackingNumber') trackingNumber: string
  ): Promise<TrackingResponseDto> {
    return this.shippingService.trackShipping(trackingNumber);
  }

  /**
   * 배송비 정책 조회
   */
  @Get('policies')
  @ApiOperation({ 
    summary: '배송비 정책 조회', 
    description: '활성화된 배송비 정책을 조회합니다' 
  })
  @ApiResponse({ status: 200, description: '성공' })
  async getShippingPolicies(): Promise<any[]> {
    return this.shippingService.getShippingPolicies();
  }
}