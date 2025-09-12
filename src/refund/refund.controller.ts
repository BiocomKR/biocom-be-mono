import { 
  Controller, 
  Get, 
  Post,
  Put,
  Param,
  Query,
  Body,
  UseGuards,
  Request,
  ParseIntPipe
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
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { RefundService } from './refund.service';
import { 
  CreateRefundDto,
  UpdateRefundDto,
  RefundResponseDto,
  RefundListResponseDto
} from './dto/refund.dto';

// 쇼핑몰 관련 API 임시 비활성화
@Controller('api/refund')
export class RefundController {
  constructor(private readonly refundService: RefundService) {}

  /**
   * 환불 요청 생성
   */
  @Post()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: '환불 요청 생성', 
    description: '주문에 대한 환불을 요청합니다' 
  })
  @ApiBody({ type: CreateRefundDto })
  @ApiResponse({ status: 201, description: '성공', type: RefundResponseDto })
  @ApiResponse({ status: 400, description: '잘못된 요청' })
  @ApiResponse({ status: 404, description: '주문을 찾을 수 없음' })
  @ApiResponse({ status: 409, description: '이미 환불 요청이 존재함' })
  async createRefund(
    @Request() req,
    @Body() dto: CreateRefundDto
  ): Promise<RefundResponseDto> {
    return this.refundService.createRefund(req.user.id, dto);
  }

  /**
   * 환불 목록 조회
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: '환불 목록 조회', 
    description: '환불 요청 목록을 조회합니다' 
  })
  @ApiQuery({ name: 'status', required: false, description: '환불 상태' })
  @ApiQuery({ name: 'page', required: false, description: '페이지 번호', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: '페이지당 항목 수', example: 10 })
  @ApiResponse({ status: 200, description: '성공', type: RefundListResponseDto })
  async findAll(
    @Request() req,
    @Query('status') status?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string
  ): Promise<RefundListResponseDto> {
    return this.refundService.findAll(
      req.user.id,
      status,
      page ? parseInt(page) : 1,
      limit ? parseInt(limit) : 10
    );
  }

  /**
   * 환불 상세 조회
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: '환불 상세 조회', 
    description: '특정 환불 요청의 상세 정보를 조회합니다' 
  })
  @ApiParam({ name: 'id', description: '환불 ID' })
  @ApiResponse({ status: 200, description: '성공', type: RefundResponseDto })
  @ApiResponse({ status: 404, description: '환불 요청을 찾을 수 없음' })
  async findOne(
    @Param('id', ParseIntPipe) id: number
  ): Promise<RefundResponseDto> {
    return this.refundService.findOne(id);
  }

  // 환불 승인은 관리자 기능 - /api/management/refund로 이동

  // 환불 거절은 관리자 기능 - /api/management/refund로 이동

  // 환불 완료 처리는 관리자 기능 - /api/management/refund로 이동

  // 전체 환불 목록은 관리자 기능 - /api/management/refund로 이동
}