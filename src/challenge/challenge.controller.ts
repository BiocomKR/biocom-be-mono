import { Controller, Get, Post, Body, Param, ParseIntPipe, UseGuards, Request } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { ChallengeService } from './challenge.service';
import { ActivateChallengeDto, ChallengeResponseDto } from './dto/challenge.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

/**
 * 챌린지 관리 컨트롤러
 * 사용자의 챌린지 구매, 활성화, 진행 상황 관리를 담당
 */
@ApiTags('challenges')
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

}