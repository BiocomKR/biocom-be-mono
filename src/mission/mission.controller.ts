import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
  ParseIntPipe,
  Query,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MissionCompletionService } from './mission-completion.service';
import { CompleteMissionDto } from './dto/mission-completion.dto';

/**
 * 미션 컨트롤러
 * 사용자의 미션 수행 관련 API
 */
@ApiTags('챌린지-미션')
@Controller('missions')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class MissionController {
  constructor(
    private readonly missionCompletionService: MissionCompletionService,
  ) {}

  /**
   * 오늘의 1일 1미션 조회
   * @description 현재 챌린지 일차의 1일 1미션을 조회합니다
   */
  @Get('daily')
  @ApiOperation({
    summary: '오늘의 1일 1미션 조회',
    description: '현재 챌린지 일차의 1일 1미션을 조회합니다'
  })
  @ApiResponse({
    status: 200,
    description: '1일 1미션 조회 성공'
  })
  async getDailyMission(@Request() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    return this.missionCompletionService.getDailyMission(userId);
  }

  /**
   * 일일 미션 진행도 조회 (메인화면용)
   * @description 오늘의 미션 목록과 전체 미션 달성률을 조회합니다
   */
  @Get('daily-progress')
  @ApiOperation({
    summary: '일일 미션 진행도 조회',
    description: '오늘의 미션 목록과 전체 미션 달성률을 조회합니다'
  })
  @ApiResponse({
    status: 200,
    description: '일일 미션 진행도 조회 성공'
  })
  async getDailyProgress(@Request() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    return this.missionCompletionService.getDailyProgress(userId);
  }

  /**
   * 미션 수행 완료
   * @description 챌린지 미션을 수행하고 완료 처리합니다
   */
  @Post('complete')
  @ApiOperation({
    summary: '미션 수행 완료',
    description: '챌린지 미션을 수행하고 완료 처리합니다. dailyLimit에 따라 진행도가 추적됩니다.'
  })
  @ApiResponse({
    status: 200,
    description: '미션 수행 성공'
  })
  @ApiResponse({
    status: 400,
    description: '잘못된 요청 (dailyLimit 초과, 필수 데이터 누락 등)'
  })
  @ApiResponse({
    status: 404,
    description: '미션을 찾을 수 없음'
  })
  async completeMission(
    @Body() dto: CompleteMissionDto,
    @Request() req: any
  ) {
    const userId = req.user?.userId || req.user?.sub;
    return this.missionCompletionService.completeMission(
      userId,
      dto
    );
  }

  /**
   * 완료한 미션 목록 조회
   * @description 지정한 기간 동안 완료한 미션들을 일자별로 조회합니다
   */
  @Get('completed')
  @ApiOperation({
    summary: '완료한 미션 목록 조회',
    description: '지정한 기간 동안 완료한 미션들을 일자별로 조회합니다'
  })
  @ApiQuery({
    name: 'startDate',
    required: true,
    description: '시작일 (YYYY-MM-DD)',
    example: '2025-01-01',
  })
  @ApiQuery({
    name: 'endDate',
    required: true,
    description: '종료일 (YYYY-MM-DD)',
    example: '2025-01-10',
  })
  @ApiResponse({
    status: 200,
    description: '완료한 미션 목록 조회 성공'
  })
  @ApiResponse({
    status: 404,
    description: '활성화된 챌린지가 없음'
  })
  async getCompletedMissions(
    @Request() req: any,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const userId = req.user?.userId || req.user?.sub;
    return this.missionCompletionService.getCompletedMissions(userId, startDate, endDate);
  }

  /**
   * 놓친 미션 목록 조회
   * @description 지정한 기간 동안 놓친 미션들을 일자별로 조회합니다 (과거 미션만)
   */
  @Get('missed')
  @ApiOperation({
    summary: '놓친 미션 목록 조회',
    description: '지정한 기간 동안 놓친 미션들을 일자별로 조회합니다. 미래 미션은 제외되며, 과거에 완료하지 못한 미션만 표시됩니다.'
  })
  @ApiQuery({
    name: 'startDate',
    required: true,
    description: '시작일 (YYYY-MM-DD)',
    example: '2025-01-01',
  })
  @ApiQuery({
    name: 'endDate',
    required: true,
    description: '종료일 (YYYY-MM-DD)',
    example: '2025-01-10',
  })
  @ApiResponse({
    status: 200,
    description: '놓친 미션 목록 조회 성공'
  })
  @ApiResponse({
    status: 404,
    description: '활성화된 챌린지가 없음'
  })
  async getMissedMissions(
    @Request() req: any,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string,
  ) {
    const userId = req.user?.userId || req.user?.sub;
    return this.missionCompletionService.getMissedMissions(userId, startDate, endDate);
  }

  /**
   * 자기선언문/칭찬내역 조회
   * @description 활성화된 챌린지의 자기선언문(1일차), 칭찬내역(10일차) 조회
   */
  @Get('self-records')
  @ApiOperation({
    summary: '자기선언문/칭찬내역 조회',
    description: '활성화된 챌린지의 자기선언문(DECLARATION)과 칭찬내역(SELF_PRAISE)을 조회합니다. 타입별로 구분되어 반환됩니다.'
  })
  @ApiResponse({
    status: 200,
    description: '자기선언문/칭찬내역 조회 성공',
    schema: {
      example: {
        success: true,
        data: [
          {
            type: 'DECLARATION',
            day: 1,
            contents: '자기 선언문 내용이 들어갑니다.',
            completedAt: '2025-01-15T10:30:00Z',
            pointsEarned: 100
          },
          {
            type: 'SELF_PRAISE',
            day: 10,
            contents: '칭찬 내용이 들어갑니다.',
            completedAt: '2025-01-24T14:20:00Z',
            pointsEarned: 100
          }
        ]
      }
    }
  })
  @ApiResponse({
    status: 404,
    description: '활성화된 챌린지가 없음'
  })
  async getRecords(@Request() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    return this.missionCompletionService.getRecords(userId);
  }
}