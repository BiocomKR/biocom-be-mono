import { 
  Controller, 
  Get, 
  UseGuards,
  Logger,
  Query,
  Param,
  ParseIntPipe,
  NotFoundException
} from '@nestjs/common';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiBearerAuth,
  ApiQuery,
  ApiParam
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { EventService } from './event.service';
import { ApiResponseDto } from '../common/dto/api-response.dto';

/**
 * 이벤트 컨트롤러
 * 일반 사용자용 이벤트 정보 조회 API
 */
@ApiTags('챌린지-event')
@Controller('event')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth('access-token')
export class EventController {
  private readonly logger = new Logger(EventController.name);

  constructor(
    private readonly eventService: EventService,
  ) {}

  /**
   * 현재 활성 이벤트 목록 조회
   */
  @Get('active')
  @ApiOperation({ 
    summary: '현재 활성 이벤트 목록 조회', 
    description: '현재 진행 중인 모든 이벤트 정보와 각 이벤트의 진행 상황을 조회합니다.' 
  })
  @ApiResponse({ 
    status: 200, 
    description: '이벤트 목록 조회 성공',
    schema: {
      example: {
        success: true,
        message: '현재 활성 이벤트를 조회했습니다.',
        data: {
          events: [
            {
              id: 1,
              name: '2025년 1월 건강 챌린지',
              description: '21일간 건강한 습관 만들기',
              startDate: '2025-07-31T00:00:00.000Z',
              endDate: '2025-08-20T00:00:00.000Z',
              totalDays: 21,
              type: 'CHALLENGE',
              progress: {
                date: '2025-08-01',
                day: 2,
                isActive: true,
                daysRemaining: 20,
                progressPercentage: 5
              }
            },
            {
              id: 2,
              name: '신년 프로모션 이벤트',
              description: '새해 맞이 특별 이벤트',
              startDate: '2025-08-01T00:00:00.000Z',
              endDate: '2025-08-14T00:00:00.000Z',
              totalDays: 14,
              type: 'PROMOTION',
              progress: {
                date: '2025-08-01',
                day: 1,
                isActive: true,
                daysRemaining: 14,
                progressPercentage: 0
              }
            }
          ],
          total: 2
        },
        timestamp: '2025-08-01T00:00:00.000Z'
      }
    }
  })
  @ApiResponse({ 
    status: 404, 
    description: '활성화된 이벤트가 없습니다.' 
  })
  async getCurrentEvents(): Promise<ApiResponseDto<any>> {
    this.logger.log('현재 활성 이벤트 목록 조회 요청');

    try {
      const events = await this.eventService.getAllActiveEvents();
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const result = await Promise.all(events.map(async (event) => {
        let currentDay = 0;
        let isActive = false;
        let daysRemaining = 0;
        let progressPercentage = 0;

        try {
          // 각 이벤트의 진행 상황 계산
          const diffTime = today.getTime() - event.startDate.getTime();
          const daysDiff = Math.floor(diffTime / (1000 * 60 * 60 * 24)) + 1;
          
          if (daysDiff > 0 && daysDiff <= event.totalDays) {
            currentDay = daysDiff;
            isActive = true;
            daysRemaining = event.totalDays - currentDay + 1;
            progressPercentage = Math.round((currentDay / event.totalDays) * 100);
          } else if (daysDiff <= 0) {
            // 이벤트 시작 전
            isActive = false;
            daysRemaining = event.totalDays;
          }
        } catch (error) {
          this.logger.warn(`이벤트 ${event.id} 진행 상황 계산 실패`, error);
        }

        return {
          id: event.id,
          name: event.name,
          description: event.description,
          startDate: event.startDate,
          endDate: event.endDate,
          totalDays: event.totalDays,
          type: event.type,
          progress: {
            date: today,
            day: currentDay,
            isActive,
            daysRemaining,
            progressPercentage
          }
        };
      }));

      this.logger.log(`현재 활성 이벤트 ${result.length}개 조회 성공`);

      return {
        success: true,
        message: '현재 활성 이벤트를 조회했습니다.',
        data: {
          events: result,
          total: result.length
        },
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('현재 활성 이벤트 조회 실패', error);
      throw error;
    }
  }


  /**
   * 특정 이벤트 상세 정보 조회 (미션, 설문, 퀴즈 포함)
   */
  @Get('active/:eventId')
  @ApiOperation({ 
    summary: '특정 이벤트 상세 정보 조회', 
    description: '특정 이벤트의 모든 컨텐츠(미션, 설문, 퀴즈) 정보를 조회합니다.' 
  })
  @ApiParam({
    name: 'eventId',
    type: 'number',
    description: '이벤트 ID',
    example: 1
  })
  @ApiResponse({ 
    status: 200, 
    description: '이벤트 상세 정보 조회 성공',
    schema: {
      example: {
        success: true,
        message: '이벤트 상세 정보를 조회했습니다.',
        data: {
          event: {
            id: 1,
            name: '2025년 1월 건강 챌린지',
            description: '21일간 건강한 습관 만들기',
            startDate: '2025-07-31T00:00:00.000Z',
            endDate: '2025-08-20T00:00:00.000Z',
            totalDays: 21,
            type: 'CHALLENGE'
          },
          contents: {
            missions: {
              total: 5,
              dailyMissions: 3,
              eventMissions: 2
            },
            surveys: {
              total: 2,
              items: [
                {
                  surveyId: 1,
                  type: 'before',
                  fromDay: 1,
                  toDay: 5,
                  questions: [
                    {
                      id: 1,
                      category: '피부건강',
                      questionText: '피부가 건조한가요?',
                      sortOrder: 1,
                      categoryCode: 'SKIN'
                    },
                    {
                      id: 2,
                      category: '신진대사',
                      questionText: '체중 변화가 있나요?',
                      sortOrder: 2,
                      categoryCode: 'METABOLISM'
                    }
                  ]
                }
              ]
            },
            quizzes: {
              total: 21,
              perDay: 1
            }
          }
        },
        timestamp: '2025-08-01T00:00:00.000Z'
      }
    }
  })
  async getEventDetails(
    @Param('eventId', ParseIntPipe) eventId: number
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`이벤트 상세 정보 조회 요청 - ID: ${eventId}`);

    try {
      // 특정 이벤트 조회
      const event = await this.eventService.getEventById(eventId);
      
      // 활성 이벤트인지 확인
      if (!event.isActive) {
        throw new NotFoundException('활성화되지 않은 이벤트입니다.');
      }
      
      const result = {
        event: {
          id: event.id,
          name: event.name,
          description: event.description,
          startDate: event.startDate,
          endDate: event.endDate,
          totalDays: event.totalDays,
          type: event.type,
        },
        contents: {
          missions: {
            total: event.eventMissions?.length || 0,
            items: event.eventMissions?.map(em => ({
              missionId: em.missionId,
              points: em.points,
              activeFromDay: em.activeFromDay,
              activeToDay: em.activeToDay,
              mission: {
                id: em.mission.id,
                code: em.mission.code,
                name: em.mission.name,
                description: em.mission.description,
                requireUpload: em.mission.requireUpload,
                uploadType: em.mission.uploadType,
                category: em.mission.category,
                dailyLimit: em.mission.dailyLimit,
                isActive: em.mission.isActive
              }
            })) || []
          },
          surveys: {
            total: event.eventSurveys?.length || 0,
            items: event.eventSurveys?.map(es => ({
              surveyId: es.surveyId,
              type: es.surveyOptions?.type || 'before',
              fromDay: es.surveyOptions?.fromDay || 1,
              toDay: es.surveyOptions?.toDay,
              questions: es.survey.surveyQuestions?.map(sq => ({
                id: sq.id,
                category: sq.category,
                questionText: sq.questionText,
                sortOrder: sq.sortOrder,
                categoryCode: sq.categoryCode
              })) || []
            })) || []
          },
          quizzes: {
            total: event.eventQuizzes?.length || 0,
            items: event.eventQuizzes?.map(eq => ({
              quizId: eq.quizId,
              day: eq.day,
              sortOrder: eq.sortOrder,
              quiz: {
                id: eq.quiz.id,
                title: eq.quiz.title,
                question: eq.quiz.question,
                options: eq.quiz.options,
                correctAnswer: eq.quiz.correctAnswer,
                points: eq.quiz.points,
                category: eq.quiz.category,
                difficulty: eq.quiz.difficulty,
                isActive: eq.quiz.isActive
              }
            })) || []
          }
        }
      };

      this.logger.log(`이벤트 상세 정보 조회 성공 - ${event.name}`);

      return {
        success: true,
        message: '이벤트 상세 정보를 조회했습니다.',
        data: result,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('이벤트 상세 정보 조회 실패', error);
      throw error;
    }
  }
}