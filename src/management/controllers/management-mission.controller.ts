import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
  Logger,
  UseGuards,
  HttpStatus,
} from '@nestjs/common';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { MissionService } from '../../mission/mission.service';
import { MissionResponseDto } from '../../mission/dto/mission-response.dto';
import { ApiSuccessResponse, ApiResponseDto } from '../../common/dto/api-response.dto';

/**
 * Management 미션 관리 컨트롤러
 * 백오피스에서 미션을 관리하는 API
 */
@Controller('management/mission')
@UseGuards(ApiKeyGuard)
export class ManagementMissionController {
  private readonly logger = new Logger(ManagementMissionController.name);

  constructor(private readonly missionService: MissionService) {}

  /**
   * 모든 미션 목록 조회 (페이징 및 필터링)
   */
  @Get()
                      async getAllMissions(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('category') category?: string,
    @Query('isActive') isActive?: string,
    @Query('requireUpload') requireUpload?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ): Promise<ApiSuccessResponse<any>> {
    this.logger.log('전체 미션 목록 조회 요청');

    const pageNum = parseInt(page || '1', 10);
    const limitNum = parseInt(limit || '20', 10);

    // 필터 조건 구성
    const filters = {
      search,
      category,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      requireUpload: requireUpload === 'true' ? true : requireUpload === 'false' ? false : undefined,
    };

    // 정렬 조건
    const sort = {
      sortBy: sortBy || 'sortOrder',
      sortOrder: (sortOrder || 'asc') as 'asc' | 'desc',
    };

    const result = await this.missionService.getMissionsWithPagination(
      pageNum,
      limitNum,
      filters,
      sort,
    );
    
    // DTO 형식으로 변환
    const missionsDto = result.items.map(mission => ({
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
      sortOrder: mission.sortOrder,
    }));

    this.logger.log(`미션 목록 조회 성공 - 총 ${result.total}개, 페이지 ${result.page}/${result.totalPages}`);

    return {
      success: true,
      message: '전체 미션 목록이 성공적으로 조회되었습니다.',
      data: {
        ...result,
        items: missionsDto,
      },
      timestamp: new Date(),
    };
  }

  /**
   * 새로운 미션 생성
   */
  @Post()
        async createMission(
    @Body() createMissionDto: any,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`미션 생성 요청 - 이름: ${createMissionDto.name}`);

    try {
      const mission = await this.missionService.createMission(createMissionDto);
      
      this.logger.log(`미션 생성 성공 - ID: ${mission.id}`);
      
      return {
        success: true,
        message: '미션이 성공적으로 생성되었습니다.',
        data: mission,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`미션 생성 실패 - 이름: ${createMissionDto.name}`, error);
      throw error;
    }
  }

  /**
   * 미션 상세 조회
   */
  @Get(':id')
        async getMission(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`미션 상세 조회 요청 - ID: ${id}`);

    try {
      const mission = await this.missionService.getMissionById(id);
      
      this.logger.log(`미션 상세 조회 성공 - ID: ${id}`);
      
      return {
        success: true,
        message: '미션이 성공적으로 조회되었습니다.',
        data: mission,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`미션 상세 조회 실패 - ID: ${id}`, error);
      throw error;
    }
  }

  /**
   * 미션 수정
   */
  @Put(':id')
          async updateMission(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateMissionDto: any,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`미션 수정 요청 - ID: ${id}`);

    try {
      const mission = await this.missionService.updateMission(id, updateMissionDto);
      
      this.logger.log(`미션 수정 성공 - ID: ${id}`);
      
      return {
        success: true,
        message: '미션이 성공적으로 수정되었습니다.',
        data: mission,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`미션 수정 실패 - ID: ${id}`, error);
      throw error;
    }
  }

  /**
   * 미션 삭제
   */
  @Delete(':id')
        async deleteMission(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ApiResponseDto<null>> {
    this.logger.log(`미션 삭제 요청 - ID: ${id}`);

    try {
      await this.missionService.deleteMission(id);
      
      this.logger.log(`미션 삭제 성공 - ID: ${id}`);
      
      return {
        success: true,
        message: '미션이 성공적으로 삭제되었습니다.',
        data: null,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`미션 삭제 실패 - ID: ${id}`, error);
      throw error;
    }
  }

  /**
   * 미션 스케줄 조회
   */
  @Get(':id/schedules')
        async getMissionSchedules(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ApiResponseDto<any[]>> {
    this.logger.log(`미션 스케줄 조회 요청 - 미션 ID: ${id}`);

    try {
      const schedules = await this.missionService.getMissionSchedules(id);
      
      this.logger.log(`미션 스케줄 조회 성공 - 미션 ID: ${id}, 스케줄 수: ${schedules.length}`);
      
      return {
        success: true,
        message: '미션 스케줄이 성공적으로 조회되었습니다.',
        data: schedules,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`미션 스케줄 조회 실패 - 미션 ID: ${id}`, error);
      throw error;
    }
  }
}