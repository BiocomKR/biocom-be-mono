import { Controller, Get, Post, Body, Param, Query, UseGuards, Logger, ParseIntPipe, DefaultValuePipe, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PointService } from './point.service';
import { ExcelService } from '../common/services/excel.service';
import { getNowKST } from '../common/utils/kst-date.util';
import * as dayjs from 'dayjs';

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

  constructor(
    private readonly pointService: PointService,
    private readonly excelService: ExcelService,
  ) {}

  /**
   * 전체 포인트 내역 조회 (페이지네이션, 필터 지원)
   */
  @Get('history')
  async getAllHistory(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('type') type?: string,
    @Query('relatedType') relatedType?: string,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    this.logger.log(`[백오피스] 전체 포인트 내역 조회 - page: ${page}, limit: ${limit}, type: ${type}, relatedType: ${relatedType}, search: ${search}`);

    const result = await this.pointService.getAllHistory({
      page,
      limit,
      type,
      relatedType,
      search,
      startDate,
      endDate,
    });

    return result;
  }

  /**
   * 포인트 통계 조회
   */
  @Get('stats')
  async getStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    this.logger.log(`[백오피스] 포인트 통계 조회`);

    return await this.pointService.getStats(startDate, endDate);
  }

  /**
   * 포인트 내역 엑셀 다운로드
   * 주의: history/:userId 보다 먼저 정의되어야 함
   */
  @Get('history/excel')
  async downloadHistoryExcel(
    @Res() res: Response,
    @Query('type') type?: string,
    @Query('relatedType') relatedType?: string,
    @Query('search') search?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
  ) {
    this.logger.log(`[백오피스] 포인트 내역 엑셀 다운로드 - type: ${type}, relatedType: ${relatedType}, search: ${search}`);

    // 전체 데이터 조회 (페이지네이션 없이)
    const result = await this.pointService.getAllHistory({
      page: 1,
      limit: 100000,
      type,
      relatedType,
      search,
      startDate,
      endDate,
    });

    const typeLabels: Record<string, string> = {
      EARN: '적립',
      EARNED: '적립',
      SPEND: '사용',
      SPENT: '사용',
      USE: '사용',
    };

    const relatedTypeLabels: Record<string, string> = {
      RECORD_COMPLETION: '기록 완료',
      MISSION_COMPLETION: '미션 완료',
      CHALLENGE_MISSION: '챌린지 미션',
      QUIZ: '퀴즈',
      ORDER: '주문',
      REVIEW: '리뷰 작성',
      ADMIN_BONUS: '관리자 지급',
      ADMIN_ADJUSTMENT: '관리자 차감',
      IMWEB_TRANSFER: '아임웹 이전',
    };

    await this.excelService.downloadExcel(res, result.items, {
      fileName: `포인트내역_${dayjs().format('YYYYMMDD_HHmmss')}`,
      sheetName: '포인트 내역',
      columns: [
        {
          header: '일시',
          key: 'createdAt',
          width: 20,
          formatter: (value) => dayjs(value).format('YYYY-MM-DD HH:mm:ss'),
        },
        { header: '회원명', key: 'userName', width: 15 },
        { header: '이메일', key: 'userEmail', width: 25 },
        {
          header: '구분',
          key: 'type',
          width: 10,
          formatter: (value) => typeLabels[value] || value,
        },
        {
          header: '카테고리',
          key: 'relatedType',
          width: 15,
          formatter: (value) => relatedTypeLabels[value] || value || '-',
        },
        {
          header: '금액',
          key: 'amount',
          width: 12,
          formatter: (value) => value.toLocaleString(),
        },
        {
          header: '잔액',
          key: 'balance',
          width: 12,
          formatter: (value) => value.toLocaleString(),
        },
        { header: '사유', key: 'description', width: 40 },
      ],
    });
  }

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
