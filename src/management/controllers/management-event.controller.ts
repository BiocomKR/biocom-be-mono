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
  HttpStatus,
  Logger,
  UseGuards,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiQuery,
  ApiHeader,
  ApiBody,
} from '@nestjs/swagger';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { EventService } from '../../event/event.service';
import { EventManagementService } from '../../event/event-management.service';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { EventType } from '../../event/event.types';

/**
 * Management 이벤트 관리 컨트롤러
 * 백오피스에서 이벤트와 관련 컨텐츠를 관리하는 API
 */
@ApiTags('management-event')
@Controller('management/event')
@UseGuards(ApiKeyGuard)
@ApiHeader({
  name: 'X-API-KEY',
  description: 'API Key for authentication',
  required: true,
})
export class ManagementEventController {
  private readonly logger = new Logger(ManagementEventController.name);

  constructor(
    private readonly eventService: EventService,
    private readonly eventManagementService: EventManagementService,
  ) {}

  // ==================== 이벤트 CRUD ====================

  /**
   * 모든 이벤트 기간 목록 조회 (페이징 및 필터링)
   */
  @Get('periods')
  @ApiOperation({
    summary: '이벤트 기간 목록 조회',
    description: '이벤트 기간 목록을 페이징 처리하여 조회합니다.',
  })
  @ApiQuery({
    name: 'page',
    required: false,
    description: '페이지 번호 (기본값: 1)',
    example: 1,
  })
  @ApiQuery({
    name: 'limit',
    required: false,
    description: '페이지당 항목 수 (기본값: 20)',
    example: 20,
  })
  @ApiQuery({
    name: 'search',
    required: false,
    description: '검색어 (이벤트명, 설명)',
  })
  @ApiQuery({
    name: 'type',
    required: false,
    description: '이벤트 타입',
    enum: ['CHALLENGE', 'PROMOTION', 'CAMPAIGN'],
  })
  @ApiQuery({
    name: 'isActive',
    required: false,
    description: '활성화 상태',
    type: 'boolean',
  })
  @ApiQuery({
    name: 'startDate',
    required: false,
    description: '시작일 이후 (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'endDate',
    required: false,
    description: '종료일 이전 (YYYY-MM-DD)',
  })
  @ApiQuery({
    name: 'sortBy',
    required: false,
    description: '정렬 기준',
    enum: ['createdAt', 'startDate', 'endDate', 'name'],
  })
  @ApiQuery({
    name: 'sortOrder',
    required: false,
    description: '정렬 순서',
    enum: ['asc', 'desc'],
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '이벤트 기간 목록 조회 성공',
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
  async getAllEvents(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('search') search?: string,
    @Query('type') type?: string,
    @Query('isActive') isActive?: string,
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log('이벤트 기간 목록 조회 요청');

    try {
      const pageNum = parseInt(page || '1', 10);
      const limitNum = parseInt(limit || '20', 10);

      // 필터 조건 구성
      const filters = {
        search,
        type,
        isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
        startDate,
        endDate,
      };

      // 정렬 조건
      const sort = {
        sortBy: sortBy || 'createdAt',
        sortOrder: (sortOrder || 'desc') as 'asc' | 'desc',
      };

      const result = await this.eventService.getEventsWithPagination(
        pageNum,
        limitNum,
        filters,
        sort,
      );
      
      this.logger.log(`이벤트 기간 목록 조회 성공 - 총 ${result.total}개, 페이지 ${result.page}/${result.totalPages}`);
      
      return {
        success: true,
        message: '이벤트 기간 목록이 성공적으로 조회되었습니다.',
        data: result,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('이벤트 기간 목록 조회 실패', error);
      throw error;
    }
  }

  /**
   * 새 이벤트 생성
   */
  @Post('periods')
  @ApiOperation({
    summary: '새 이벤트 생성',
    description: '새로운 이벤트 기간을 생성합니다.',
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '이벤트명' },
        startDate: { type: 'string', format: 'date', description: '시작일 (YYYY-MM-DD)' },
        totalDays: { type: 'number', description: '총 일수 (기본값: 21)' },
        description: { type: 'string', description: '이벤트 설명' },
        type: { type: 'string', enum: ['CHALLENGE', 'PROMOTION', 'CAMPAIGN'], description: '이벤트 타입' },
      },
      required: ['name', 'startDate'],
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: '이벤트 생성 성공',
  })
  async createEvent(
    @Body() createDto: {
      name: string;
      startDate: string;
      totalDays?: number;
      description?: string;
      type?: EventType;
    },
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`새 이벤트 생성 요청 - 이름: ${createDto.name}`);

    try {
      const period = await this.eventService.startNewEvent(createDto);
      
      this.logger.log(`새 이벤트 생성 성공 - ID: ${period.id}`);
      
      return {
        success: true,
        message: '새 이벤트가 성공적으로 생성되었습니다.',
        data: period,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('새 이벤트 생성 실패', error);
      throw error;
    }
  }

  /**
   * 특정 이벤트 기간 상세 조회
   */
  @Get('periods/:id')
  @ApiOperation({
    summary: '이벤트 기간 상세 조회',
    description: '특정 이벤트 기간의 상세 정보를 조회합니다.',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: '이벤트 기간 ID',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '이벤트 기간 조회 성공',
  })
  async getEvent(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`이벤트 기간 상세 조회 요청 - ID: ${id}`);

    try {
      const period = await this.eventService.getEventById(id);
      
      this.logger.log(`이벤트 기간 상세 조회 성공 - ID: ${id}`);
      
      return {
        success: true,
        message: '이벤트 기간이 성공적으로 조회되었습니다.',
        data: period,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`이벤트 기간 상세 조회 실패 - ID: ${id}`, error);
      throw error;
    }
  }

