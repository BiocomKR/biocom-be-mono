import { 
  Controller, 
  Get, 
  Post,
  Patch, 
  Param, 
  Query,
  Body,
  UseGuards,
  Request
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiBody 
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { OrdersService } from '../services/orders.service';
import { CreateOrderDto, OrderResponseDto } from '../dto/orders/create-order.dto';

// 쇼핑몰 관련 API 임시 비활성화
@Controller('api/shop/orders')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class OrdersController {
  constructor(private readonly ordersService: OrdersService) {}

  /**
   * 주문 생성
   */
  @Post()
  @ApiOperation({ summary: '주문 생성', description: '장바구니 아이템으로 주문을 생성합니다' })
  @ApiBody({ type: CreateOrderDto })
  @ApiResponse({ status: 201, description: '성공', type: OrderResponseDto })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  async createOrder(
    @Request() req,
    @Body() dto: CreateOrderDto
  ): Promise<OrderResponseDto> {
    return this.ordersService.createOrder(req.user.id, dto);
  }

  /**
   * 주문 목록 조회
   */
  @Get()
  @ApiOperation({ summary: '주문 목록 조회', description: '사용자의 주문 목록을 조회합니다' })
  @ApiQuery({ name: 'status', required: false, description: '주문 상태' })
  @ApiQuery({ name: 'page', required: false, description: '페이지 번호', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: '페이지당 항목 수', example: 10 })
  @ApiResponse({ status: 200, description: '성공' })
  async findAll(
    @Request() req,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ): Promise<{ items: OrderResponseDto[]; total: number }> {
    return this.ordersService.findAll(
      req.user.id,
      status,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10
    );
  }

  /**
   * 주문 상세 조회
   */
  @Get(':orderNumber')
  @ApiOperation({ summary: '주문 상세 조회', description: '특정 주문의 상세 정보를 조회합니다' })
  @ApiParam({ name: 'orderNumber', description: '주문번호' })
  @ApiResponse({ status: 200, description: '성공', type: OrderResponseDto })
  @ApiResponse({ status: 404, description: '주문을 찾을 수 없음' })
  async findOne(
    @Request() req,
    @Param('orderNumber') orderNumber: string
  ): Promise<OrderResponseDto> {
    return this.ordersService.findOne(req.user.id, orderNumber);
  }

  /**
   * 주문 취소
   */
  @Post(':orderNumber/cancel')
  @ApiOperation({ summary: '주문 취소', description: '주문을 취소합니다' })
  @ApiParam({ name: 'orderNumber', description: '주문번호' })
  @ApiBody({ 
    schema: {
      type: 'object',
      properties: {
        reason: { type: 'string', description: '취소 사유' }
      },
      required: ['reason']
    }
  })
  @ApiResponse({ status: 200, description: '성공', type: OrderResponseDto })
  @ApiResponse({ status: 400, description: '취소 불가능한 상태' })
  @ApiResponse({ status: 404, description: '주문을 찾을 수 없음' })
  async cancelOrder(
    @Request() req,
    @Param('orderNumber') orderNumber: string,
    @Body('reason') reason: string
  ): Promise<OrderResponseDto> {
    return this.ordersService.cancelOrder(req.user.id, orderNumber, reason);
  }

  /**
   * 구매 확정
   */
  @Post(':orderNumber/confirm')
  @ApiOperation({ summary: '구매 확정', description: '배송 완료된 주문을 구매 확정합니다' })
  @ApiParam({ name: 'orderNumber', description: '주문번호' })
  @ApiResponse({ status: 200, description: '성공', type: OrderResponseDto })
  @ApiResponse({ status: 400, description: '구매확정 불가능한 상태' })
  @ApiResponse({ status: 404, description: '주문을 찾을 수 없음' })
  async confirmOrder(
    @Request() req,
    @Param('orderNumber') orderNumber: string
  ): Promise<OrderResponseDto> {
    return this.ordersService.confirmOrder(req.user.id, orderNumber);
  }

  // 관리자 기능은 /api/management/orders로 이동됨
  // updateOrderStatus 메서드는 ManagementShopController에서 처리
}