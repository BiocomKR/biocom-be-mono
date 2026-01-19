import {
  Controller,
  Get,
  Param,
  Query,
  ParseIntPipe,
  UseGuards,
  DefaultValuePipe,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiParam, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../common/guards/jwt-auth.guard';
import { RecordsService } from './records.service';
import { UserRecordsQueryDto } from './dto/user-records.dto';
import { getNowKST } from '../common/utils/kst-date.util';

@ApiTags('기록 통계')
@Controller('records')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class RecordsController {
  constructor(private readonly recordsService: RecordsService) {}

  /**
   * 기록 통계 대시보드 (경영진용)
   */
  @Get('dashboard')
  @ApiOperation({ summary: '기록 통계 대시보드 (경영진용)' })
  @ApiQuery({ name: 'excludeTesters', required: false, type: Boolean, description: '테스터 제외 여부' })
  async getDashboard(
    @Query('excludeTesters') excludeTesters?: string,
  ) {
    const exclude = excludeTesters === 'true';
    const data = await this.recordsService.getDashboard(exclude);
    return {
      success: true,
      message: '기록 통계 대시보드 조회 성공',
      data,
      timestamp: getNowKST(),
    };
  }

  /**
   * 기록통계 내역 (운영용) - 전체 요약
   */
  @Get('stats')
  @ApiOperation({ summary: '기록통계 내역 - 전체 요약 (운영용)' })
  @ApiQuery({ name: 'excludeTesters', required: false, type: Boolean, description: '테스터 제외 여부' })
  async getRecordsStats(
    @Query('excludeTesters') excludeTesters?: string,
  ) {
    const exclude = excludeTesters === 'true';
    const data = await this.recordsService.getRecordsStats(exclude);
    return {
      success: true,
      message: '기록통계 내역 조회 성공',
      data,
      timestamp: getNowKST(),
    };
  }

  /**
   * 사용자별 기록통계 목록 (운영용)
   */
  @Get('stats/users')
  @ApiOperation({ summary: '사용자별 기록통계 목록 (운영용)' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '페이지 번호' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '페이지당 수' })
  @ApiQuery({ name: 'search', required: false, type: String, description: '검색어 (닉네임/이메일)' })
  @ApiQuery({ name: 'challengeStatus', required: false, type: String, description: '챌린지 상태 필터' })
  @ApiQuery({ name: 'churnRisk', required: false, type: Boolean, description: '이탈 위험 사용자만 표시 (3일 이상 미기록)' })
  @ApiQuery({ name: 'excludeTesters', required: false, type: Boolean, description: '테스터 제외 여부' })
  async getUserRecordStatsList(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(20), ParseIntPipe) limit: number,
    @Query('search') search?: string,
    @Query('challengeStatus') challengeStatus?: string,
    @Query('churnRisk') churnRisk?: string,
    @Query('excludeTesters') excludeTesters?: string,
  ) {
    const exclude = excludeTesters === 'true';
    const churnRiskFilter = churnRisk === 'true';
    const data = await this.recordsService.getUserRecordStatsList(
      page,
      limit,
      search,
      challengeStatus,
      exclude,
      churnRiskFilter,
    );
    return {
      success: true,
      message: '사용자별 기록통계 조회 성공',
      data,
      timestamp: getNowKST(),
    };
  }

  /**
   * 기록 Row 목록 조회 (단순 조회)
   */
  @Get('rows')
  @ApiOperation({ summary: '기록 Row 목록 조회 (단순 조회)' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '페이지 번호' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '페이지당 수' })
  @ApiQuery({ name: 'recordType', required: false, type: String, description: '기록 유형 필터' })
  @ApiQuery({ name: 'startDate', required: false, type: String, description: '시작일 (YYYY-MM-DD)' })
  @ApiQuery({ name: 'endDate', required: false, type: String, description: '종료일 (YYYY-MM-DD)' })
  @ApiQuery({ name: 'search', required: false, type: String, description: '검색어 (이름/이메일)' })
  @ApiQuery({ name: 'excludeTesters', required: false, type: Boolean, description: '테스터 제외 여부' })
  async getRecordRowList(
    @Query('page', new DefaultValuePipe(1), ParseIntPipe) page: number,
    @Query('limit', new DefaultValuePipe(10), ParseIntPipe) limit: number,
    @Query('recordType') recordType?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('search') search?: string,
    @Query('excludeTesters') excludeTesters?: string,
  ) {
    const exclude = excludeTesters === 'true';
    const data = await this.recordsService.getRecordRowList(
      page,
      limit,
      recordType,
      startDate,
      endDate,
      search,
      exclude,
    );
    return {
      success: true,
      message: '기록 목록 조회 성공',
      data,
      timestamp: getNowKST(),
    };
  }

  /**
   * 회원별 기록 조회
   */
  @Get('users/:userId')
  @ApiOperation({ summary: '회원별 기록 조회' })
  @ApiParam({ name: 'userId', description: '회원 ID' })
  async getUserRecords(
    @Param('userId', ParseIntPipe) userId: number,
    @Query() query: UserRecordsQueryDto,
  ) {
    const data = await this.recordsService.getUserRecords(userId, query);
    return {
      success: true,
      message: '회원 기록 조회 성공',
      data,
      timestamp: getNowKST(),
    };
  }
}