  /**
   * 이벤트 수정
   */
  @Put('periods/:id')
  @ApiOperation({
    summary: '이벤트 수정',
    description: '기존 이벤트 정보를 수정합니다.',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: '이벤트 기간 ID',
    example: 1,
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        name: { type: 'string', description: '이벤트명' },
        description: { type: 'string', description: '이벤트 설명' },
        startDate: { type: 'string', format: 'date', description: '시작일' },
        endDate: { type: 'string', format: 'date', description: '종료일' },
        isActive: { type: 'boolean', description: '활성화 여부' },
        type: { type: 'string', enum: ['CHALLENGE', 'PROMOTION', 'CAMPAIGN'], description: '이벤트 타입' },
      },
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '이벤트 수정 성공',
  })
  async updateEvent(
    @Param('id', ParseIntPipe) id: number,
    @Body() updateDto: any,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`이벤트 수정 요청 - ID: ${id}`);

    try {
      const updated = await this.eventService.updateEvent(id, updateDto);
      
      this.logger.log(`이벤트 수정 성공 - ID: ${id}`);
      
      return {
        success: true,
        message: '이벤트가 성공적으로 수정되었습니다.',
        data: updated,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`이벤트 수정 실패 - ID: ${id}`, error);
      throw error;
    }
  }

  /**
   * 이벤트 삭제
   */
  @Delete('periods/:id')
  @ApiOperation({
    summary: '이벤트 삭제',
    description: '이벤트를 삭제합니다. 참여자가 없는 경우에만 가능합니다.',
  })
  @ApiParam({
    name: 'id',
    type: 'number',
    description: '이벤트 기간 ID',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '이벤트 삭제 성공',
  })
  async deleteEvent(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ApiResponseDto<void>> {
    this.logger.log(`이벤트 삭제 요청 - ID: ${id}`);

    try {
      await this.eventService.deleteEvent(id);
      
      this.logger.log(`이벤트 삭제 성공 - ID: ${id}`);
      
      return {
        success: true,
        message: '이벤트가 성공적으로 삭제되었습니다.',
        data: null,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`이벤트 삭제 실패 - ID: ${id}`, error);
      throw error;
    }
  }

  /**
   * 현재 활성 이벤트 기간 조회
   */
  @Get('periods/active/current')
  @ApiOperation({
    summary: '현재 활성 이벤트 기간 조회',
    description: '현재 활성화된 이벤트 기간을 조회합니다.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '활성 이벤트 기간 조회 성공',
  })
  async getActiveEvent(): Promise<ApiResponseDto<any>> {
    this.logger.log('현재 활성 이벤트 기간 조회 요청');

    try {
      const period = await this.eventService.getActiveEvent();
      
      this.logger.log('현재 활성 이벤트 기간 조회 성공');
      
      return {
        success: true,
        message: '현재 활성 이벤트 기간이 성공적으로 조회되었습니다.',
        data: period,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('현재 활성 이벤트 기간 조회 실패', error);
      throw error;
    }
  }

  // ==================== 이벤트-미션 관계 관리 ====================

  /**
   * 이벤트에 미션 추가
   */
  @Post('periods/:periodId/missions')
  @ApiOperation({
    summary: '이벤트에 미션 추가',
    description: '특정 이벤트에 미션을 연결합니다.',
  })
  @ApiParam({
    name: 'periodId',
    type: 'number',
    description: '이벤트 기간 ID',
    example: 1,
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        missionId: { type: 'number', description: '미션 ID' },
        points: { type: 'number', description: '포인트 (선택적)' },
        activeFromDay: { type: 'number', description: '활성화 시작 일차' },
        activeToDay: { type: 'number', description: '활성화 종료 일차' },
        sortOrder: { type: 'number', description: '정렬 순서' },
      },
      required: ['missionId'],
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: '미션 연결 성공',
  })
  async attachMissionToEvent(
    @Param('periodId', ParseIntPipe) periodId: number,
    @Body() attachDto: any,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`이벤트에 미션 추가 요청 - 이벤트 ID: ${periodId}, 미션 ID: ${attachDto.missionId}`);

    try {
      const result = await this.eventManagementService.attachMissionToEvent(
        periodId,
        attachDto.missionId,
        {
          points: attachDto.points,
          activeFromDay: attachDto.activeFromDay,
          activeToDay: attachDto.activeToDay,
          sortOrder: attachDto.sortOrder,
        }
      );
      
      this.logger.log(`이벤트에 미션 추가 성공`);
      
      return {
        success: true,
        message: '미션이 이벤트에 성공적으로 연결되었습니다.',
        data: result,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('이벤트에 미션 추가 실패', error);
      throw error;
    }
  }

  /**
   * 이벤트에서 미션 제거
   */
  @Delete('periods/:periodId/missions/:missionId')
  @ApiOperation({
    summary: '이벤트에서 미션 제거',
    description: '특정 이벤트에서 미션 연결을 해제합니다.',
  })
  @ApiParam({
    name: 'periodId',
    type: 'number',
    description: '이벤트 기간 ID',
    example: 1,
  })
  @ApiParam({
    name: 'missionId',
    type: 'number',
    description: '미션 ID',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '미션 연결 해제 성공',
  })
  async detachMissionFromEvent(
    @Param('periodId', ParseIntPipe) periodId: number,
    @Param('missionId', ParseIntPipe) missionId: number,
  ): Promise<ApiResponseDto<void>> {
    this.logger.log(`이벤트에서 미션 제거 요청 - 이벤트 ID: ${periodId}, 미션 ID: ${missionId}`);

    try {
      await this.eventManagementService.detachMissionFromEvent(periodId, missionId);
      
      this.logger.log(`이벤트에서 미션 제거 성공`);
      
      return {
        success: true,
        message: '미션이 이벤트에서 성공적으로 제거되었습니다.',
        data: null,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('이벤트에서 미션 제거 실패', error);
      throw error;
    }
  }

  /**
   * 이벤트별 미션 목록 조회
   */
  @Get('periods/:periodId/missions')
  @ApiOperation({
    summary: '이벤트별 미션 목록 조회',
    description: '특정 이벤트 기간의 미션 목록을 조회합니다.',
  })
  @ApiParam({
    name: 'periodId',
    type: 'number',
    description: '이벤트 기간 ID',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '이벤트 미션 목록 조회 성공',
  })
  async getEventMissions(
    @Param('periodId', ParseIntPipe) periodId: number,
  ): Promise<ApiResponseDto<any[]>> {
    this.logger.log(`이벤트별 미션 목록 조회 요청 - 이벤트 ID: ${periodId}`);

    try {
      const missions = await this.eventManagementService.getEventMissions(periodId);
      
      this.logger.log(`이벤트별 미션 목록 조회 성공 - 이벤트 ID: ${periodId}, 미션 수: ${missions.length}`);
      
      return {
        success: true,
        message: '이벤트 미션 목록이 성공적으로 조회되었습니다.',
        data: missions,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`이벤트별 미션 목록 조회 실패 - 이벤트 ID: ${periodId}`, error);
      throw error;
    }
  }

  // ==================== 이벤트-퀴즈 관계 관리 ====================

  /**
   * 이벤트에 퀴즈 연결
   */
  @Post('periods/:periodId/quizzes')
  @ApiOperation({
    summary: '이벤트에 퀴즈 연결',
    description: '특정 이벤트의 특정 일차에 퀴즈를 연결합니다.',
  })
  @ApiParam({
    name: 'periodId',
    type: 'number',
    description: '이벤트 기간 ID',
    example: 1,
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        quizId: { type: 'number', description: '퀴즈 ID' },
        day: { type: 'number', description: '퀴즈 출제 일차' },
        sortOrder: { type: 'number', description: '정렬 순서', default: 0 },
      },
      required: ['quizId', 'day'],
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: '퀴즈 연결 성공',
  })
  async attachQuizToEvent(
    @Param('periodId', ParseIntPipe) periodId: number,
    @Body() attachQuizDto: any,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`이벤트에 퀴즈 연결 요청 - 이벤트 ID: ${periodId}, 퀴즈 ID: ${attachQuizDto.quizId}, 일차: ${attachQuizDto.day}`);

    try {
      const eventQuiz = await this.eventManagementService.attachQuizToEvent(
        periodId,
        attachQuizDto.quizId,
        attachQuizDto.day,
        attachQuizDto.sortOrder || 0
      );
      
      this.logger.log(`이벤트에 퀴즈 연결 성공 - EventQuiz ID: ${eventQuiz.id}`);
      
      return {
        success: true,
        message: '퀴즈가 이벤트에 성공적으로 연결되었습니다.',
        data: eventQuiz,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('이벤트에 퀴즈 연결 실패', error);
      throw error;
    }
  }

  /**
   * 이벤트에서 퀴즈 연결 해제
   */
  @Delete('periods/:periodId/quizzes/:quizId')
  @ApiOperation({
    summary: '이벤트에서 퀴즈 연결 해제',
    description: '특정 이벤트에서 퀴즈 연결을 해제합니다.',
  })
  @ApiParam({
    name: 'periodId',
    type: 'number',
    description: '이벤트 기간 ID',
    example: 1,
  })
  @ApiParam({
    name: 'quizId',
    type: 'number',
    description: '퀴즈 ID',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '퀴즈 연결 해제 성공',
  })
  async detachQuizFromEvent(
    @Param('periodId', ParseIntPipe) periodId: number,
    @Param('quizId', ParseIntPipe) quizId: number,
  ): Promise<ApiResponseDto<void>> {
    this.logger.log(`이벤트에서 퀴즈 연결 해제 요청 - 이벤트 ID: ${periodId}, 퀴즈 ID: ${quizId}`);

    try {
      await this.eventManagementService.detachQuizFromEvent(periodId, quizId);
      
      this.logger.log(`이벤트에서 퀴즈 연결 해제 성공`);
      
      return {
        success: true,
        message: '퀴즈 연결이 성공적으로 해제되었습니다.',
        data: null,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('이벤트에서 퀴즈 연결 해제 실패', error);
      throw error;
    }
  }

  /**
   * 이벤트별 퀴즈 목록 조회
   */
  @Get('periods/:periodId/quizzes')
  @ApiOperation({
    summary: '이벤트별 퀴즈 목록 조회',
    description: '특정 이벤트 기간의 퀴즈 목록을 조회합니다.',
  })
  @ApiParam({
    name: 'periodId',
    type: 'number',
    description: '이벤트 기간 ID',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '이벤트 퀴즈 목록 조회 성공',
  })
  async getEventQuizzes(
    @Param('periodId', ParseIntPipe) periodId: number,
  ): Promise<ApiResponseDto<any[]>> {
    this.logger.log(`이벤트별 퀴즈 목록 조회 요청 - 이벤트 ID: ${periodId}`);

    try {
      const quizzes = await this.eventManagementService.getEventQuizzes(periodId);
      
      this.logger.log(`이벤트별 퀴즈 목록 조회 성공 - 이벤트 ID: ${periodId}, 퀴즈 수: ${quizzes.length}`);
      
      return {
        success: true,
        message: '이벤트 퀴즈 목록이 성공적으로 조회되었습니다.',
        data: quizzes,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`이벤트별 퀴즈 목록 조회 실패 - 이벤트 ID: ${periodId}`, error);
      throw error;
    }
  }

  // ==================== 이벤트-설문 관계 관리 ====================

  /**
   * 이벤트에 설문 연결
   */
  @Post('periods/:periodId/surveys')
  @ApiOperation({
    summary: '이벤트에 설문 연결',
    description: '특정 이벤트에 설문을 연결합니다.',
  })
  @ApiParam({
    name: 'periodId',
    type: 'number',
    description: '이벤트 기간 ID',
    example: 1,
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        surveyId: { type: 'number', description: '설문 ID' },
        type: { type: 'string', enum: ['before', 'after'], description: '설문 타입' },
        fromDay: { type: 'number', description: '설문 시작 일차' },
      },
      required: ['surveyId', 'type'],
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: '설문 연결 성공',
  })
  async attachSurveyToEvent(
    @Param('periodId', ParseIntPipe) periodId: number,
    @Body() attachDto: any,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`이벤트에 설문 연결 요청 - 이벤트 ID: ${periodId}, 설문 ID: ${attachDto.surveyId}`);

    try {
      const result = await this.eventManagementService.attachSurveyToEvent(
        periodId,
        attachDto.surveyId,
        {
          type: attachDto.type,
          fromDay: attachDto.fromDay,
        }
      );
      
      this.logger.log(`이벤트에 설문 연결 성공`);
      
      return {
        success: true,
        message: '설문이 이벤트에 성공적으로 연결되었습니다.',
        data: result,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('이벤트에 설문 연결 실패', error);
      throw error;
    }
  }

  /**
   * 이벤트에서 설문 연결 해제
   */
  @Delete('periods/:periodId/surveys/:surveyId')
  @ApiOperation({
    summary: '이벤트에서 설문 연결 해제',
    description: '특정 이벤트에서 설문 연결을 해제합니다.',
  })
  @ApiParam({
    name: 'periodId',
    type: 'number',
    description: '이벤트 기간 ID',
    example: 1,
  })
  @ApiParam({
    name: 'surveyId',
    type: 'number',
    description: '설문 ID',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '설문 연결 해제 성공',
  })
  async detachSurveyFromEvent(
    @Param('periodId', ParseIntPipe) periodId: number,
    @Param('surveyId', ParseIntPipe) surveyId: number,
  ): Promise<ApiResponseDto<void>> {
    this.logger.log(`이벤트에서 설문 연결 해제 요청 - 이벤트 ID: ${periodId}, 설문 ID: ${surveyId}`);

    try {
      await this.eventManagementService.detachSurveyFromEvent(periodId, surveyId);
      
      this.logger.log(`이벤트에서 설문 연결 해제 성공`);
      
      return {
        success: true,
        message: '설문이 이벤트에서 성공적으로 제거되었습니다.',
        data: null,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('이벤트에서 설문 연결 해제 실패', error);
      throw error;
    }
  }

  /**
   * 이벤트별 설문 목록 조회
   */
  @Get('periods/:periodId/surveys')
  @ApiOperation({
    summary: '이벤트별 설문 목록 조회',
    description: '특정 이벤트 기간의 설문 목록을 조회합니다.',
  })
  @ApiParam({
    name: 'periodId',
    type: 'number',
    description: '이벤트 기간 ID',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '이벤트 설문 목록 조회 성공',
  })
  async getEventSurveys(
    @Param('periodId', ParseIntPipe) periodId: number,
  ): Promise<ApiResponseDto<any[]>> {
    this.logger.log(`이벤트별 설문 목록 조회 요청 - 이벤트 ID: ${periodId}`);

    try {
      const surveys = await this.eventManagementService.getEventSurveys(periodId);
      
      this.logger.log(`이벤트별 설문 목록 조회 성공 - 이벤트 ID: ${periodId}, 설문 수: ${surveys.length}`);
      
      return {
        success: true,
        message: '이벤트 설문 목록이 성공적으로 조회되었습니다.',
        data: surveys,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`이벤트별 설문 목록 조회 실패 - 이벤트 ID: ${periodId}`, error);
      throw error;
    }
  }

  // ==================== 이벤트-컨텐츠 관계 관리 ====================

  /**
   * 이벤트에 컨텐츠 연결
   */
  @Post('periods/:periodId/contents')
  @ApiOperation({
    summary: '이벤트에 컨텐츠 연결',
    description: '특정 이벤트의 특정 일차에 컨텐츠를 연결합니다.',
  })
  @ApiParam({
    name: 'periodId',
    type: 'number',
    description: '이벤트 기간 ID',
    example: 1,
  })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        contentId: { type: 'number', description: '컨텐츠 ID' },
        day: { type: 'number', description: '표시할 일차' },
      },
      required: ['contentId', 'day'],
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: '컨텐츠 연결 성공',
  })
  async attachContentToEvent(
    @Param('periodId', ParseIntPipe) periodId: number,
    @Body() attachDto: any,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`이벤트에 컨텐츠 연결 요청 - 이벤트 ID: ${periodId}, 컨텐츠 ID: ${attachDto.contentId}, 일차: ${attachDto.day}`);

    try {
      const result = await this.eventManagementService.attachContentToEvent(
        periodId,
        attachDto.contentId,
        attachDto.day
      );
      
      this.logger.log(`이벤트에 컨텐츠 연결 성공`);
      
      return {
        success: true,
        message: '컨텐츠가 이벤트에 성공적으로 연결되었습니다.',
        data: result,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('이벤트에 컨텐츠 연결 실패', error);
      throw error;
    }
  }

  /**
   * 이벤트에서 컨텐츠 연결 해제
   */
  @Delete('periods/:periodId/contents/:contentId')
  @ApiOperation({
    summary: '이벤트에서 컨텐츠 연결 해제',
    description: '특정 이벤트에서 컨텐츠 연결을 해제합니다.',
  })
  @ApiParam({
    name: 'periodId',
    type: 'number',
    description: '이벤트 기간 ID',
    example: 1,
  })
  @ApiParam({
    name: 'contentId',
    type: 'number',
    description: '컨텐츠 ID',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '컨텐츠 연결 해제 성공',
  })
  async detachContentFromEvent(
    @Param('periodId', ParseIntPipe) periodId: number,
    @Param('contentId', ParseIntPipe) contentId: number,
  ): Promise<ApiResponseDto<void>> {
    this.logger.log(`이벤트에서 컨텐츠 연결 해제 요청 - 이벤트 ID: ${periodId}, 컨텐츠 ID: ${contentId}`);

    try {
      await this.eventManagementService.detachContentFromEvent(periodId, contentId);
      
      this.logger.log(`이벤트에서 컨텐츠 연결 해제 성공`);
      
      return {
        success: true,
        message: '컨텐츠가 이벤트에서 성공적으로 제거되었습니다.',
        data: null,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('이벤트에서 컨텐츠 연결 해제 실패', error);
      throw error;
    }
  }

  /**
   * 이벤트별 컨텐츠 목록 조회
   */
  @Get('periods/:periodId/contents')
  @ApiOperation({
    summary: '이벤트별 컨텐츠 목록 조회',
    description: '특정 이벤트 기간의 컨텐츠 목록을 조회합니다.',
  })
  @ApiParam({
    name: 'periodId',
    type: 'number',
    description: '이벤트 기간 ID',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '이벤트 컨텐츠 목록 조회 성공',
  })
  async getEventContents(
    @Param('periodId', ParseIntPipe) periodId: number,
  ): Promise<ApiResponseDto<any[]>> {
    this.logger.log(`이벤트별 컨텐츠 목록 조회 요청 - 이벤트 ID: ${periodId}`);

    try {
      const contents = await this.eventManagementService.getEventContents(periodId);
      
      this.logger.log(`이벤트별 컨텐츠 목록 조회 성공 - 이벤트 ID: ${periodId}, 컨텐츠 수: ${contents.length}`);
      
      return {
        success: true,
        message: '이벤트 컨텐츠 목록이 성공적으로 조회되었습니다.',
        data: contents,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`이벤트별 컨텐츠 목록 조회 실패 - 이벤트 ID: ${periodId}`, error);
      throw error;
    }
  }

  // ==================== 이벤트 통계 및 참여자 관리 ====================

  /**
   * 이벤트 참여 사용자 목록 조회
   */
  @Get('periods/:periodId/users')
  @ApiOperation({
    summary: '이벤트 참여 사용자 목록 조회',
    description: '특정 이벤트에 참여한 사용자 목록을 조회합니다.',
  })
  @ApiParam({
    name: 'periodId',
    type: 'number',
    description: '이벤트 기간 ID',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '이벤트 참여 사용자 목록 조회 성공',
  })
  async getEventUsers(
    @Param('periodId', ParseIntPipe) periodId: number,
  ): Promise<ApiResponseDto<any[]>> {
    this.logger.log(`이벤트 참여 사용자 목록 조회 요청 - 이벤트 ID: ${periodId}`);

    try {
      const users = await this.eventManagementService.getEventUsers(periodId);
      
      this.logger.log(`이벤트 참여 사용자 목록 조회 성공 - 이벤트 ID: ${periodId}, 사용자 수: ${users.length}`);
      
      return {
        success: true,
        message: '이벤트 참여 사용자 목록이 성공적으로 조회되었습니다.',
        data: users,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`이벤트 참여 사용자 목록 조회 실패 - 이벤트 ID: ${periodId}`, error);
      throw error;
    }
  }

  /**
   * 이벤트 통계 조회
   */
  @Get('periods/:periodId/statistics')
  @ApiOperation({
    summary: '이벤트 통계 조회',
    description: '특정 이벤트의 참여율, 완료율 등 통계를 조회합니다.',
  })
  @ApiParam({
    name: 'periodId',
    type: 'number',
    description: '이벤트 기간 ID',
    example: 1,
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '이벤트 통계 조회 성공',
  })
  async getEventStatistics(
    @Param('periodId', ParseIntPipe) periodId: number,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`이벤트 통계 조회 요청 - 이벤트 ID: ${periodId}`);

    try {
      const statistics = await this.eventManagementService.getEventStatistics(periodId);
      
      this.logger.log(`이벤트 통계 조회 성공 - 이벤트 ID: ${periodId}`);
      
      return {
        success: true,
        message: '이벤트 통계가 성공적으로 조회되었습니다.',
        data: statistics,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`이벤트 통계 조회 실패 - 이벤트 ID: ${periodId}`, error);
      throw error;
    }
  }
}