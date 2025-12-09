import {
  Controller,
  Get,
  UseGuards,
  Request,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiExtraModels,
} from '@nestjs/swagger';
import { HomeService } from './home.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  HomeResponseDto,
  NewcomerHomeDataDto,
  ChallengerHomeDataDto,
  SubscriberHomeDataDto,
  NewHomeResponseDto,
} from './dto/home.dto';

/**
 * 홈 화면 컨트롤러
 * 사용자의 구독 상태에 따라 다른 홈 화면 데이터 제공
 *
 * 플로우:
 * - NEWCOMER: 챌린지 구매 유도 화면 (home_일반.png)
 * - CHALLENGER: 챌린지 진행 중 화면 (home_챌린저.png)
 * - SUBSCRIBER: 구독자 전용 화면
 */
@ApiTags('홈화면')
@Controller('home')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
@ApiExtraModels(NewcomerHomeDataDto, ChallengerHomeDataDto, SubscriberHomeDataDto)
export class HomeController {
  constructor(private readonly homeService: HomeService) {}

  // /**
  //  * 홈 화면 데이터 조회 (v1 - deprecated)
  //  * @description 사용자의 구독 상태에 따라 적절한 홈 화면 데이터를 반환합니다
  //  */
  // @Get('v1')
  // @ApiOperation({
  //   summary: '홈 화면 데이터 조회 (v1 - deprecated)',
  //   description: '사용자의 구독 상태(NEWCOMER/CHALLENGER/SUBSCRIBER)에 따라 적절한 홈 화면 구성을 반환합니다.',
  // })
  // @ApiResponse({
  //   status: 200,
  //   description: '홈 화면 데이터 조회 성공',
  //   type: HomeResponseDto,
  // })
  // async getHomeData(@Request() req: any) {
  //   const data = await this.homeService.getHomeData(req.user.id);
  //   return {
  //     success: true,
  //     data,
  //     message: '홈 화면 데이터 조회 성공',
  //   };
  // }

  /**
   * 홈 화면 데이터 조회
   * @description 검사 정보, 동물 유형, 챌린지 정보 등을 포함한 새 스펙
   */
  @Get()
  @ApiOperation({
    summary: '홈 화면 데이터 조회',
    description: '검사 정보, 동물 유형, 페르소나, 챌린지 진행률, 미션 목록 등을 포함한 새 홈 화면 데이터를 반환합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '홈 화면 데이터 조회 성공',
    type: NewHomeResponseDto,
  })
  async getNewHomeData(@Request() req: any) {
    const data = await this.homeService.getNewHomeData(req.user.id);
    return {
      success: true,
      data,
      message: '홈 화면 데이터 조회 성공',
    };
  }

  @Get('health-exam-status')
  @ApiOperation({
    summary: '종합건강대사 검사 완료 여부 확인',
    description: 'TODO: 외부 API 연동 - 사용자의 종합건강대사 검사 완료 여부를 확인합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '검사 완료 여부 조회 성공',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean', example: true },
        data: {
          type: 'object',
          properties: {
            isCompleted: { type: 'boolean', example: true },
            examDate: { type: 'string', format: 'date', example: '2025-09-15' },
            message: { type: 'string', example: '검사가 완료되었습니다' }
          }
        },
        message: { type: 'string', example: '검사 완료 여부 조회 성공' }
      }
    }
  })
  async getHealthExamStatus(@Request() req: any) {
    // TODO: 외부 API 호출로 종합건강대사 검사 완료 여부 확인
    // 현재는 임시로 모든 사용자가 검사 완료된 것으로 처리
    const data = await this.homeService.getHealthExamStatus(req.user.id);
    return {
      success: true,
      data,
      message: '검사 완료 여부 조회 성공',
    };
  }
}