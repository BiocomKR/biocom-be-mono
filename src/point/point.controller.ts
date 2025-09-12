import { Controller, Get, Post, Body, Param, Query, UseGuards, Req, Logger, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery, ApiParam, ApiBody } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PointService } from './point.service';

/**
 * 포인트 관리 컨트롤러
 * 포인트 조회, 차감, 이관 등 포인트 관련 API 엔드포인트 제공
 */
@ApiTags('헬스케어-포인트')
@Controller('points')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class PointController {
  private readonly logger = new Logger(PointController.name);

  constructor(private readonly pointService: PointService) {}

  /**
   * 현재 포인트 잔액 조회
   * 
   * @param req 요청 객체 (사용자 정보 포함)
   * @returns 포인트 잔액
   */
  @Get('balance')
  @ApiOperation({ 
    summary: '포인트 잔액 조회',
    description: '현재 로그인한 사용자의 포인트 잔액을 조회합니다.'
  })
  @ApiResponse({ 
    status: 200, 
    description: '포인트 잔액',
    schema: {
      example: {
        userId: 1,
        balance: 5000,
        timestamp: '2024-01-15T09:00:00.000Z'
      }
    }
  })
  async getBalance(@Req() req: any) {
    const userId = req.user.id;
    this.logger.log(`포인트 잔액 조회 - 사용자: ${userId}`);
    
    const balance = await this.pointService.getBalance(userId);
    
    return {
      userId,
      balance,
      timestamp: new Date()
    };
  }

  /**
   * 포인트 내역 조회
   * 
   * @param req 요청 객체 (사용자 정보 포함)
   * @param limit 조회할 개수
   * @param offset 시작 위치
   * @returns 포인트 거래 내역
   */
  @Get('history')
  @ApiOperation({ 
    summary: '포인트 거래 내역 조회',
    description: '현재 로그인한 사용자의 포인트 거래 내역을 조회합니다.'
  })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '조회할 개수 (기본: 20)' })
  @ApiQuery({ name: 'offset', required: false, type: Number, description: '시작 위치 (기본: 0)' })
  @ApiResponse({ 
    status: 200, 
    description: '포인트 거래 내역 목록',
    schema: {
      example: {
        items: [
          {
            id: 1,
            type: 'EARN',
            amount: 100,
            balance: 5100,
            description: '1일차 미션 완료',
            relatedType: 'MISSION_COMPLETION',
            relatedId: 123,
            createdAt: '2024-01-15T09:00:00.000Z'
          }
        ],
        total: 50,
        limit: 20,
        offset: 0
      }
    }
  })
  async getHistory(
    @Req() req: any,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    const userId = req.user.id;
    this.logger.log(`포인트 내역 조회 - 사용자: ${userId}, limit: ${limit}, offset: ${offset}`);
    
    const items = await this.pointService.getHistory(userId, limit, offset);
    
    // 전체 개수 조회 (페이지네이션용)
    const total = await this.pointService.getHistoryCount(userId);
    
    return {
      items,
      total,
      limit,
      offset
    };
  }

  /**
   * 포인트 차감 (본인)
   * 
   * @param req 요청 객체 (사용자 정보 포함)
   * @param body 차감 정보
   * @returns 차감 결과
   */
  @Post('deduct')
  @ApiOperation({ 
    summary: '포인트 차감',
    description: '현재 로그인한 사용자의 포인트를 차감합니다.'
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['amount', 'description'],
      properties: {
        amount: { type: 'number', description: '차감할 포인트', example: 1000 },
        description: { type: 'string', description: '차감 사유', example: '상품 구매' },
        relatedType: { type: 'string', description: '관련 타입', example: 'ORDER' },
        relatedId: { type: 'number', description: '관련 ID', example: 456 }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: '포인트 차감 성공',
    schema: {
      example: {
        success: true,
        message: '포인트가 차감되었습니다.',
        deductedAmount: 1000,
        remainingBalance: 4000
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: '포인트 부족 또는 잘못된 요청'
  })
  async deductPoints(
    @Req() req: any,
    @Body() body: {
      amount: number;
      description: string;
      relatedType?: string;
      relatedId?: number;
    }
  ) {
    const userId = req.user.id;
    this.logger.log(`포인트 차감 요청 - 사용자: ${userId}, 금액: ${body.amount}`);
    
    await this.pointService.deductPoints(
      userId,
      body.amount,
      body.description,
      body.relatedType,
      body.relatedId
    );
    
    // 차감 후 잔액 조회
    const remainingBalance = await this.pointService.getBalance(userId);
    
    return {
      success: true,
      message: '포인트가 차감되었습니다.',
      deductedAmount: body.amount,
      remainingBalance
    };
  }

  /**
   * 아임웹으로 포인트 이관
   * 
   * @param req 요청 객체 (사용자 정보 포함)
   * @param body 이관 정보
   * @returns 이관 결과
   */
  @Post('transfer/to-imweb')
  @ApiOperation({ 
    summary: '아임웹으로 포인트 이관',
    description: '현재 로그인한 사용자의 포인트를 아임웹 쇼핑몰로 이관합니다.'
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['amount'],
      properties: {
        amount: { type: 'number', description: '이관할 포인트', example: 3000 }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: '포인트 이관 성공',
    schema: {
      example: {
        success: true,
        message: '아임웹으로 포인트가 이관되었습니다.',
        transferredAmount: 3000,
        remainingBalance: 2000
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: '포인트 부족 또는 잘못된 요청'
  })
  async transferToImweb(
    @Req() req: any,
    @Body() body: { amount: number }
  ) {
    const userId = req.user.id;
    this.logger.log(`아임웹 포인트 이관 요청 - 사용자: ${userId}, 금액: ${body.amount}`);
    
    await this.pointService.transferToImweb(userId, body.amount);
    
    // 이관 후 잔액 조회
    const remainingBalance = await this.pointService.getBalance(userId);
    
    return {
      success: true,
      message: '아임웹으로 포인트가 이관되었습니다.',
      transferredAmount: body.amount,
      remainingBalance
    };
  }

  /**
   * 아임웹에서 포인트 가져오기
   * 
   * @param req 요청 객체 (사용자 정보 포함)
   * @param body 가져올 포인트 정보
   * @returns 가져오기 결과
   */
  @Post('transfer/from-imweb')
  @ApiOperation({ 
    summary: '아임웹에서 포인트 가져오기',
    description: '아임웹 쇼핑몰에서 현재 로그인한 사용자의 계정으로 포인트를 가져옵니다.'
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['amount'],
      properties: {
        amount: { type: 'number', description: '가져올 포인트', example: 2000 }
      }
    }
  })
  @ApiResponse({ 
    status: 200, 
    description: '포인트 가져오기 성공',
    schema: {
      example: {
        success: true,
        message: '아임웹에서 포인트를 가져왔습니다.',
        receivedAmount: 2000,
        newBalance: 7000
      }
    }
  })
  @ApiResponse({ 
    status: 400, 
    description: '아임웹 포인트 부족 또는 잘못된 요청'
  })
  async transferFromImweb(
    @Req() req: any,
    @Body() body: { amount: number }
  ) {
    const userId = req.user.id;
    this.logger.log(`아임웹 포인트 가져오기 요청 - 사용자: ${userId}, 금액: ${body.amount}`);
    
    await this.pointService.transferFromImweb(userId, body.amount);
    
    // 가져온 후 잔액 조회
    const newBalance = await this.pointService.getBalance(userId);
    
    return {
      success: true,
      message: '아임웹에서 포인트를 가져왔습니다.',
      receivedAmount: body.amount,
      newBalance
    };
  }

}