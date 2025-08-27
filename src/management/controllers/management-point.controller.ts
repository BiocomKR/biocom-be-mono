import { Controller, Get, Post, Body, Param, Query, UseGuards, Logger, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { PointService } from '../../point/point.service';

/**
 * 백오피스 포인트 관리 컨트롤러
 * 관리자용 포인트 조회 및 관리 기능 제공
 */
@Controller('management/points')
@UseGuards(ApiKeyGuard)
export class ManagementPointController {
  private readonly logger = new Logger(ManagementPointController.name);

  constructor(private readonly pointService: PointService) {}

  /**
   * 특정 사용자 포인트 잔액 조회
   * 
   * @param userId 사용자 ID
   * @returns 포인트 잔액
   */
  @Get('balance/:userId')
        async getUserBalance(@Param('userId', ParseIntPipe) userId: number) {
    this.logger.log(`[백오피스] 특정 사용자 포인트 잔액 조회 - 사용자: ${userId}`);
    
    const balance = await this.pointService.getBalance(userId);
    
    return {
      userId,
      balance,
      timestamp: new Date()
    };
  }

  /**
   * 특정 사용자 포인트 내역 조회
   * 
   * @param userId 사용자 ID
   * @param limit 조회할 개수
   * @param offset 시작 위치
   * @returns 포인트 거래 내역
   */
  @Get('history/:userId')
            async getUserHistory(
    @Param('userId', ParseIntPipe) userId: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('offset', new DefaultValuePipe(0), ParseIntPipe) offset: number,
  ) {
    this.logger.log(`[백오피스] 특정 사용자 포인트 내역 조회 - 사용자: ${userId}, limit: ${limit}, offset: ${offset}`);
    
    const items = await this.pointService.getHistory(userId, limit, offset);
    const total = await this.pointService.getHistoryCount(userId);
    
    return {
      items,
      total,
      limit,
      offset
    };
  }

  /**
   * 특정 사용자 포인트 차감
   * 
   * @param userId 사용자 ID
   * @param body 차감 정보
   * @returns 차감 결과
   */
  @Post('deduct/:userId')
            async deductUserPoints(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: {
      amount: number;
      description: string;
      relatedType?: string;
      relatedId?: number;
    }
  ) {
    this.logger.log(`[백오피스] 포인트 차감 요청 - 사용자: ${userId}, 금액: ${body.amount}`);
    
    await this.pointService.deductPoints(
      userId,
      body.amount,
      body.description,
      body.relatedType || 'ADMIN_ADJUSTMENT',
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
   * 특정 사용자 포인트 적립
   * 
   * @param userId 사용자 ID
   * @param body 적립 정보
   * @returns 적립 결과
   */
  @Post('add/:userId')
          async addUserPoints(
    @Param('userId', ParseIntPipe) userId: number,
    @Body() body: {
      amount: number;
      description: string;
      relatedType?: string;
      relatedId?: number;
    }
  ) {
    this.logger.log(`[백오피스] 포인트 적립 요청 - 사용자: ${userId}, 금액: ${body.amount}`);
    
    // 포인트 적립 (PointService에 addPoints 메서드 추가 필요)
    await this.pointService.addPoints(
      userId,
      body.amount,
      body.description,
      body.relatedType || 'ADMIN_BONUS',
      body.relatedId
    );
    
    // 적립 후 잔액 조회
    const newBalance = await this.pointService.getBalance(userId);
    
    return {
      success: true,
      message: '포인트가 적립되었습니다.',
      addedAmount: body.amount,
      newBalance
    };
  }
}