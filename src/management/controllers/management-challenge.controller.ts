import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  ParseIntPipe,
  HttpStatus,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { ChallengeService } from '../../challenge/challenge.service';
import { getNowKST } from '../../common/utils/kst-date.util';

/**
 * Management 챌린지 관리 컨트롤러
 * 백오피스에서 챌린지를 관리하는 API
 */
@Controller('management/challenges')
@UseGuards(ApiKeyGuard)
export class ManagementChallengeController {
  private readonly logger = new Logger(ManagementChallengeController.name);

  constructor(
    private readonly challengeService: ChallengeService,
  ) {}

  /**
   * 모든 챌린지 목록 조회
   */
  @Get()
  async getAllChallenges(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    this.logger.log(`챌린지 목록 조회 - 페이지: ${page}, 제한: ${limit}`);
    
    const challenges = await this.challengeService.findAllChallenges({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
      status,
      search,
    });

    return {
      success: true,
      message: '챌린지 목록 조회 성공',
      data: challenges,
      timestamp: getNowKST(),
    };
  }

  /**
   * 특정 챌린지 상세 조회
   */
  @Get(':id')
  async getChallengeById(
    @Param('id', ParseIntPipe) id: number,
  ) {
    this.logger.log(`챌린지 상세 조회 - ID: ${id}`);
    
    const challenge = await this.challengeService.findChallengeById(id);
    return {
      success: true,
      message: '챌린지 상세 조회 성공',
      data: challenge,
      timestamp: getNowKST(),
    };
  }

  /**
   * 새로운 챌린지 생성
   */
  @Post()
  async createChallenge(
    @Body() createChallengeDto: {
      name: string;
      description?: string;
      totalDays: number;
      price: number;
      categoryCode?: string;
      categoryName?: string;
      isActive?: boolean;
    }
  ) {
    this.logger.log(`챌린지 생성 - 이름: ${createChallengeDto.name}`);

    const challenge = await this.challengeService.createChallenge(createChallengeDto);
    return {
      success: true,
      message: '챌린지 생성 성공',
      data: challenge,
      timestamp: getNowKST(),
    };
  }

  /**
   * 챌린지 정보 수정
   */
  @Put(':id')
  async updateChallenge(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateChallengeDto: {
      name?: string;
      description?: string;
      startDate?: string;
      endDate?: string;
      totalDays?: number;
      maxParticipants?: number;
      entryFee?: number;
      isActive?: boolean;
    }
  ) {
    this.logger.log(`챌린지 수정 - ID: ${id}`);
    
    const challenge = await this.challengeService.updateChallenge(id, updateChallengeDto);
    return {
      success: true,
      message: '챌린지 수정 성공',
      data: challenge,
      timestamp: getNowKST(),
    };
  }

  /**
   * 챌린지 삭제
   */
  @Delete(':id')
  async deleteChallenge(
    @Param('id', ParseIntPipe) id: number,
  ) {
    this.logger.log(`챌린지 삭제 - ID: ${id}`);
    
    await this.challengeService.deleteChallenge(id);
    return {
      success: true,
      message: '챌린지 삭제 성공',
      data: null,
      timestamp: getNowKST(),
    };
  }

  /**
   * 챌린지 참여자 목록 조회
   */
  @Get(':id/participants')
  async getChallengeParticipants(
    @Param('id', ParseIntPipe) productId: number,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('status') status?: string,
  ) {
    this.logger.log(`챌린지 참여자 목록 조회 - 상품 ID: ${productId}`);

    const participants = await this.challengeService.getChallengeParticipants({
      productId,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
      status,
    });

    return {
      success: true,
      message: '챌린지 참여자 목록 조회 성공',
      data: participants,
      timestamp: getNowKST(),
    };
  }

  /**
   * 챌린지에 미션 추가
   */
  @Post(':id/missions')
  async addMissionToChallenge(
    @Param('id', ParseIntPipe) productId: number,
    @Body() missionData: {
      missionId: number;
      day: number;
      requiredCount?: number;
      points?: number;
      isActive?: boolean;
    }
  ) {
    this.logger.log(`챌린지에 미션 추가 - 상품 ID: ${productId}, 미션 ID: ${missionData.missionId}`);

    const challengeMission = await this.challengeService.addMissionToChallenge(productId, missionData);
    return {
      success: true,
      message: '챌린지 미션 추가 성공',
      data: challengeMission,
      timestamp: getNowKST(),
    };
  }

  /**
   * 챌린지에 설문 추가
   */
  @Post(':id/surveys')
  async addSurveyToChallenge(
    @Param('id', ParseIntPipe) productId: number,
    @Body() surveyData: {
      surveyId: number;
      day: number;
      points?: number;
      isActive?: boolean;
    }
  ) {
    this.logger.log(`챌린지에 설문 추가 - 상품 ID: ${productId}, 설문 ID: ${surveyData.surveyId}`);

    const challengeSurvey = await this.challengeService.addSurveyToChallenge(productId, surveyData);
    return {
      success: true,
      message: '챌린지 설문 추가 성공',
      data: challengeSurvey,
      timestamp: getNowKST(),
    };
  }

  /**
   * 챌린지에 퀴즈 추가
   */
  @Post(':id/quizzes')
  async addQuizToChallenge(
    @Param('id', ParseIntPipe) productId: number,
    @Body() quizData: {
      quizId: number;
      day: number;
      points?: number;
      isActive?: boolean;
    }
  ) {
    this.logger.log(`챌린지에 퀴즈 추가 - 상품 ID: ${productId}, 퀴즈 ID: ${quizData.quizId}`);

    const challengeQuiz = await this.challengeService.addQuizToChallenge(productId, quizData);
    return {
      success: true,
      message: '챌린지 퀴즈 추가 성공',
      data: challengeQuiz,
      timestamp: getNowKST(),
    };
  }

  /**
   * 챌린지에 컨텐츠 추가
   */
  @Post(':id/contents')
  async addContentToChallenge(
    @Param('id', ParseIntPipe) productId: number,
    @Body() contentData: {
      contentId: number;
      weekNumber: number;
      isActive?: boolean;
    }
  ) {
    this.logger.log(`챌린지에 컨텐츠 추가 - 상품 ID: ${productId}, 컨텐츠 ID: ${contentData.contentId}`);

    const challengeContent = await this.challengeService.addContentToChallenge(productId, contentData);
    return {
      success: true,
      message: '챌린지 컨텐츠 추가 성공',
      data: challengeContent,
      timestamp: getNowKST(),
    };
  }

  /**
   * 챌린지 통계 조회
   */
  @Get(':id/stats')
  async getChallengeStats(
    @Param('id', ParseIntPipe) productId: number,
  ) {
    this.logger.log(`챌린지 통계 조회 - 상품 ID: ${productId}`);

    const stats = await this.challengeService.getChallengeStats(productId);
    return {
      success: true,
      message: '챌린지 통계 조회 성공',
      data: stats,
      timestamp: getNowKST(),
    };
  }

  /**
   * 챌린지 활성/비활성 전환
   */
  @Put(':id/toggle-status')
  async toggleChallengeStatus(
    @Param('id', ParseIntPipe) productId: number,
  ) {
    this.logger.log(`챌린지 상태 전환 - 상품 ID: ${productId}`);

    const challenge = await this.challengeService.toggleChallengeStatus(productId);
    return {
      success: true,
      message: '챌린지 상태 전환 성공',
      data: challenge,
      timestamp: getNowKST(),
    };
  }
}