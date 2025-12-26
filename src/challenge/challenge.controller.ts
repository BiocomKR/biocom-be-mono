import { Controller, Get, Post, Body, Param, ParseIntPipe, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth, ApiExcludeEndpoint } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { Public } from '../common/decorators/public.decorator';
import { ChallengeService } from './challenge.service';
import { ChallengeSchedulerService } from './challenge-scheduler.service';
import { ActivateChallengeDto, ChallengeResponseDto } from './dto/challenge.dto';
import {
  SetStartDateDto,
  ChallengeScheduleResponseDto,
  QuickStartDto
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
  constructor(
    private readonly challengeService: ChallengeService,
    private readonly challengeSchedulerService: ChallengeSchedulerService,
  ) {}

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
   * @description 구매했지만 아직 활성화하지 않은 이용권 목록을 조회합니다 (PURCHASED 상태만)
   */
  @Get('my-tickets')
  @ApiOperation({
    summary: '내 챌린지 수행권 조회',
    description: '구매했지만 아직 활성화하지 않은 이용권 목록을 조회합니다. 활성화 가능한 티켓만 반환됩니다.'
  })
  @ApiResponse({
    status: 200,
    description: '수행권 목록 조회 성공 (PURCHASED 상태만)'
  })
  async getMyTickets(@Request() req: any) {
    const userId = req.user?.userId || req.user?.sub;
    return this.challengeService.getMyTickets(userId);
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
    const userId = req.user?.userId || req.user?.sub;
    return this.challengeService.getMyActiveChallenge(userId);
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
    const userId = req.user?.userId || req.user?.sub;
    return this.challengeService.activateChallenge(userId, dto.ticketId);
  }

  /**
   * 챌린지 설문 전후 비교 조회
   * @description 특정 챌린지의 사전/사후 설문 결과를 비교합니다
   */
  @Get(':productId/survey-comparison')
  @ApiOperation({
    summary: '챌린지 설문 전후 비교',
    description: '특정 챌린지의 사전/사후 설문 결과를 비교하여 개선 정도를 확인합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '챌린지 설문 비교 조회 성공'
  })
  async getChallengeSurveyComparison(
    @Param('productId', ParseIntPipe) productId: number,
    @Request() req: any
  ) {
    const userId = req.user?.userId || req.user?.sub;
    return this.challengeService.getChallengeSurveyComparison(userId, productId);
  }

  // ==================== 시작일 설정 API ====================

  /**
   * 빠른 챌린지 시작 (이너뷰티 챌린지 한정)
   * @description 이너뷰티 챌린지 조회 → 티켓 발급 → 활성화 → 시작일 설정을 한 번에 처리합니다.
   * 이너뷰티 챌린지만 지원하며, 다른 챌린지는 별도 API를 사용해야 합니다.
   */
  @Post('quick-start')
  @ApiOperation({
    summary: '[이너뷰티 한정] 빠른 챌린지 시작',
    description: '이너뷰티 챌린지를 한 번에 시작합니다 (조회 → 티켓 발급 → 활성화 → 시작일 설정). 이너뷰티 챌린지만 지원됩니다.'
  })
  @ApiResponse({
    status: 201,
    description: '챌린지 시작 성공',
    type: ChallengeScheduleResponseDto
  })
  @ApiResponse({
    status: 400,
    description: '잘못된 시작일'
  })
  @ApiResponse({
    status: 409,
    description: '이미 활성 챌린지가 존재함'
  })
  async quickStartChallenge(
    @Body() quickStartDto: QuickStartDto,
    @Request() req: any
  ) {
    const userId = req.user?.userId || req.user?.sub;
    return this.challengeService.quickStartChallenge(userId, quickStartDto.startDate);
  }

  /**
   * 챌린지 일정 조회
   * @description 특정 챌린지의 일정 정보를 조회합니다
   */
  @Get(':productId/schedule')
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
    @Param('productId', ParseIntPipe) productId: number,
    @Request() req: any
  ) {
    const userId = req.user?.userId || req.user?.sub;
    return this.challengeService.getChallengeSchedule(userId, productId);
  }

  /**
   * 챌린지 시작일 설정
   * @description 처음으로 챌린지 시작일을 설정합니다
   */
  @Post(':productId/schedule/start-date')
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
    @Param('productId', ParseIntPipe) productId: number,
    @Body() setStartDateDto: SetStartDateDto,
    @Request() req: any
  ) {
    console.log('req.user:', req.user);
    const userId = req.user?.userId || req.user?.sub;
    console.log('userId:', userId);
    return this.challengeService.setStartDate(userId, productId, setStartDateDto);
  }

  // ⚠️ 시작일 수정 및 확정 API 제거됨
  // - 시작일은 한번 설정하면 수정 불가
  // - 시작일 설정 시 바로 확정 및 ACTIVE 상태로 변경됨

  /**
   * 챌린지 활성화 크론잡 수동 실행 (테스트용)
   * @description PENDING 상태의 챌린지를 즉시 ACTIVE로 전환합니다
   */
  @Post('scheduler/run-activation')
  @Public()
  @SkipThrottle()
  @ApiOperation({
    summary: '챌린지 활성화 크론잡 수동 실행 (테스트용)',
    description: '오늘 시작일인 PENDING 챌린지들을 즉시 ACTIVE로 전환합니다'
  })
  @ApiResponse({
    status: 200,
    description: '크론잡 실행 완료'
  })
  async runChallengeActivation() {
    await this.challengeSchedulerService.runManually();
    return {
      success: true,
      message: '챌린지 활성화 크론잡이 수동으로 실행되었습니다'
    };
  }

  /**
   * [테스트] 모든 PENDING 챌린지 즉시 활성화
   * 날짜 조건 무시
   */
  @Post('scheduler/activate-all-pending')
  @Public()
  @SkipThrottle()
  @ApiExcludeEndpoint()
  async activateAllPending() {
    const result = await this.challengeSchedulerService.activateAllPendingTest();
    return {
      success: true,
      message: `PENDING 챌린지 활성화 완료: 성공 ${result.success}건, 실패 ${result.fail}건`,
      data: result
    };
  }

  //--------------------- TEST ---------------------
  /**
   * 빠른 챌린지 시작 TEST (배열로 다수 등록)
   */
  @Post('quick-start-test')
  @Public()
  @SkipThrottle()
  @ApiExcludeEndpoint()
  async quickStartChallengeTest(@Body() userIds: number[]) {
    const results = await this.challengeService.quickStartChallengeTest(userIds);
    return {
      success: true,
      message: `${results.filter(r => r.success).length}명 챌린지 시작 완료`,
      data: results,
    };
  }
}