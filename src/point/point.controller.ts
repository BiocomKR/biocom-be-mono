import { Controller, Get, Post, Body, Param, Query, UseGuards, Logger, ParseIntPipe, DefaultValuePipe } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PointService } from './point.service';
import { getNowKST } from '../common/utils/kst-date.util';

/**
 * 백오피스 포인트 관리 컨트롤러
 * 관리자용 포인트 조회 및 관리 기능 제공
 */
@ApiTags('포인트 관리')
@ApiBearerAuth()
@Controller('points')
@UseGuards(JwtAuthGuard)
export class PointController {
  private readonly logger = new Logger(PointController.name);

  constructor(private readonly pointService: PointService) {}

  /**
   * 특정 사용자 포인트 잔액 조회
   */
  @Get('balance/:userId')
  async getUserBalance(@Param('userId', ParseIntPipe) userId: number) {
    this.logger.log(`[백오피스] 특정 사용자 포인트 잔액 조회 - 사용자: ${userId}`);

    const balance = await this.pointService.getBalance(userId);

    return {
      userId,
      balance,
      timestamp: getNowKST()
    };
  }

  /**
   * 특정 사용자 포인트 내역 조회
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

    await this.pointService.addPoints(
      userId,
      body.amount,
      body.description,
      body.relatedType || 'ADMIN_BONUS',
      body.relatedId
    );

    const newBalance = await this.pointService.getBalance(userId);

    return {
      success: true,
      message: '포인트가 적립되었습니다.',
      addedAmount: body.amount,
      newBalance
    };
  }
}
