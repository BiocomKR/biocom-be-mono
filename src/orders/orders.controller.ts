import {
  Controller,
  Get,
  Put,
  Patch,
  Param,
  Query,
  Body,
  ParseIntPipe,
  Logger,
  UseGuards,
  Request,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { OrdersService } from './orders.service';
import { OrderQueryDto, ClaimQueryDto } from './dto/order-query.dto';
import {
  UpdateOrderStatusDto,
  UpdateTrackingDto,
  ProcessRefundDto,
  ProcessExchangeReturnDto,
} from './dto/order-action.dto';
import { getNowKST } from '../common/utils/kst-date.util';

/**
 * 주문 관리 컨트롤러
 * 백오피스에서 주문/배송/취소/교환/환불을 관리하는 API
 */
@ApiTags('주문 관리')
@ApiBearerAuth()
@Controller('orders')
@UseGuards(JwtAuthGuard)
@SkipThrottle()
export class OrdersController {
  private readonly logger = new Logger(OrdersController.name);

  constructor(private readonly ordersService: OrdersService) {}

  /**
   * 주문 통계 조회
   */
  @Get('stats')
  @ApiOperation({ summary: '주문 통계 조회' })
  async getStats() {
    this.logger.log('주문 통계 조회');

    const stats = await this.ordersService.getStats();

    return {
      success: true,
      message: '주문 통계가 조회되었습니다.',
      data: stats,
      timestamp: getNowKST(),
    };
  }

  /**
   * 취소/교환/환불 목록 조회
   */
  @Get('claims')
  @ApiOperation({ summary: '취소/교환/환불 목록 조회' })
  @ApiQuery({ name: 'type', required: false, description: 'CANCEL, EXCHANGE, RETURN, RETURN_REFUND' })
  async findClaims(@Query() query: ClaimQueryDto) {
    this.logger.log(`클레임 목록 조회 - 타입: ${query.type}, 상태: ${query.status}`);

    const result = await this.ordersService.findClaims(query);

    return {
      success: true,
      message: '클레임 목록이 조회되었습니다.',
      data: result,
      timestamp: getNowKST(),
    };
  }

  /**
   * 주문 목록 조회
   */
  @Get()
  @ApiOperation({ summary: '주문 목록 조회' })
  async findAll(@Query() query: OrderQueryDto) {
    this.logger.log(`주문 목록 조회 - 페이지: ${query.page}, 검색어: ${query.search}`);

    const result = await this.ordersService.findAll(query);

    return {
      success: true,
      message: '주문 목록이 조회되었습니다.',
      data: result,
      timestamp: getNowKST(),
    };
  }

  /**
   * 주문 상세 조회
   */
  @Get(':id')
  @ApiOperation({ summary: '주문 상세 조회' })
  async findOne(@Param('id', ParseIntPipe) id: number) {
    this.logger.log(`주문 상세 조회 - ID: ${id}`);

    const order = await this.ordersService.findOne(id);

    return {
      success: true,
      message: '주문 정보가 조회되었습니다.',
      data: order,
      timestamp: getNowKST(),
    };
  }

  /**
   * 주문 상태 변경
   */
  @Patch(':id/status')
  @ApiOperation({ summary: '주문 상태 변경' })
  async updateStatus(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateOrderStatusDto,
    @Request() req: any,
  ) {
    this.logger.log(`주문 상태 변경 - ID: ${id}, 상태: ${dto.status}`);

    await this.ordersService.updateStatus(id, dto, req.user?.id);

    return {
      success: true,
      message: '주문 상태가 변경되었습니다.',
      timestamp: getNowKST(),
    };
  }

  /**
   * 송장 정보 입력/수정
   */
  @Put(':id/tracking')
  @ApiOperation({ summary: '송장 정보 입력/수정' })
  async updateTracking(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateTrackingDto,
  ) {
    this.logger.log(`송장 입력 - orderId: ${id}, tracking: ${dto.trackingNumber}`);

    await this.ordersService.updateTracking(id, dto);

    return {
      success: true,
      message: '송장 정보가 저장되었습니다.',
      timestamp: getNowKST(),
    };
  }

  /**
   * 환불 처리 (승인/거절)
   */
  @Patch('refunds/:id')
  @ApiOperation({ summary: '환불 처리 (승인/거절)' })
  async processRefund(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ProcessRefundDto,
  ) {
    this.logger.log(`환불 처리 - refundId: ${id}, status: ${dto.status}`);

    await this.ordersService.processRefund(id, dto);

    return {
      success: true,
      message: '환불이 처리되었습니다.',
      timestamp: getNowKST(),
    };
  }

  /**
   * 교환/반품 처리 (승인/거절/완료)
   */
  @Patch('exchange-returns/:id')
  @ApiOperation({ summary: '교환/반품 처리 (승인/거절/완료)' })
  async processExchangeReturn(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: ProcessExchangeReturnDto,
  ) {
    this.logger.log(`교환/반품 처리 - id: ${id}, status: ${dto.status}`);

    await this.ordersService.processExchangeReturn(id, dto);

    return {
      success: true,
      message: '교환/반품이 처리되었습니다.',
      timestamp: getNowKST(),
    };
  }
}
