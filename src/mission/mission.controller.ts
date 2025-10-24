import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  UseGuards,
  Request,
  ParseIntPipe,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
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
}