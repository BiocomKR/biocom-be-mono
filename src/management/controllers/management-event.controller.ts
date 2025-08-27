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
import { ApiKeyGuard } from '../guards/api-key.guard';
import { EventService } from '../../event/event.service';
import { EventManagementService } from '../../event/event-management.service';
import { ApiResponseDto } from '../../common/dto/api-response.dto';
import { EventType } from '../../event/event.types';

/**
 * Management 이벤트 관리 컨트롤러
 * 백오피스에서 이벤트와 관련 컨텐츠를 관리하는 API
 */
@Controller('management/events')
@UseGuards(ApiKeyGuard)
export class ManagementEventController {
  private readonly logger = new Logger(ManagementEventController.name);

  constructor(
    private readonly eventService: EventService,
    private readonly eventManagementService: EventManagementService,
  ) {}

  // ==================== 이벤트 CRUD ====================

  /**
   * 모든 이벤트 목록 조회 (페이징 및 필터링)
   */
  @Get()
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
    this.logger.log('이벤트 목록 조회 요청');

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
      
      this.logger.log(`이벤트 목록 조회 성공 - 총 ${result.total}개, 페이지 ${result.page}/${result.totalPages}`);
      
      return {
        success: true,
        message: '이벤트 목록이 성공적으로 조회되었습니다.',
        data: result,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('이벤트 목록 조회 실패', error);
      throw error;
    }
  }

  /**
   * 새 이벤트 생성
   */
  @Post()
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
      const event = await this.eventService.startNewEvent(createDto);
      
      this.logger.log(`새 이벤트 생성 성공 - ID: ${event.id}`);
      
      return {
        success: true,
        message: '새 이벤트가 성공적으로 생성되었습니다.',
        data: event,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('새 이벤트 생성 실패', error);
      throw error;
    }
  }

  /**
   * 특정 이벤트 상세 조회
   */
  @Get(':eventId')
        async getEvent(
    @Param('eventId', ParseIntPipe) eventId: number,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`이벤트 상세 조회 요청 - ID: ${eventId}`);

    try {
      const event = await this.eventService.getEventById(eventId);
      
      this.logger.log(`이벤트 상세 조회 성공 - ID: ${eventId}`);
      
      return {
        success: true,
        message: '이벤트가 성공적으로 조회되었습니다.',
        data: event,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`이벤트 상세 조회 실패 - ID: ${eventId}`, error);
      throw error;
    }
  }

  /**
   * 이벤트 수정
   */
  @Put(':eventId')
          async updateEvent(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() updateDto: any,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`이벤트 수정 요청 - ID: ${eventId}`);

    try {
      const updated = await this.eventService.updateEvent(eventId, updateDto);
      
      this.logger.log(`이벤트 수정 성공 - ID: ${eventId}`);
      
      return {
        success: true,
        message: '이벤트가 성공적으로 수정되었습니다.',
        data: updated,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`이벤트 수정 실패 - ID: ${eventId}`, error);
      throw error;
    }
  }

  /**
   * 이벤트 삭제
   */
  @Delete(':eventId')
        async deleteEvent(
    @Param('eventId', ParseIntPipe) eventId: number,
  ): Promise<ApiResponseDto<void>> {
    this.logger.log(`이벤트 삭제 요청 - ID: ${eventId}`);

    try {
      await this.eventService.deleteEvent(eventId);
      
      this.logger.log(`이벤트 삭제 성공 - ID: ${eventId}`);
      
      return {
        success: true,
        message: '이벤트가 성공적으로 삭제되었습니다.',
        data: null,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`이벤트 삭제 실패 - ID: ${eventId}`, error);
      throw error;
    }
  }

  /**
   * 현재 활성 이벤트 조회
   */
  @Get('active/current')
      async getActiveEvent(): Promise<ApiResponseDto<any>> {
    this.logger.log('현재 활성 이벤트 조회 요청');

    try {
      const event = await this.eventService.getActiveEvent();
      
      this.logger.log('현재 활성 이벤트 조회 성공');
      
      return {
        success: true,
        message: '현재 활성 이벤트가 성공적으로 조회되었습니다.',
        data: event,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('현재 활성 이벤트 조회 실패', error);
      throw error;
    }
  }

  // ==================== 이벤트-미션 관계 관리 ====================

  /**
   * 이벤트에 미션 추가
   */
  @Post(':eventId/missions')
          async attachMissionToEvent(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() attachDto: any,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`이벤트에 미션 추가 요청 - 이벤트 ID: ${eventId}, 미션 ID: ${attachDto.missionId}`);

    try {
      const result = await this.eventManagementService.attachMissionToEvent(
        eventId,
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
  @Delete(':eventId/missions/:missionId')
          async detachMissionFromEvent(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Param('missionId', ParseIntPipe) missionId: number,
  ): Promise<ApiResponseDto<void>> {
    this.logger.log(`이벤트에서 미션 제거 요청 - 이벤트 ID: ${eventId}, 미션 ID: ${missionId}`);

    try {
      await this.eventManagementService.detachMissionFromEvent(eventId, missionId);
      
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
  @Get(':eventId/missions')
        async getEventMissions(
    @Param('eventId', ParseIntPipe) eventId: number,
  ): Promise<ApiResponseDto<any[]>> {
    this.logger.log(`이벤트별 미션 목록 조회 요청 - 이벤트 ID: ${eventId}`);

    try {
      const missions = await this.eventManagementService.getEventMissions(eventId);
      
      this.logger.log(`이벤트별 미션 목록 조회 성공 - 이벤트 ID: ${eventId}, 미션 수: ${missions.length}`);
      
      return {
        success: true,
        message: '이벤트 미션 목록이 성공적으로 조회되었습니다.',
        data: missions,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`이벤트별 미션 목록 조회 실패 - 이벤트 ID: ${eventId}`, error);
      throw error;
    }
  }

  // ==================== 이벤트-퀴즈 관계 관리 ====================

  /**
   * 이벤트에 퀴즈 연결
   */
  @Post(':eventId/quizzes')
          async attachQuizToEvent(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() attachQuizDto: any,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`이벤트에 퀴즈 연결 요청 - 이벤트 ID: ${eventId}, 퀴즈 ID: ${attachQuizDto.quizId}, 일차: ${attachQuizDto.day}`);

    try {
      const eventQuiz = await this.eventManagementService.attachQuizToEvent(
        eventId,
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
  @Delete(':eventId/quizzes/:quizId')
          async detachQuizFromEvent(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Param('quizId', ParseIntPipe) quizId: number,
  ): Promise<ApiResponseDto<void>> {
    this.logger.log(`이벤트에서 퀴즈 연결 해제 요청 - 이벤트 ID: ${eventId}, 퀴즈 ID: ${quizId}`);

    try {
      await this.eventManagementService.detachQuizFromEvent(eventId, quizId);
      
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
  @Get(':eventId/quizzes')
        async getEventQuizzes(
    @Param('eventId', ParseIntPipe) eventId: number,
  ): Promise<ApiResponseDto<any[]>> {
    this.logger.log(`이벤트별 퀴즈 목록 조회 요청 - 이벤트 ID: ${eventId}`);

    try {
      const quizzes = await this.eventManagementService.getEventQuizzes(eventId);
      
      this.logger.log(`이벤트별 퀴즈 목록 조회 성공 - 이벤트 ID: ${eventId}, 퀴즈 수: ${quizzes.length}`);
      
      return {
        success: true,
        message: '이벤트 퀴즈 목록이 성공적으로 조회되었습니다.',
        data: quizzes,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`이벤트별 퀴즈 목록 조회 실패 - 이벤트 ID: ${eventId}`, error);
      throw error;
    }
  }

  // ==================== 이벤트-설문 관계 관리 ====================

  /**
   * 이벤트에 설문 연결
   */
  @Post(':eventId/surveys')
          async attachSurveyToEvent(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() attachDto: any,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`이벤트에 설문 연결 요청 - 이벤트 ID: ${eventId}, 설문 ID: ${attachDto.surveyId}`);

    try {
      const result = await this.eventManagementService.attachSurveyToEvent(
        eventId,
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
  @Delete(':eventId/surveys/:surveyId')
          async detachSurveyFromEvent(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Param('surveyId', ParseIntPipe) surveyId: number,
  ): Promise<ApiResponseDto<void>> {
    this.logger.log(`이벤트에서 설문 연결 해제 요청 - 이벤트 ID: ${eventId}, 설문 ID: ${surveyId}`);

    try {
      await this.eventManagementService.detachSurveyFromEvent(eventId, surveyId);
      
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
  @Get(':eventId/surveys')
        async getEventSurveys(
    @Param('eventId', ParseIntPipe) eventId: number,
  ): Promise<ApiResponseDto<any[]>> {
    this.logger.log(`이벤트별 설문 목록 조회 요청 - 이벤트 ID: ${eventId}`);

    try {
      const surveys = await this.eventManagementService.getEventSurveys(eventId);
      
      this.logger.log(`이벤트별 설문 목록 조회 성공 - 이벤트 ID: ${eventId}, 설문 수: ${surveys.length}`);
      
      return {
        success: true,
        message: '이벤트 설문 목록이 성공적으로 조회되었습니다.',
        data: surveys,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`이벤트별 설문 목록 조회 실패 - 이벤트 ID: ${eventId}`, error);
      throw error;
    }
  }

  // ==================== 이벤트-컨텐츠 관계 관리 ====================

  /**
   * 이벤트에 컨텐츠 연결
   */
  @Post(':eventId/contents')
          async attachContentToEvent(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Body() attachDto: any,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`이벤트에 컨텐츠 연결 요청 - 이벤트 ID: ${eventId}, 컨텐츠 ID: ${attachDto.contentId}, 일차: ${attachDto.day}`);

    try {
      const result = await this.eventManagementService.attachContentToEvent(
        eventId,
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
  @Delete(':eventId/contents/:contentId')
          async detachContentFromEvent(
    @Param('eventId', ParseIntPipe) eventId: number,
    @Param('contentId', ParseIntPipe) contentId: number,
  ): Promise<ApiResponseDto<void>> {
    this.logger.log(`이벤트에서 컨텐츠 연결 해제 요청 - 이벤트 ID: ${eventId}, 컨텐츠 ID: ${contentId}`);

    try {
      await this.eventManagementService.detachContentFromEvent(eventId, contentId);
      
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
  @Get(':eventId/contents')
        async getEventContents(
    @Param('eventId', ParseIntPipe) eventId: number,
  ): Promise<ApiResponseDto<any[]>> {
    this.logger.log(`이벤트별 컨텐츠 목록 조회 요청 - 이벤트 ID: ${eventId}`);

    try {
      const contents = await this.eventManagementService.getEventContents(eventId);
      
      this.logger.log(`이벤트별 컨텐츠 목록 조회 성공 - 이벤트 ID: ${eventId}, 컨텐츠 수: ${contents.length}`);
      
      return {
        success: true,
        message: '이벤트 컨텐츠 목록이 성공적으로 조회되었습니다.',
        data: contents,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`이벤트별 컨텐츠 목록 조회 실패 - 이벤트 ID: ${eventId}`, error);
      throw error;
    }
  }

  // ==================== 이벤트 통계 및 참여자 관리 ====================

  /**
   * 이벤트 참여 사용자 목록 조회
   */
  @Get(':eventId/users')
        async getEventUsers(
    @Param('eventId', ParseIntPipe) eventId: number,
  ): Promise<ApiResponseDto<any[]>> {
    this.logger.log(`이벤트 참여 사용자 목록 조회 요청 - 이벤트 ID: ${eventId}`);

    try {
      const users = await this.eventManagementService.getEventUsers(eventId);
      
      this.logger.log(`이벤트 참여 사용자 목록 조회 성공 - 이벤트 ID: ${eventId}, 사용자 수: ${users.length}`);
      
      return {
        success: true,
        message: '이벤트 참여 사용자 목록이 성공적으로 조회되었습니다.',
        data: users,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`이벤트 참여 사용자 목록 조회 실패 - 이벤트 ID: ${eventId}`, error);
      throw error;
    }
  }

  /**
   * 이벤트 통계 조회
   */
  @Get(':eventId/statistics')
        async getEventStatistics(
    @Param('eventId', ParseIntPipe) eventId: number,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`이벤트 통계 조회 요청 - 이벤트 ID: ${eventId}`);

    try {
      const statistics = await this.eventManagementService.getEventStatistics(eventId);
      
      this.logger.log(`이벤트 통계 조회 성공 - 이벤트 ID: ${eventId}`);
      
      return {
        success: true,
        message: '이벤트 통계가 성공적으로 조회되었습니다.',
        data: statistics,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`이벤트 통계 조회 실패 - 이벤트 ID: ${eventId}`, error);
      throw error;
    }
  }
}