import { 
  Controller, 
  Get, 
  Query, 
  Req, 
  Param,
  HttpStatus,
  Logger,
  UseGuards,
  NotFoundException,
  Post,
  Body
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiQuery,
  ApiParam,
  ApiBearerAuth,
  ApiBody
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { MissionService } from './mission.service';
import { MissionResponseDto, UserMissionProgressDto } from './dto/mission-response.dto';
import { ApiSuccessResponse } from '../common/dto/api-response.dto';

/**
 * 일일 미션 관리 컨트롤러
 * 미션 정보 조회 및 진행 상황 확인 API
 */
@ApiTags('챌린지-mission')
@Controller('mission')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class MissionController {
  private readonly logger = new Logger(MissionController.name);

  constructor(
    private readonly missionService: MissionService
  ) {}

  /**
   * 특정 날짜의 미션 목록 조회
   */
  @Get('daily')
  @ApiOperation({ 
    summary: '일일 미션 목록 조회', 
    description: '특정 날짜의 활성화된 미션 목록을 조회합니다. (1일 1미션, 이벤트 미션 포함)' 
  })
  @ApiQuery({ 
    name: 'date', 
    required: true, 
    description: '조회할 날짜 (YYYY-MM-DD)', 
    example: '2025-06-30' 
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: '미션 목록 조회 성공',
    type: ApiSuccessResponse
  })
  async getDailyMissions(
    @Req() req: any,
    @Query('date') date: string
  ): Promise<ApiSuccessResponse<MissionResponseDto[]>> {
    this.logger.log(`일일 미션 목록 조회 요청 - 사용자: ${req.user.sub}, 날짜: ${date}`);

    // 날짜를 일차로 변환
    const day = await this.missionService.eventService.calculateEventDay(date);
    const dayMissions = await this.missionService.getDayMissions(req.user.sub, day);
    
    // DTO 형식으로 변환
    const missions = dayMissions.available.map(item => ({
      id: item.mission.id,
      code: item.mission.code,
      name: item.mission.name,
      description: item.mission.description,
      points: item.eventMission.points,
      isCompleted: item.completed,
      completionData: item.completionData,
      requireUpload: item.mission.requireUpload,
      uploadType: item.mission.uploadType,
      category: item.mission.category,
      dailyLimit: item.mission.dailyLimit,
      sortOrder: item.mission.sortOrder,
    }));

    return {
      success: true,
      message: '일일 미션 목록이 성공적으로 조회되었습니다.',
      data: missions,
      timestamp: new Date(),
    };
  }

  /**
   * 모든 활성 미션 목록 조회 (관리자용)
   */
  @Get()
  @ApiOperation({ 
    summary: '전체 미션 목록 조회', 
    description: '모든 활성화된 미션 목록을 조회합니다. (관리자용)' 
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: '미션 목록 조회 성공',
    type: ApiSuccessResponse
  })
  async getAllMissions(@Req() req: any): Promise<ApiSuccessResponse<MissionResponseDto[]>> {
    this.logger.log(`전체 미션 목록 조회 요청 - 사용자: ${req.user.sub}`);

    const missions = await this.missionService.getAllMissions();
    
    // DTO 형식으로 변환
    const missionsDto = missions.map(mission => ({
      id: mission.id,
      code: mission.code,
      name: mission.name,
      description: mission.description,
      points: mission.points,
      isCompleted: false,
      requireUpload: mission.requireUpload,
      uploadType: mission.uploadType,
      category: mission.category,
      dailyLimit: mission.dailyLimit,
      totalDays: mission.totalDays,
      sortOrder: mission.sortOrder,
    }));

    return {
      success: true,
      message: '전체 미션 목록이 성공적으로 조회되었습니다.',
      data: missionsDto,
      timestamp: new Date(),
    };
  }

  /**
   * 사용자의 일일 미션 진행 상황 조회
   */
  @Get('progress')
  @ApiOperation({ 
    summary: '일일 미션 진행 상황 조회', 
    description: '특정 날짜의 사용자 미션 진행 상황을 조회합니다.' 
  })
  @ApiQuery({ 
    name: 'date', 
    required: true, 
    description: '조회할 날짜 (YYYY-MM-DD)', 
    example: '2024-01-13' 
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: '미션 진행 상황 조회 성공',
    type: ApiSuccessResponse
  })
  async getUserMissionProgress(
    @Req() req: any,
    @Query('date') date: string
  ): Promise<ApiSuccessResponse<UserMissionProgressDto>> {
    this.logger.log(`사용자 미션 진행 상황 조회 요청 - 사용자: ${req.user.sub}, 날짜: ${date}`);

    // 날짜를 일차로 변환
    const day = await this.missionService.eventService.calculateEventDay(date);
    const dayMissions = await this.missionService.getDayMissions(req.user.sub, day);
    const userProgress = await this.missionService.getUserProgress(req.user.sub);
    
    // 해당 날짜의 진행 상황만 추출
    const dayProgress = userProgress.dailyProgress.find(p => p.day === day) || {
      day,
      completed: 0,
      total: dayMissions.available.length,
      points: 0
    };
    
    const progress = {
      date,
      day,
      totalMissions: dayProgress.total,
      completedMissions: dayProgress.completed,
      earnedPoints: dayProgress.points,
      missions: dayMissions.available.map(item => ({
        mission: {
          id: item.mission.id,
          code: item.mission.code,
          name: item.mission.name,
          description: item.mission.description,
          points: item.eventMission.points,
          isCompleted: item.completed,
          completionData: item.completionData,
          requireUpload: item.mission.requireUpload,
          uploadType: item.mission.uploadType,
          category: item.mission.category,
          dailyLimit: item.mission.dailyLimit,
          sortOrder: item.mission.sortOrder,
        },
        completed: item.completed,
        completedAt: item.completionData?.completedAt || null,
        earnedPoints: item.completed ? item.eventMission.points : 0,
      })),
      summary: {
        totalDays: userProgress.totalDays,
        completedDays: userProgress.completedDays,
        totalPoints: userProgress.totalPoints,
        progressPercentage: Math.round((userProgress.completedDays / userProgress.totalDays) * 100),
        // MissionSummaryDto 필수 필드 추가
        totalMissions: userProgress.totalDays * 3, // 대략적인 값
        completedMissions: dayProgress.completed,
        remainingMissions: (userProgress.totalDays * 3) - dayProgress.completed,
        totalEarnedPoints: userProgress.totalPoints,
        totalPossiblePoints: userProgress.totalDays * 100, // 대략적인 값
        completionRate: Math.round((userProgress.completedDays / userProgress.totalDays) * 100),
        totalMissionCount: userProgress.totalDays * 3,
        totalCompletedMissionCount: userProgress.completedDays * 3,
        totalRemainingMissionCount: (userProgress.totalDays - userProgress.completedDays) * 3,
        completedMissionCount: userProgress.completedDays * 3, // 누락된 필드 추가
        overallCompletionRate: Math.round((userProgress.completedDays / userProgress.totalDays) * 100), // 누락된 필드 추가
      }
    };

    return {
      success: true,
      message: '미션 진행 상황이 성공적으로 조회되었습니다.',
      data: progress,
      timestamp: new Date(),
    };
  }

  /**
   * 사용자의 주간 미션 진행 상황 조회
   */
  @Get('weekly')
  @ApiOperation({ 
    summary: '주간 미션 진행 상황 조회', 
    description: '특정 기간 동안의 일별 미션 진행 상황을 조회합니다.' 
  })
  @ApiQuery({ 
    name: 'startDate', 
    required: true, 
    description: '시작 날짜 (YYYY-MM-DD)', 
    example: '2024-01-07' 
  })
  @ApiQuery({ 
    name: 'endDate', 
    required: true, 
    description: '종료 날짜 (YYYY-MM-DD)', 
    example: '2024-01-13' 
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: '주간 미션 진행 상황 조회 성공',
    type: ApiSuccessResponse
  })
  async getUserWeeklyProgress(
    @Req() req: any,
    @Query('startDate') startDate: string,
    @Query('endDate') endDate: string
  ): Promise<ApiSuccessResponse<{ date: string; completed: number; total: number; points: number }[]>> {
    this.logger.log(`사용자 주간 미션 진행 상황 조회 요청 - 사용자: ${req.user.sub}, 기간: ${startDate} ~ ${endDate}`);

    // 전체 진행 상황 조회
    const userProgress = await this.missionService.getUserProgress(req.user.sub);
    
    // 시작일과 종료일의 일차 계산
    const startDay = await this.missionService.eventService.calculateEventDay(startDate);
    const endDay = await this.missionService.eventService.calculateEventDay(endDate);
    
    // 기간 내 진행 상황 필터링
    const weeklyProgress = userProgress.dailyProgress
      .filter(p => p.day >= startDay && p.day <= endDay)
      .map(p => {
        // 일차를 날짜로 변환
        const date = new Date(startDate);
        date.setDate(date.getDate() + (p.day - startDay));
        
        return {
          date: date.toISOString().split('T')[0],
          completed: p.completed,
          total: p.total,
          points: p.points
        };
      });

    return {
      success: true,
      message: '주간 미션 진행 상황이 성공적으로 조회되었습니다.',
      data: weeklyProgress,
      timestamp: new Date(),
    };
  }

  /**
   * 개별 미션 상세 정보 조회
   */
  @Get('detail/:missionCode')
  @ApiOperation({ 
    summary: '개별 미션 상세 정보 조회', 
    description: '특정 미션의 상세 정보를 조회합니다. DAILY_MISSION의 경우 special_missions 테이블을 참조합니다.' 
  })
  @ApiParam({
    name: 'missionCode',
    required: true,
    description: '미션 코드 (DIET, DAILY_MISSION, SUPPLEMENT 등)',
    example: 'DAILY_MISSION'
  })
  @ApiQuery({ 
    name: 'date', 
    required: true, 
    description: '조회할 날짜 (YYYY-MM-DD)', 
    example: '2025-06-30' 
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: '미션 상세 정보 조회 성공',
    type: ApiSuccessResponse
  })
  async getMissionDetail(
    @Param('missionCode') missionCode: string,
    @Req() req: any,
    @Query('date') date: string
  ): Promise<ApiSuccessResponse<MissionResponseDto>> {
    this.logger.log(`개별 미션 상세 조회 요청 - 미션 코드: ${missionCode}, 사용자: ${req.user.sub}, 날짜: ${date}`);

    // 날짜를 일차로 변환
    const day = await this.missionService.eventService.calculateEventDay(date);
    const dayMissions = await this.missionService.getDayMissions(req.user.sub, day);
    
    // 특정 미션 찾기
    const missionData = dayMissions.available.find(item => item.mission.code === missionCode);
    
    if (!missionData) {
      throw new NotFoundException(`미션을 찾을 수 없습니다: ${missionCode}`);
    }
    
    const mission = {
      id: missionData.mission.id,
      code: missionData.mission.code,
      name: missionData.mission.name,
      description: missionData.mission.description,
      points: missionData.eventMission.points,
      isCompleted: missionData.completed,
      completionData: missionData.completionData,
      requireUpload: missionData.mission.requireUpload,
      uploadType: missionData.mission.uploadType,
      category: missionData.mission.category,
      dailyLimit: missionData.mission.dailyLimit,
      sortOrder: missionData.mission.sortOrder,
    };

    return {
      success: true,
      message: '미션 상세 정보가 성공적으로 조회되었습니다.',
      data: mission,
      timestamp: new Date(),
    };
  }

  /**
   * 미션 완료 처리
   */
  @Post('complete')
  @ApiOperation({ 
    summary: '미션 완료', 
    description: '특정 미션을 완료 처리하고 포인트를 적립합니다.' 
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        missionCode: {
          type: 'string',
          description: '미션 코드',
          example: 'TEST_WATER'
        },
        date: {
          type: 'string',
          description: '완료 날짜 (YYYY-MM-DD)',
          example: '2025-07-31'
        },
        fileUploadId: {
          type: 'number',
          description: '업로드한 파일 ID (인증샷이 필요한 미션)',
          example: null,
          nullable: true
        }
      },
      required: ['missionCode', 'date']
    }
  })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: '미션 완료 성공',
    type: ApiSuccessResponse
  })
  async completeMission(
    @Req() req: any,
    @Body() body: { missionCode: string; date: string; fileUploadId?: number }
  ): Promise<ApiSuccessResponse<any>> {
    this.logger.log(`미션 완료 요청 - 사용자: ${req.user.sub}, 미션: ${body.missionCode}, 날짜: ${body.date}`);

    // 날짜를 일차로 변환
    const day = await this.missionService.eventService.calculateEventDay(body.date);
    
    // 미션 완료 처리
    const completion = await this.missionService.completeMission(
      req.user.sub,
      body.missionCode,
      day,
      body.fileUploadId
    );

    return {
      success: true,
      message: '미션이 완료되었습니다.',
      data: completion,
      timestamp: new Date(),
    };
  }

}