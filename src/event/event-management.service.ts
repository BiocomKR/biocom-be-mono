import { Injectable, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { Event, EventSurvey, EventMission, EventQuiz } from '@prisma/client';
import { EventType } from './event.types';

/**
 * 이벤트 관리 서비스
 * 이벤트와 미션, 설문, 퀴즈의 관계를 관리하는 서비스
 */
@Injectable()
export class EventManagementService {
  private readonly logger = new Logger(EventManagementService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ==================== 이벤트-설문 관계 관리 ====================

  /**
   * 이벤트에 설문 연결
   * 
   * @param eventId 이벤트 ID
   * @param surveyId 설문 ID
   * @param options 설문 옵션 (type: 'before' | 'after', fromDay 등)
   * @returns 생성된 이벤트-설문 관계
   */
  async attachSurveyToEvent(
    eventId: number,
    surveyId: number,
    options: {
      type: 'before' | 'after';
      fromDay?: number;
    }
  ): Promise<EventSurvey> {
    this.logger.log(`이벤트에 설문 연결 - 이벤트 ID: ${eventId}, 설문 ID: ${surveyId}, 타입: ${options.type}`);

    // 이벤트 존재 확인
    const event = await this.prisma.event.findUnique({
      where: { id: eventId }
    });

    if (!event) {
      throw new NotFoundException(`ID ${eventId}에 해당하는 이벤트를 찾을 수 없습니다.`);
    }

    // 설문 존재 확인
    const survey = await this.prisma.survey.findUnique({
      where: { id: surveyId }
    });

    if (!survey) {
      throw new NotFoundException(`ID ${surveyId}에 해당하는 설문을 찾을 수 없습니다.`);
    }

    // 중복 확인
    const existing = await this.prisma.eventSurvey.findUnique({
      where: {
        eventId_surveyId: {
          eventId,
          surveyId
        }
      }
    });

    if (existing) {
      throw new BadRequestException('이미 연결된 설문입니다.');
    }

    // 동일한 타입의 다른 설문이 이미 연결되어 있는지 확인
    const allEventSurveys = await this.prisma.eventSurvey.findMany({
      where: {
        eventId,
        isActive: true
      }
    });

    const existingType = allEventSurveys.find(es => {
      const opts = es.surveyOptions as any;
      return opts?.type === options.type;
    });

    if (existingType) {
      throw new BadRequestException(`이미 ${options.type} 설문이 연결되어 있습니다.`);
    }

    const eventSurvey = await this.prisma.eventSurvey.create({
      data: {
        eventId,
        surveyId,
        surveyOptions: {
          type: options.type,
          fromDay: options.fromDay || (options.type === 'before' ? 1 : event.totalDays)
        },
        isActive: true
      },
      include: {
        survey: true
      }
    });

    this.logger.log(`이벤트-설문 연결 완료 - ID: ${eventSurvey.id}`);
    return eventSurvey;
  }

  /**
   * 이벤트에서 설문 연결 해제
   * 
   * @param eventId 이벤트 ID
   * @param surveyId 설문 ID
   */
  async detachSurveyFromEvent(eventId: number, surveyId: number): Promise<void> {
    this.logger.log(`이벤트에서 설문 연결 해제 - 이벤트 ID: ${eventId}, 설문 ID: ${surveyId}`);

    const deleted = await this.prisma.eventSurvey.delete({
      where: {
        eventId_surveyId: {
          eventId,
          surveyId
        }
      }
    });

    if (!deleted) {
      throw new NotFoundException('연결된 설문을 찾을 수 없습니다.');
    }

    this.logger.log('이벤트-설문 연결 해제 완료');
  }

  /**
   * 이벤트의 설문 목록 조회
   * 
   * @param eventId 이벤트 ID
   * @returns 이벤트에 연결된 설문 목록
   */
  async getEventSurveys(eventId: number): Promise<EventSurvey[]> {
    this.logger.log(`이벤트의 설문 목록 조회 - 이벤트 ID: ${eventId}`);

    const surveys = await this.prisma.eventSurvey.findMany({
      where: { eventId },
      include: {
        survey: {
          include: {
            surveyQuestions: {
              orderBy: [
                { categoryCode: 'asc' },
                { sortOrder: 'asc' }
              ]
            }
          }
        }
      }
    });

    this.logger.log(`설문 목록 조회 완료 - 총 ${surveys.length}개`);
    return surveys;
  }

  // ==================== 이벤트-미션 관계 관리 ====================

  /**
   * 이벤트에 미션 연결
   * 
   * @param eventId 이벤트 ID
   * @param missionId 미션 ID
   * @param options 미션 옵션
   * @returns 생성된 이벤트-미션 관계
   */
  async attachMissionToEvent(
    eventId: number,
    missionId: number,
    options: {
      points?: number;
      activeFromDay?: number;
      activeToDay?: number;
      sortOrder?: number;
    } = {}
  ): Promise<EventMission> {
    this.logger.log(`이벤트에 미션 연결 - 이벤트 ID: ${eventId}, 미션 ID: ${missionId}`);

    // 이벤트 존재 확인
    const event = await this.prisma.event.findUnique({
      where: { id: eventId }
    });

    if (!event) {
      throw new NotFoundException(`ID ${eventId}에 해당하는 이벤트를 찾을 수 없습니다.`);
    }

    // 미션 존재 확인
    const mission = await this.prisma.mission.findUnique({
      where: { id: missionId }
    });

    if (!mission) {
      throw new NotFoundException(`ID ${missionId}에 해당하는 미션을 찾을 수 없습니다.`);
    }

    // 중복 확인 (동일한 기간의 동일한 미션)
    const existing = await this.prisma.eventMission.findFirst({
      where: {
        eventId,
        missionId,
        activeFromDay: options.activeFromDay || null
      }
    });

    if (existing) {
      throw new BadRequestException('이미 동일한 기간에 연결된 미션입니다.');
    }

    const eventMission = await this.prisma.eventMission.create({
      data: {
        eventId,
        missionId,
        points: options.points || mission.points,
        activeFromDay: options.activeFromDay,
        activeToDay: options.activeToDay,
        sortOrder: options.sortOrder || 0,
        isActive: true
      },
      include: {
        mission: true
      }
    });

    this.logger.log(`이벤트-미션 연결 완료 - ID: ${eventMission.id}`);
    return eventMission;
  }

  /**
   * 이벤트에서 미션 연결 해제
   * 
   * @param eventId 이벤트 ID
   * @param missionId 미션 ID
   * @param activeFromDay 활성화 시작 일차 (특정 기간의 미션 삭제)
   */
  async detachMissionFromEvent(
    eventId: number,
    missionId: number,
    activeFromDay?: number
  ): Promise<void> {
    this.logger.log(`이벤트에서 미션 연결 해제 - 이벤트 ID: ${eventId}, 미션 ID: ${missionId}`);

    const deleted = await this.prisma.eventMission.deleteMany({
      where: {
        eventId,
        missionId,
        activeFromDay: activeFromDay || null
      }
    });

    if (deleted.count === 0) {
      throw new NotFoundException('연결된 미션을 찾을 수 없습니다.');
    }

    this.logger.log(`이벤트-미션 연결 해제 완료 - 삭제된 수: ${deleted.count}`);
  }

  /**
   * 이벤트의 미션 목록 조회
   * 
   * @param eventId 이벤트 ID
   * @param day 특정 일차의 미션만 조회 (선택적)
   * @returns 이벤트에 연결된 미션 목록
   */
  async getEventMissions(eventId: number, day?: number): Promise<EventMission[]> {
    this.logger.log(`이벤트의 미션 목록 조회 - 이벤트 ID: ${eventId}, 일차: ${day || '전체'}`);

    const where: any = { eventId, isActive: true };

    if (day) {
      where.OR = [
        { activeFromDay: null, activeToDay: null }, // 전체 기간
        { activeFromDay: { lte: day }, OR: [{ activeToDay: null }, { activeToDay: { gte: day } }] } // 특정 일차 포함
      ];
    }

    const missions = await this.prisma.eventMission.findMany({
      where,
      include: {
        mission: {
          include: {
            schedules: true
          }
        }
      },
      orderBy: { sortOrder: 'asc' }
    });

    this.logger.log(`미션 목록 조회 완료 - 총 ${missions.length}개`);
    return missions;
  }

  // ==================== 이벤트-퀴즈 관계 관리 ====================

  /**
   * 이벤트에 퀴즈 연결
   * 
   * @param eventId 이벤트 ID
   * @param quizId 퀴즈 ID
   * @param day 퀴즈 출제 일차
   * @param sortOrder 정렬 순서
   * @returns 생성된 이벤트-퀴즈 관계
   */
  async attachQuizToEvent(
    eventId: number,
    quizId: number,
    day: number,
    sortOrder: number = 0
  ): Promise<any> {
    this.logger.log(`이벤트에 퀴즈 연결 - 이벤트 ID: ${eventId}, 퀴즈 ID: ${quizId}, 일차: ${day}`);

    // 이벤트 존재 확인
    const event = await this.prisma.event.findUnique({
      where: { id: eventId }
    });

    if (!event) {
      throw new NotFoundException(`ID ${eventId}에 해당하는 이벤트를 찾을 수 없습니다.`);
    }

    // 퀴즈 존재 확인
    const quizCount = await this.prisma.quiz.count({
      where: { id: quizId }
    });

    if (quizCount === 0) {
      throw new NotFoundException(`ID ${quizId}에 해당하는 퀴즈를 찾을 수 없습니다.`);
    }

    // 일차 유효성 확인
    if (day < 1 || day > event.totalDays) {
      throw new BadRequestException(`유효하지 않은 일차입니다. (1 ~ ${event.totalDays}일)`);
    }

    // 중복 확인
    const existing = await this.prisma.eventQuiz.findFirst({
      where: {
        eventId,
        quizId,
        day
      }
    });

    if (existing) {
      throw new BadRequestException(`${day}일차에 이미 해당 퀴즈가 연결되어 있습니다.`);
    }

    const eventQuiz = await this.prisma.eventQuiz.create({
      data: {
        eventId,
        quizId,
        day,
        sortOrder,
        isActive: true
      },
      include: {
        quiz: true
      }
    });

    this.logger.log(`퀴즈 연결 완료 - EventQuiz ID: ${eventQuiz.id}`);
    return eventQuiz;
  }

  /**
   * 이벤트에 여러 퀴즈 한번에 연결
   */
  async attachMultipleQuizzesToEvent(
    eventId: number,
    quizzes: { quizId: number; day: number; sortOrder?: number }[]
  ): Promise<any[]> {
    this.logger.log(`이벤트에 여러 퀴즈 연결 - 이벤트 ID: ${eventId}, 퀴즈 개수: ${quizzes.length}`);

    // 이벤트 존재 확인
    const event = await this.prisma.event.findUnique({
      where: { id: eventId }
    });

    if (!event) {
      throw new NotFoundException(`ID ${eventId}에 해당하는 이벤트를 찾을 수 없습니다.`);
    }

    const results = [];
    const errors = [];

    for (const quiz of quizzes) {
      try {
        const result = await this.attachQuizToEvent(
          eventId,
          quiz.quizId,
          quiz.day,
          quiz.sortOrder || 0
        );
        results.push(result);
      } catch (error) {
        errors.push({
          quizId: quiz.quizId,
          day: quiz.day,
          error: error.message
        });
      }
    }

    if (errors.length > 0) {
      this.logger.warn(`일부 퀴즈 연결 실패: ${JSON.stringify(errors)}`);
    }

    return {
      success: results,
      errors: errors
    } as any;
  }

  /**
   * 이벤트에서 퀴즈 연결 해제
   * 
   * @param eventId 이벤트 ID
   * @param quizId 퀴즈 ID
   */
  async detachQuizFromEvent(
    eventId: number,
    quizId: number
  ): Promise<void> {
    this.logger.log(`이벤트에서 퀴즈 연결 해제 - 이벤트 ID: ${eventId}, 퀴즈 ID: ${quizId}`);

    // 관계 확인
    const eventQuiz = await this.prisma.eventQuiz.findFirst({
      where: {
        eventId,
        quizId
      }
    });

    if (!eventQuiz) {
      throw new NotFoundException('해당 이벤트와 퀴즈의 연결을 찾을 수 없습니다.');
    }

    // 답변이 있는지 확인
    const hasAnswers = await this.prisma.quizAnswer.count({
      where: { eventQuizId: eventQuiz.id }
    });

    if (hasAnswers > 0) {
      throw new BadRequestException(`이미 답변이 존재하는 퀴즈는 연결 해제할 수 없습니다. (답변 수: ${hasAnswers})`);
    }

    // 연결 해제
    await this.prisma.eventQuiz.delete({
      where: { id: eventQuiz.id }
    });

    this.logger.log(`퀴즈 연결 해제 완료 - EventQuiz ID: ${eventQuiz.id}`);
  }

  /**
   * 이벤트의 퀴즈 목록 조회
   * 
   * @param eventId 이벤트 ID
   * @returns 퀴즈 목록
   */
  async getEventQuizzes(eventId: number): Promise<any[]> {
    this.logger.log(`이벤트의 퀴즈 목록 조회 - 이벤트 ID: ${eventId}`);

    const quizzes = await this.prisma.eventQuiz.findMany({
      where: { eventId },
      include: {
        quiz: true
      },
      orderBy: [
        { day: 'asc' },
        { sortOrder: 'asc' }
      ]
    });

    this.logger.log(`퀴즈 목록 조회 완료 - 총 ${quizzes.length}개`);
    return quizzes;
  }

  /**
   * 특정 일차의 퀴즈 조회
   * 
   * @param eventId 이벤트 ID
   * @param day 일차
   * @returns 퀴즈 정보
   */
  async getEventQuizByDay(eventId: number, day: number): Promise<any[] | null> {
    this.logger.log(`특정 일차 퀴즈 조회 - 이벤트 ID: ${eventId}, 일차: ${day}`);

    const quizzes = await this.prisma.eventQuiz.findMany({
      where: {
        eventId,
        day
      },
      include: {
        quiz: true
      },
      orderBy: {
        sortOrder: 'asc'
      }
    });

    if (quizzes.length === 0) {
      this.logger.warn(`퀴즈를 찾을 수 없음 - 이벤트 ID: ${eventId}, 일차: ${day}`);
      return null;
    }

    this.logger.log(`퀴즈 조회 완료 - 총 ${quizzes.length}개`);
    return quizzes;
  }

  // ==================== 이벤트 통계 및 관리 ====================

  /**
   * 이벤트 참여 사용자 목록 조회
   * 
   * @param periodId 이벤트 기간 ID
   * @returns 참여 사용자 목록
   */
  async getEventUsers(periodId: number): Promise<any[]> {
    this.logger.log(`이벤트 참여 사용자 목록 조회 - 이벤트 ID: ${periodId}`);

    const users = await this.prisma.eventUser.findMany({
      where: { eventId: periodId },
      include: {
        user: {
          select: {
            id: true,
            email: true,
            name: true,
            mobile: true,
            points: true,
            createdAt: true,
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    this.logger.log(`이벤트 참여 사용자 조회 완료 - 총 ${users.length}명`);
    
    return users.map(eu => ({
      ...eu.user,
      joinedAt: eu.joinedAt,
      totalPoints: eu.totalPoints || 0,
      completedDays: eu.completedDays || 0,
    }));
  }

  /**
   * 이벤트 통계 조회
   * 
   * @param periodId 이벤트 기간 ID
   * @returns 이벤트 통계
   */
  async getEventStatistics(periodId: number): Promise<any> {
    this.logger.log(`이벤트 통계 조회 - 이벤트 ID: ${periodId}`);

    // 이벤트 정보 조회
    const event = await this.prisma.event.findUnique({
      where: { id: periodId },
      include: {
        eventUsers: true,
        eventMissions: true,
        eventSurveys: true,
        eventQuizzes: true,
      }
    });

    if (!event) {
      throw new NotFoundException(`이벤트를 찾을 수 없습니다: ${periodId}`);
    }

    // 미션 완료 통계
    const missionCompletions = await this.prisma.missionCompletion.groupBy({
      by: ['eventUserId'],
      where: {
        eventUser: {
          eventId: periodId
        }
      },
      _count: {
        id: true
      }
    });

    // 퀴즈 답변 통계
    const quizAnswers = await this.prisma.quizAnswer.groupBy({
      by: ['eventUserId', 'isCorrect'],
      where: {
        eventUser: {
          eventId: periodId
        }
      },
      _count: {
        id: true
      }
    });

    // 설문 답변 통계
    const surveyAnswers = await this.prisma.surveyAnswer.groupBy({
      by: ['eventUserId'],
      where: {
        eventUser: {
          eventId: periodId
        }
      },
      _count: {
        id: true
      }
    });

    // 통계 계산
    const totalUsers = event.eventUsers.length;
    const activeUsers = event.eventUsers.filter(u => u.status === 'ACTIVE').length;
    const totalMissions = event.eventMissions.length * event.totalDays;
    const completedMissions = missionCompletions.reduce((sum, mc) => sum + mc._count.id, 0);
    const totalQuizzes = event.eventQuizzes.length;
    const correctAnswers = quizAnswers.filter(qa => qa.isCorrect).reduce((sum, qa) => sum + qa._count.id, 0);
    const totalAnswers = quizAnswers.reduce((sum, qa) => sum + qa._count.id, 0);

    const statistics = {
      event: {
        id: event.id,
        name: event.name,
        type: event.type,
        status: event.isActive ? 'active' : 'inactive',
        startDate: event.startDate,
        endDate: event.endDate,
        totalDays: event.totalDays,
      },
      users: {
        total: totalUsers,
        active: activeUsers,
        participationRate: totalUsers > 0 ? (activeUsers / totalUsers * 100).toFixed(2) + '%' : '0%',
      },
      missions: {
        total: totalMissions,
        completed: completedMissions,
        completionRate: totalMissions > 0 ? (completedMissions / totalMissions * 100).toFixed(2) + '%' : '0%',
        averagePerUser: totalUsers > 0 ? (completedMissions / totalUsers).toFixed(2) : '0',
      },
      quizzes: {
        total: totalQuizzes,
        totalAnswers: totalAnswers,
        correctAnswers: correctAnswers,
        accuracyRate: totalAnswers > 0 ? (correctAnswers / totalAnswers * 100).toFixed(2) + '%' : '0%',
      },
      surveys: {
        total: event.eventSurveys.length,
        responses: surveyAnswers.length,
        responseRate: totalUsers > 0 ? (surveyAnswers.length / totalUsers * 100).toFixed(2) + '%' : '0%',
      }
    };

    this.logger.log(`이벤트 통계 조회 완료 - 이벤트 ID: ${periodId}`);
    return statistics;
  }

  /**
   * 이벤트에 컨텐츠 연결
   */
  async attachContentToEvent(
    eventId: number,
    contentId: number,
    day: number
  ): Promise<any> {
    this.logger.log(`이벤트에 컨텐츠 연결 - 이벤트 ID: ${eventId}, 컨텐츠 ID: ${contentId}, 일차: ${day}`);

    // 이벤트 존재 확인
    const event = await this.prisma.event.findUnique({
      where: { id: eventId }
    });

    if (!event) {
      throw new NotFoundException(`이벤트를 찾을 수 없습니다: ${eventId}`);
    }

    // 컨텐츠 존재 확인
    const content = await this.prisma.content.findUnique({
      where: { id: contentId }
    });

    if (!content) {
      throw new NotFoundException(`컨텐츠를 찾을 수 없습니다: ${contentId}`);
    }

    // 일차 유효성 확인
    if (day < 1 || day > event.totalDays) {
      throw new BadRequestException(`유효하지 않은 일차입니다: ${day} (1-${event.totalDays}일차만 가능)`);
    }

    // 해당 일차에 이미 컨텐츠가 있는지 확인
    const existingContent = await this.prisma.eventContent.findUnique({
      where: {
        eventId_day: { eventId, day }
      }
    });

    if (existingContent) {
      throw new BadRequestException(`${day}일차에 이미 다른 컨텐츠가 등록되어 있습니다.`);
    }

    // 이벤트-컨텐츠 연결 생성
    const eventContent = await this.prisma.eventContent.create({
      data: {
        eventId,
        contentId,
        day,
        isActive: true
      },
      include: {
        content: true
      }
    });

    this.logger.log(`이벤트에 컨텐츠 연결 성공 - EventContent ID: ${eventContent.id}`);
    return eventContent;
  }

  /**
   * 이벤트에서 컨텐츠 연결 해제
   */
  async detachContentFromEvent(eventId: number, contentId: number): Promise<void> {
    this.logger.log(`이벤트에서 컨텐츠 연결 해제 - 이벤트 ID: ${eventId}, 컨텐츠 ID: ${contentId}`);

    const eventContent = await this.prisma.eventContent.findFirst({
      where: { eventId, contentId }
    });

    if (!eventContent) {
      throw new NotFoundException('이벤트-컨텐츠 연결을 찾을 수 없습니다.');
    }

    await this.prisma.eventContent.delete({
      where: { id: eventContent.id }
    });

    this.logger.log(`이벤트에서 컨텐츠 연결 해제 성공`);
  }

  /**
   * 이벤트별 컨텐츠 목록 조회
   */
  async getEventContents(eventId: number): Promise<any[]> {
    this.logger.log(`이벤트별 컨텐츠 목록 조회 - 이벤트 ID: ${eventId}`);

    const eventContents = await this.prisma.eventContent.findMany({
      where: { eventId },
      include: {
        content: {
          include: {
            contentFiles: {
              orderBy: { sortOrder: 'asc' }
            }
          }
        }
      },
      orderBy: { day: 'asc' }
    });

    this.logger.log(`이벤트별 컨텐츠 목록 조회 성공 - 컨텐츠 수: ${eventContents.length}`);
    return eventContents;
  }
}