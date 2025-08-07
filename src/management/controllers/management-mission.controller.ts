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
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiHeader,
  ApiBody,
  ApiParam,
  ApiQuery,
} from '@nestjs/swagger';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { MissionService } from '../../mission/mission.service';
import { MissionResponseDto } from '../../mission/dto/mission-response.dto';
import { ApiSuccessResponse, ApiResponseDto } from '../../common/dto/api-response.dto';

/**
 * Management 미션 관리 컨트롤러
 * 백오피스에서 미션을 관리하는 API
 */
@ApiTags('management-mission')
@Controller('management/mission')
@UseGuards(ApiKeyGuard)
@ApiHeader({
  name: 'X-API-KEY',
  description: 'API Key for authentication',
  required: true,
})
export class ManagementMissionController {
  private readonly logger = new Logger(ManagementMissionController.name);

  constructor(private readonly missionService: MissionService) {}

  /**
   * 모든 미션 목록 조회 (페이징 및 필터링)
   */
  @Get()
  @ApiOperation({
    summary: '전체 미션 목록 조회',
    description: '모든 미션 목록을 페이징 처리하여 조회합니다.',
  })
  @ApiQuery({ name: 'page', required: false, description: '페이지 번호 (기본값: 1)', example: 1 })
  @ApiQuery({ name: 'limit', required: false, description: '페이지당 항목 수 (기본값: 20)', example: 20 })
  @ApiQuery({ name: 'search', required: false, description: '검색어 (미션명, 설명, 코드)' })
  @ApiQuery({ name: 'category', required: false, description: '카테고리 필터' })
  @ApiQuery({ name: 'isActive', required: false, description: '활성화 상태', type: 'boolean' })
  @ApiQuery({ name: 'requireUpload', required: false, description: '업로드 필수 여부', type: 'boolean' })
  @ApiQuery({ name: 'sortBy', required: false, description: '정렬 기준', enum: ['createdAt', 'name', 'points', 'sortOrder'] })
  @ApiQuery({ name: 'sortOrder', required: false, description: '정렬 순서', enum: ['asc', 'desc'] })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '미션 목록 조회 성공',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            items: { type: 'array' },
            total: { type: 'number' },
            page: { type: 'number' },
            limit: { type: 'number' },
            totalPages: { type: 'number' },
          },
        },
        timestamp: { type: 'string' },
      },
    },
  })
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
  @ApiOperation({
    summary: '미션 생성',
    description: '새로운 미션을 생성합니다.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: '미션명',
          example: '데일리 운동',
        },
        code: {
          type: 'string',
          description: '미션 코드',
          example: 'DAILY_EXERCISE',
        },
        description: {
          type: 'string',
          description: '미션 설명',
          example: '매일 30분 이상 운동하기',
        },
        category: {
          type: 'string',
          description: '미션 카테고리',
          example: 'health',
        },
        type: {
          type: 'string',
          description: '미션 타입',
          enum: ['DAILY', 'WEEKLY', 'ONETIME', 'MILESTONE'],
          example: 'DAILY',
        },
        points: {
          type: 'number',
          description: '포인트',
          example: 100,
        },
        requireUpload: {
          type: 'boolean',
          description: '업로드 필수 여부',
          example: false,
        },
        uploadType: {
          type: 'string',
          description: '업로드 타입',
          example: 'image',
        },
        dailyLimit: {
          type: 'number',
          description: '일일 제한',
          example: 1,
        },
        sortOrder: {
          type: 'number',
          description: '정렬 순서',
          example: 1,
        },
        isActive: {
          type: 'boolean',
          description: '활성화 여부',
          example: true,
        },
        specificDay: {
          type: 'number',
          description: '특정 일차 (null이면 매일)',
          example: null,
          nullable: true,
        },
      },
      required: ['name', 'code'],
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: '미션 생성 성공',
  })
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
  @ApiOperation({
    summary: '미션 상세 조회',
    description: '특정 미션의 상세 정보를 조회합니다.',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: '미션 ID',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '미션 조회 성공',
  })
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
  @ApiOperation({
    summary: '미션 수정',
    description: '기존 미션을 수정합니다.',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: '미션 ID',
    example: 1,
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: {
          type: 'string',
          description: '미션명',
        },
        description: {
          type: 'string',
          description: '미션 설명',
        },
        points: {
          type: 'number',
          description: '포인트',
        },
        isActive: {
          type: 'boolean',
          description: '활성화 여부',
        },
        type: {
          type: 'string',
          description: '미션 타입',
          enum: ['DAILY', 'WEEKLY', 'ONETIME', 'MILESTONE'],
        },
        specificDay: {
          type: 'number',
          description: '특정 일차 (null이면 매일)',
          nullable: true,
        },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '미션 수정 성공',
  })
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
  @ApiOperation({
    summary: '미션 삭제',
    description: '미션을 삭제합니다.',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: '미션 ID',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '미션 삭제 성공',
  })
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
  @ApiOperation({
    summary: '미션 스케줄 조회',
    description: '특정 미션의 일별 스케줄을 조회합니다.',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: '미션 ID',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '미션 스케줄 조회 성공',
  })
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