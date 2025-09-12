import { Controller, Get, Post, Put, Body, Param, ParseIntPipe, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ChallengeService } from './challenge.service';
import { ActivateChallengeDto, ChallengeResponseDto } from './dto/challenge.dto';
import { 
  SetStartDateDto, 
  UpdateStartDateDto, 
  ConfirmStartDateDto,
  ChallengeScheduleResponseDto 
} from './dto/challenge-schedule.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * 챌린지 관리 컨트롤러
 * 사용자의 챌린지 구매, 활성화, 진행 상황 관리를 담당
 */
@ApiTags('챌린지-관리')
@Controller('challenges')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class ChallengeController {
  constructor(private readonly challengeService: ChallengeService) {}

  /**
   * 구매 가능한 챌린지 목록 조회
   * @description 상품으로 등록된 활성 챌린지들을 조회합니다
   */
  @Get()
  @ApiOperation({
    summary: '구매 가능한 챌린지 목록 조회',
    description: '상품으로 등록된 활성 챌린지들을 조회합니다'
  })
  @ApiResponse({
    status: 200,
    description: '챌린지 목록 조회 성공',
    type: [ChallengeResponseDto]
  })
  async getAvailableChallenges() {
    return this.challengeService.getAvailableChallenges();
  }

  /**
   * 사용자의 챌린지 수행권 조회
   * @description 사용자가 보유한 챌린지 수행권 목록을 조회합니다
   */
  @Get('my-tickets')
  @ApiOperation({
    summary: '내 챌린지 수행권 조회',
    description: '사용자가 보유한 챌린지 수행권 목록을 조회합니다'
  })
  @ApiResponse({
    status: 200,
    description: '수행권 목록 조회 성공'
  })
  async getMyTickets(@Request() req: any) {
    return this.challengeService.getMyTickets(req.user.userId);
  }

  /**
   * 현재 활성 챌린지 조회
   * @description 사용자의 현재 진행 중인 챌린지를 조회합니다
   */
  @Get('my-active')
  @ApiOperation({
    summary: '내 활성 챌린지 조회',
    description: '사용자의 현재 진행 중인 챌린지를 조회합니다'
  })
  @ApiResponse({
    status: 200,
    description: '활성 챌린지 조회 성공'
  })
  async getMyActiveChallenge(@Request() req: any) {
    return this.challengeService.getMyActiveChallenge(req.user.userId);
  }

  /**
   * 챌린지 활성화 (수행권 사용)
   * @description 구매한 챌린지 수행권을 활성화하여 챌린지를 시작합니다
   */
  @Post('activate')
  @ApiOperation({
    summary: '챌린지 활성화',
    description: '구매한 챌린지 수행권을 활성화하여 챌린지를 시작합니다'
  })
  @ApiResponse({
    status: 201,
    description: '챌린지 활성화 성공'
  })
  @ApiResponse({
    status: 409,
    description: '이미 활성 챌린지가 존재함'
  })
  async activateChallenge(@Body() dto: ActivateChallengeDto, @Request() req: any) {
    return this.challengeService.activateChallenge(req.user.userId, dto.ticketId);
  }

  /**
   * 챌린지 설문 전후 비교 조회
   * @description 특정 챌린지의 사전/사후 설문 결과를 비교합니다
   */
  @Get(':challengeId/survey-comparison')
  @ApiOperation({
    summary: '챌린지 설문 전후 비교',
    description: '특정 챌린지의 사전/사후 설문 결과를 비교하여 개선 정도를 확인합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '챌린지 설문 비교 조회 성공'
  })
  async getChallengeSurveyComparison(
    @Param('challengeId', ParseIntPipe) challengeId: number,
    @Request() req: any
  ) {
    return this.challengeService.getChallengeSurveyComparison(req.user.userId, challengeId);
  }

  // ==================== 시작일 설정 API ====================

  /**
   * 챌린지 일정 조회
   * @description 특정 챌린지의 일정 정보를 조회합니다
   */
  @Get(':challengeId/schedule')
  @ApiOperation({
    summary: '챌린지 일정 조회',
    description: '특정 챌린지의 시작일, 배송일, 종료일 등 일정 정보를 조회합니다'
  })
  @ApiResponse({
    status: 200,
    description: '챌린지 일정 조회 성공',
    type: ChallengeScheduleResponseDto
  })
  @ApiResponse({
    status: 404,
    description: '챌린지를 찾을 수 없음'
  })
  async getChallengeSchedule(
    @Param('challengeId', ParseIntPipe) challengeId: number,
    @Request() req: any
  ) {
    return this.challengeService.getChallengeSchedule(req.user.userId, challengeId);
  }

  /**
   * 챌린지 시작일 설정
   * @description 처음으로 챌린지 시작일을 설정합니다
   */
  @Post(':challengeId/schedule/start-date')
  @ApiOperation({
    summary: '챌린지 시작일 설정',
    description: '처음으로 챌린지 시작일을 설정합니다. 시작일 기준으로 배송일(-1일, 평일)과 종료일(+20일)이 자동 계산됩니다.'
  })
  @ApiResponse({
    status: 201,
    description: '시작일 설정 성공',
    type: ChallengeScheduleResponseDto
  })
  @ApiResponse({
    status: 400,
    description: '잘못된 날짜 (오늘 이후, 구매일+30일 이내여야 함)'
  })
  @ApiResponse({
    status: 409,
    description: '시작일이 이미 설정됨'
  })
  async setStartDate(
    @Param('challengeId', ParseIntPipe) challengeId: number,
    @Body() setStartDateDto: SetStartDateDto,
    @Request() req: any
  ) {
    return this.challengeService.setStartDate(req.user.userId, challengeId, setStartDateDto);
  }

  /**
   * 챌린지 시작일 수정
   * @description 기존 시작일을 수정합니다 (확정되지 않은 경우에만)
   */
  @Put(':challengeId/schedule/start-date')
  @ApiOperation({
    summary: '챌린지 시작일 수정',
    description: '기존 시작일을 수정합니다. 시작일이 확정된 경우에는 수정할 수 없습니다.'
  })
  @ApiResponse({
    status: 200,
    description: '시작일 수정 성공',
    type: ChallengeScheduleResponseDto
  })
  @ApiResponse({
    status: 400,
    description: '시작일이 설정되지 않았거나 잘못된 날짜'
  })
  @ApiResponse({
    status: 409,
    description: '시작일이 확정되어 수정 불가'
  })
  async updateStartDate(
    @Param('challengeId', ParseIntPipe) challengeId: number,
    @Body() updateStartDateDto: UpdateStartDateDto,
    @Request() req: any
  ) {
    return this.challengeService.updateStartDate(req.user.userId, challengeId, updateStartDateDto);
  }

  /**
   * 챌린지 시작일 확정
   * @description 시작일을 확정하여 더 이상 수정할 수 없도록 만듭니다
   */
  @Post(':challengeId/schedule/confirm')
  @ApiOperation({
    summary: '챌린지 시작일 확정',
    description: '시작일을 확정합니다. 확정된 후에는 더 이상 수정할 수 없습니다.'
  })
  @ApiResponse({
    status: 201,
    description: '시작일 확정 성공',
    type: ChallengeScheduleResponseDto
  })
  @ApiResponse({
    status: 400,
    description: '시작일이 설정되지 않음'
  })
  @ApiResponse({
    status: 409,
    description: '시작일이 이미 확정됨'
  })
  async confirmStartDate(
    @Param('challengeId', ParseIntPipe) challengeId: number,
    @Body() confirmStartDateDto: ConfirmStartDateDto,
    @Request() req: any
  ) {
    return this.challengeService.confirmStartDate(req.user.userId, challengeId, confirmStartDateDto);
  }

}