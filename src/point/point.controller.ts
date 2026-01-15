import { Controller, Get, Post, Body, Param, Query, UseGuards, Logger, ParseIntPipe, DefaultValuePipe, Res } from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { Response } from 'express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PointService } from './point.service';
import { ExcelService } from '../common/services/excel.service';
import { getNowKST } from '../common/utils/kst-date.util';
import * as dayjs from 'dayjs';
import * as ExcelJS from 'exceljs';

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
    @Query('excludeTesters') excludeTesters?: string,
  ) {
    const exclude = excludeTesters !== 'false'; // 기본값 true
    this.logger.log(`[백오피스] 전체 포인트 내역 조회 - page: ${page}, limit: ${limit}, type: ${type}, relatedType: ${relatedType}, search: ${search}, excludeTesters: ${exclude}`);

    const result = await this.pointService.getAllHistory({
      page,
      limit,
      type,
      relatedType,
      search,
      startDate,
      endDate,
      excludeTesters: exclude,
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
    @Query('excludeTesters') excludeTesters?: string,
  ) {
    const exclude = excludeTesters !== 'false'; // 기본값 true
    this.logger.log(`[백오피스] 포인트 통계 조회 - excludeTesters: ${exclude}`);

    return await this.pointService.getStats(startDate, endDate, exclude);
  }

  /**
   * 유저별 포인트 통계 엑셀 다운로드 (개요 + 일별포인트 + 유저별합계 + Raw 데이터)
   * 개요 시트에 엑셀 수식 포함
   */
  @Get('stats/excel')
  async downloadStatsExcel(
    @Res() res: Response,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('startUserId') startUserId?: string,
    @Query('endUserId') endUserId?: string,
    @Query('excludeTesters') excludeTesters?: string,
  ) {
    const exclude = excludeTesters !== 'false'; // 기본값 true
    this.logger.log(`[백오피스] 포인트 통계 엑셀 다운로드 - startDate: ${startDate}, endDate: ${endDate}, excludeTesters: ${exclude}`);

    const stats = await this.pointService.getUserPointStats({
      startDate,
      endDate,
      startUserId: startUserId ? parseInt(startUserId) : undefined,
      endUserId: endUserId ? parseInt(endUserId) : undefined,
      excludeTesters: exclude,
    });

    const userIds = Object.keys(stats.userStats)
      .map((id) => parseInt(id))
      .sort((a, b) => a - b);

    const totalDays = stats.dates.length;
    const totalUsers = userIds.length;
    const { totalDietExcess, totalEarned } = stats.summary;

    // 워크북 생성
    const workbook = new ExcelJS.Workbook();

    // 테스터 제외 여부 라벨
    const testerLabel = exclude ? '테스터 제외' : '테스터 포함';

    // ========== 1. 개요 시트 (수식 포함) ==========
    const overviewSheet = workbook.addWorksheet(`개요 (${testerLabel})`);
    overviewSheet.columns = [
      { header: '항목', key: 'item', width: 25 },
      { header: '값', key: 'value', width: 20 },
    ];

    // 일별 총액 시작 행 (9행부터 - 테스터 제외 여부 행 추가)
    const dailyStartRow = 9;
    const dailyEndRow = dailyStartRow + totalDays - 1;

    // 데이터 행 추가
    overviewSheet.addRow({ item: '테스터 제외 여부', value: testerLabel }); // 행2
    overviewSheet.addRow({ item: '1인당 최대 획득 포인트', value: null }); // 행3
    overviewSheet.addRow({ item: `${totalUsers}인 최대 획득 포인트`, value: null }); // 행3
    overviewSheet.addRow({ item: '실 지급 포인트', value: null }); // 행4
    overviewSheet.addRow({ item: '초과 지급 포인트', value: totalDietExcess }); // 행5 (하드코딩)
    overviewSheet.addRow({ item: '포인트 지급률 (%)', value: null }); // 행6
    overviewSheet.addRow({ item: '', value: '' }); // 빈 행7
    overviewSheet.addRow({ item: '일자', value: '총 지급 포인트' }); // 헤더 행8

    // 일별 총액 추가
    for (const date of stats.dates) {
      let dayTotal = 0;
      for (const userId of userIds) {
        dayTotal += stats.dailyStats[date]?.[userId] || 0;
      }
      overviewSheet.addRow({ item: date.substring(5), value: dayTotal });
    }

    // 수식 적용 (테스터 제외 여부 행 추가로 1행씩 아래로 이동)
    // B3: 1인당 최대 획득 포인트 = 1300 + 1300 * 날짜수
    overviewSheet.getCell('B3').value = { formula: `1300+1300*${totalDays}` };
    // B4: N인 최대 획득 포인트 = B3 * 인원수
    overviewSheet.getCell('B4').value = { formula: `B3*${totalUsers}` };
    // B5: 실 지급 포인트 = 일별 총액 합계 (B10:B끝)
    overviewSheet.getCell('B5').value = { formula: `SUM(B${dailyStartRow + 1}:B${dailyEndRow + 1})` };
    // B6: 초과 지급 포인트 (하드코딩)
    // B7: 포인트 지급률 = (실 지급 - 초과 지급) / 최대 획득 * 100
    overviewSheet.getCell('B7').value = { formula: `(B5-B6)/B4*100` };

    // 숫자 서식 적용
    overviewSheet.getCell('B3').numFmt = '₩#,##0';
    overviewSheet.getCell('B4').numFmt = '₩#,##0';
    overviewSheet.getCell('B5').numFmt = '₩#,##0';
    overviewSheet.getCell('B6').numFmt = '₩#,##0';
    overviewSheet.getCell('B7').numFmt = '0.00"%"';
    for (let i = dailyStartRow + 1; i <= dailyEndRow + 1; i++) {
      overviewSheet.getCell(`B${i}`).numFmt = '₩#,##0';
    }

    // 헤더 스타일
    const headerRow = overviewSheet.getRow(1);
    headerRow.font = { bold: true };
    headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };

    // ========== 2. 일별포인트 시트 ==========
    const dailySheet = workbook.addWorksheet(`일별포인트 (${testerLabel})`);
    const dailyColumns = [
      { header: 'user_id', key: 'odUserId', width: 10 },
      { header: '이름', key: 'odName', width: 12 },
      ...stats.dates.map((date) => ({ header: date.substring(5), key: date, width: 10 })),
      { header: '합계', key: 'odTotal', width: 12 },
    ];
    dailySheet.columns = dailyColumns;

    // 데이터 추가
    for (const userId of userIds) {
      const userData = stats.userStats[userId];
      const row: Record<string, any> = { odUserId: userId, odName: userData.name };
      let total = 0;
      for (const date of stats.dates) {
        const points = stats.dailyStats[date]?.[userId] || 0;
        row[date] = points || '-';
        total += points;
      }
      row.odTotal = total;
      dailySheet.addRow(row);
    }

    // 합계 행
    const totalRowData: Record<string, any> = { odUserId: '', odName: '합계' };
    let grandTotal = 0;
    for (const date of stats.dates) {
      let dayTotal = 0;
      for (const userId of userIds) {
        dayTotal += stats.dailyStats[date]?.[userId] || 0;
      }
      totalRowData[date] = dayTotal;
      grandTotal += dayTotal;
    }
    totalRowData.odTotal = grandTotal;
    dailySheet.addRow(totalRowData);

    // 숫자 서식 (0은 '-')
    dailySheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        row.eachCell((cell, colNumber) => {
          if (colNumber > 2 && typeof cell.value === 'number') {
            cell.numFmt = '#,##0';
          }
        });
      }
    });

    // 헤더 스타일
    const dailyHeaderRow = dailySheet.getRow(1);
    dailyHeaderRow.font = { bold: true };
    dailyHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    dailySheet.views = [{ state: 'frozen', ySplit: 1 }];

    // ========== 3. 유저별합계 시트 ==========
    const userSheet = workbook.addWorksheet(`유저별합계 (${testerLabel})`);
    userSheet.columns = [
      { header: 'user_id', key: 'userId', width: 10 },
      { header: '이름', key: 'name', width: 12 },
      { header: '획득 포인트', key: 'earnedPoints', width: 15 },
      { header: '비고', key: 'note', width: 20 },
    ];

    for (const userId of userIds) {
      const data = stats.userStats[userId];
      userSheet.addRow({
        userId,
        name: data.name,
        earnedPoints: data.total,
        note: data.excess > 0 ? `초과지급 -${data.excess.toLocaleString()}` : '',
      });
    }
    // 합계 행
    userSheet.addRow({ userId: '', name: '합계', earnedPoints: totalEarned, note: '' });

    // 숫자 서식
    userSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        const cell = row.getCell(3);
        if (typeof cell.value === 'number') {
          cell.numFmt = '#,##0';
        }
      }
    });

    // 헤더 스타일
    const userHeaderRow = userSheet.getRow(1);
    userHeaderRow.font = { bold: true };
    userHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    userSheet.views = [{ state: 'frozen', ySplit: 1 }];

    // ========== 4. Raw 데이터 시트 ==========
    const rawSheet = workbook.addWorksheet(`Raw 데이터 (${testerLabel})`);
    rawSheet.columns = [
      { header: 'ID', key: 'id', width: 10 },
      { header: '년월일시', key: 'datetime', width: 20 },
      { header: '년월일', key: 'date', width: 12 },
      { header: '시', key: 'hour', width: 6 },
      { header: 'user_id', key: 'userId', width: 10 },
      { header: '회원명', key: 'userName', width: 15 },
      { header: '휴대폰 번호', key: 'userMobile', width: 15 },
      { header: '구분', key: 'type', width: 10 },
      { header: '금액', key: 'amount', width: 12 },
      { header: '잔액', key: 'balance', width: 12 },
      { header: '사유', key: 'description', width: 40 },
      { header: '관련 타입', key: 'relatedType', width: 20 },
      { header: '관련 ID', key: 'relatedId', width: 10 },
    ];

    // Raw 데이터 추가
    for (const item of stats.allHistory) {
      const createdAtDayjs = dayjs(item.createdAt);
      rawSheet.addRow({
        id: item.id,
        datetime: createdAtDayjs.format('YYYY-MM-DD HH:mm:ss'),
        date: createdAtDayjs.format('YYYY-MM-DD'),
        hour: createdAtDayjs.format('HH'),
        userId: item.userId,
        userName: item.user?.name || '-',
        userMobile: item.user?.mobile ? this.formatPhoneNumber(item.user.mobile) : '-',
        type: item.type,
        amount: item.amount,
        balance: item.balance,
        description: item.description,
        relatedType: item.relatedType || '-',
        relatedId: item.relatedId || '-',
      });
    }

    // 숫자 서식
    rawSheet.eachRow((row, rowNumber) => {
      if (rowNumber > 1) {
        const amountCell = row.getCell(9);
        const balanceCell = row.getCell(10);
        if (typeof amountCell.value === 'number') amountCell.numFmt = '#,##0';
        if (typeof balanceCell.value === 'number') balanceCell.numFmt = '#,##0';
      }
    });

    // 헤더 스타일
    const rawHeaderRow = rawSheet.getRow(1);
    rawHeaderRow.font = { bold: true };
    rawHeaderRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFE0E0E0' } };
    rawSheet.views = [{ state: 'frozen', ySplit: 1 }];

    // 응답 전송
    const fileName = `포인트통계_${dayjs().format('YYYYMMDD_HHmmss')}`;
    const encodedFileName = encodeURIComponent(fileName);
    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename*=UTF-8''${encodedFileName}.xlsx`);
    await workbook.xlsx.write(res);
  }

  /**
   * 전화번호 포맷팅 (컨트롤러용)
   */
  private formatPhoneNumber(phone: string): string {
    if (!phone) return phone;
    const cleaned = phone.replace(/\D/g, '');
    if (cleaned.length === 11) {
      return `${cleaned.slice(0, 3)}-${cleaned.slice(3, 7)}-${cleaned.slice(7)}`;
    }
    return phone;
  }

  /**
   * 포인트 내역 엑셀 다운로드 (포인트 내역 + 유저별 통계 + 일별 통계)
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
    @Query('excludeTesters') excludeTesters?: string,
  ) {
    const exclude = excludeTesters !== 'false'; // 기본값 true
    this.logger.log(`[백오피스] 포인트 내역 엑셀 다운로드 - type: ${type}, relatedType: ${relatedType}, search: ${search}, excludeTesters: ${exclude}`);

    // 전체 데이터 조회 (페이지네이션 없이)
    const result = await this.pointService.getAllHistory({
      page: 1,
      limit: 100000,
      type,
      relatedType,
      search,
      startDate,
      endDate,
      excludeTesters: exclude,
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

    // 유저별/일별 통계 조회
    const stats = await this.pointService.getUserPointStats({
      startDate,
      endDate,
    });

    // 유저별 통계 시트 데이터
    const userStatsData = Object.entries(stats.userStats)
      .sort(([a], [b]) => parseInt(a) - parseInt(b))
      .map(([userId, data]) => ({
        userId: parseInt(userId),
        name: data.name,
        mobile: data.mobile,
        earnedPoints: data.total,
        excessPoints: data.excess,
        adjustedPoints: data.total - data.excess,
        note: data.excess > 0 ? `초과지급 -${data.excess}` : '',
      }));

    // 일별 통계 시트 데이터
    const dailyStatsData: Record<string, any>[] = [];
    const userIds = Object.keys(stats.userStats)
      .map((id) => parseInt(id))
      .sort((a, b) => a - b);

    for (const uId of userIds) {
      const userData = stats.userStats[uId];
      const row: Record<string, any> = {
        odUserId: uId,
        odName: userData.name,
      };

      let total = 0;
      for (const date of stats.dates) {
        const points = stats.dailyStats[date]?.[uId] || 0;
        row[date] = points;
        total += points;
      }
      row.odTotal = total;
      dailyStatsData.push(row);
    }

    // 일별 합계 행
    const totalRow: Record<string, any> = { odUserId: '', odName: '합계' };
    let grandTotal = 0;
    for (const date of stats.dates) {
      let dayTotal = 0;
      for (const uId of userIds) {
        dayTotal += stats.dailyStats[date]?.[uId] || 0;
      }
      totalRow[date] = dayTotal;
      grandTotal += dayTotal;
    }
    totalRow.odTotal = grandTotal;
    dailyStatsData.push(totalRow);

    // 일별 시트 컬럼 동적 생성
    const dailyColumns = [
      { header: 'user_id', key: 'odUserId', width: 10 },
      { header: '이름', key: 'odName', width: 12 },
      ...stats.dates.map((date) => ({
        header: date.substring(5), // MM-DD
        key: date,
        width: 10,
        formatter: (value: number) => (value > 0 ? value.toLocaleString() : '-'),
      })),
      {
        header: '합계',
        key: 'odTotal',
        width: 12,
        formatter: (value: number) => value.toLocaleString(),
      },
    ];

    await this.excelService.downloadMultiSheetExcel(res, {
      fileName: `포인트내역_${dayjs().format('YYYYMMDD_HHmmss')}`,
      sheets: [
        {
          sheetName: '포인트 내역',
          data: result.items,
          columns: [
            {
              header: '날짜',
              key: 'date',
              width: 12,
              formatter: (_, row) => dayjs(row.createdAt).format('YYYY-MM-DD'),
            },
            {
              header: '시간',
              key: 'time',
              width: 10,
              formatter: (_, row) => dayjs(row.createdAt).format('HH:mm:ss'),
            },
            { header: '회원명', key: 'userName', width: 15 },
            { header: '휴대폰 번호', key: 'userMobile', width: 15 },
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
        },
        {
          sheetName: '유저별 통계',
          data: userStatsData,
          columns: [
            { header: 'user_id', key: 'userId', width: 10 },
            { header: '이름', key: 'name', width: 12 },
            { header: '휴대폰', key: 'mobile', width: 15 },
            {
              header: '획득 포인트',
              key: 'earnedPoints',
              width: 12,
              formatter: (v: number) => v.toLocaleString(),
            },
            {
              header: '초과 지급',
              key: 'excessPoints',
              width: 12,
              formatter: (v: number) => (v > 0 ? v.toLocaleString() : '-'),
            },
            {
              header: '정산 포인트',
              key: 'adjustedPoints',
              width: 12,
              formatter: (v: number) => v.toLocaleString(),
            },
            { header: '비고', key: 'note', width: 15 },
          ],
        },
        {
          sheetName: '일별 통계',
          data: dailyStatsData,
          columns: dailyColumns,
        },
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
