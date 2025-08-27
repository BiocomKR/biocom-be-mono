import { Injectable, Logger, BadRequestException, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { EventService } from '../event/event.service';
import { CreateSurveyAnswerDto } from './dto/create-survey-answer.dto';
import { SurveyAnswer } from '@prisma/client';
import { EventSurveyOptions, isEventSurveyOptions } from '../event/event.types';
import { PaginationHelper, PaginatedResult } from '../common/utils/pagination.util';

/**
 * 설문 서비스
 * 이벤트 참여자의 설문 답변을 관리
 */
@Injectable()
export class SurveyService {
  private readonly logger = new Logger(SurveyService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly eventService: EventService,
  ) {}

  // ==================== 관리자용 CRUD API ====================

  /**
   * 모든 설문 목록 조회
   * 
   * @returns 설문 목록
   */
  async getAllSurveys(): Promise<any[]> {
    this.logger.log('모든 설문 목록 조회');

    const surveys = await this.prisma.survey.findMany({
      include: {
        surveyQuestions: {
          orderBy: { sortOrder: 'asc' }
        },
        eventSurveys: {
          include: {
            event: true
          }
        }
      },
      orderBy: { createdAt: 'desc' }
    });

    this.logger.log(`설문 목록 조회 완료 - 총 ${surveys.length}개`);
    return surveys;
  }

  /**
   * 새로운 설문 생성
   * 
   * @param createSurveyDto 설문 생성 정보
   * @returns 생성된 설문
   */
  async createSurvey(createSurveyDto: {
    name: string;  // title 대신 name으로 변경
    description?: string;
    type?: string;
    category?: string;
    isActive?: boolean;
  }): Promise<any> {
    this.logger.log(`설문 생성 - 이름: ${createSurveyDto.name}`);

    const survey = await this.prisma.survey.create({
      data: {
        name: createSurveyDto.name,  // name 필드 직접 사용
        description: createSurveyDto.description,
        isActive: createSurveyDto.isActive ?? true,
      }
    });

    this.logger.log(`설문 생성 완료 - ID: ${survey.id}`);
    return survey;
  }

  /**
   * 설문 상세 조회
   * 
   * @param id 설문 ID
   * @returns 설문 정보
   */
  async getSurveyById(id: number): Promise<any> {
    this.logger.log(`설문 상세 조회 - ID: ${id}`);

    const survey = await this.prisma.survey.findUnique({
      where: { id },
      include: {
        surveyQuestions: {
          orderBy: { sortOrder: 'asc' }
        }
      }
    });

    if (!survey) {
      throw new NotFoundException(`설문을 찾을 수 없습니다: ${id}`);
    }

    return survey;
  }

  /**
   * 설문 수정
   * 
   * @param id 설문 ID
   * @param updateSurveyDto 수정할 정보
   * @returns 수정된 설문
   */
  async updateSurvey(
    id: number,
    updateSurveyDto: Partial<{
      name: string;  // title 대신 name 사용
      description: string;
      isActive: boolean;
    }>
  ): Promise<any> {
    this.logger.log(`설문 수정 - ID: ${id}`);

    const updateData: any = {};
    if (updateSurveyDto.name !== undefined) {
      updateData.name = updateSurveyDto.name;  // name 필드 직접 사용
    }
    if (updateSurveyDto.description !== undefined) {
      updateData.description = updateSurveyDto.description;
    }
    if (updateSurveyDto.isActive !== undefined) {
      updateData.isActive = updateSurveyDto.isActive;
    }

    const survey = await this.prisma.survey.update({
      where: { id },
      data: updateData
    });

    this.logger.log(`설문 수정 완료 - ID: ${id}`);
    return survey;
  }

  /**
   * 설문 삭제
   * 
   * @param id 설문 ID
   */
  async deleteSurvey(id: number): Promise<void> {
    this.logger.log(`설문 삭제 - ID: ${id}`);

    // 관련 답변이 있는지 확인
    const answers = await this.prisma.surveyAnswer.count({
      where: {
        surveyQuestion: {
          surveyId: id
        }
      }
    });

    if (answers > 0) {
      throw new BadRequestException(`답변이 존재하는 설문은 삭제할 수 없습니다. (답변 수: ${answers})`);
    }

    // 트랜잭션으로 관련 데이터 모두 삭제
    await this.prisma.$transaction(async (tx) => {
      // 설문 옵션 삭제
      await tx.surveyOption.deleteMany({
        where: {
          surveyQuestion: {
            surveyId: id
          }
        }
      });

      // 설문 질문 삭제
      await tx.surveyQuestion.deleteMany({
        where: { surveyId: id }
      });

      // 이벤트-설문 연결 삭제
      await tx.eventSurvey.deleteMany({
        where: { surveyId: id }
      });

      // 설문 삭제
      await tx.survey.delete({
        where: { id }
      });
    });

    this.logger.log(`설문 삭제 완료 - ID: ${id}`);
  }

  /**
   * 설문에 질문 추가
   * 
   * @param surveyId 설문 ID
   * @param createQuestionDto 질문 생성 정보
   * @returns 생성된 질문
   */
  async addQuestionToSurvey(
    surveyId: number,
    createQuestionDto: {
      categoryCode: string;
      categoryName: string;
      questionText: string;
      questionType: string;
      options?: string[];
      sortOrder?: number;
      isRequired?: boolean;
    }
  ): Promise<any> {
    this.logger.log(`설문에 질문 추가 - 설문 ID: ${surveyId}, 질문: ${createQuestionDto.questionText}`);

    // 설문 존재 확인
    await this.getSurveyById(surveyId);

    // 트랜잭션으로 질문과 옵션 생성
    const result = await this.prisma.$transaction(async (tx) => {
      // 질문 생성
      const question = await tx.surveyQuestion.create({
        data: {
          surveyId,
          categoryCode: createQuestionDto.categoryCode,
          categoryName: createQuestionDto.categoryName,
          questionText: createQuestionDto.questionText,
          questionType: createQuestionDto.questionType,
          sortOrder: createQuestionDto.sortOrder || 0,
          isRequired: createQuestionDto.isRequired ?? true,
        }
      });

      // 옵션이 있으면 생성
      if (createQuestionDto.options && createQuestionDto.options.length > 0) {
        await tx.surveyOption.createMany({
          data: createQuestionDto.options.map((optionText, index) => ({
            surveyQuestionId: question.id,
            optionText,
            score: index + 1,
          }))
        });
      }

      // 생성된 질문 조회
      return await tx.surveyQuestion.findUnique({
        where: { id: question.id }
      });
    });

    this.logger.log(`설문에 질문 추가 완료 - 질문 ID: ${result.id}`);
    return result;
  }

  /**
   * 설문 답변 생성
   */
  async createAnswer(createSurveyAnswerDto: CreateSurveyAnswerDto): Promise<SurveyAnswer> {
    this.logger.log(`설문 답변 생성 - 사용자: ${createSurveyAnswerDto.userId}, 타입: ${createSurveyAnswerDto.type}`);

    // 활성 이벤트 확인
    const activeEvent = await this.eventService.getActiveEvent();
    
    // 설문 사용 가능 여부 확인
    await this.validateSurveyAvailability(
      activeEvent,
      createSurveyAnswerDto.type,
      createSurveyAnswerDto.userId
    );

    // 질문과 선택지 검증
    await this.validateQuestionAndOption(
      createSurveyAnswerDto.surveyQuestionId,
      createSurveyAnswerDto.surveyOptionId
    );

    // 이벤트 참여자 확인/생성
    const eventUser = await this.getOrCreateEventUser(
      createSurveyAnswerDto.userId,
      activeEvent.id
    );

    // 중복 답변 체크
    const existing = await this.prisma.surveyAnswer.findFirst({
      where: {
        userId: createSurveyAnswerDto.userId,
        surveyQuestionId: createSurveyAnswerDto.surveyQuestionId,
        type: createSurveyAnswerDto.type,
      },
    });

    if (existing) {
      throw new ConflictException('이미 답변한 질문입니다.');
    }

    // 답변 생성
    const answer = await this.prisma.surveyAnswer.create({
      data: {
        userId: createSurveyAnswerDto.userId,
        surveyQuestionId: createSurveyAnswerDto.surveyQuestionId,
        surveyOptionId: createSurveyAnswerDto.surveyOptionId,
        type: createSurveyAnswerDto.type,
      },
      include: {
        surveyQuestion: true,
        surveyOption: true,
      },
    });

    this.logger.log(`설문 답변 생성 완료 - ID: ${answer.id}`);
    return answer;
  }

  /**
   * 설문 답변 대량 생성
   */
  async createBulkAnswers(
    userId: number,
    type: 'before' | 'after',
    answers: Array<{ questionId: number; optionId: number }>
  ): Promise<SurveyAnswer[]> {
    this.logger.log(`설문 답변 대량 생성 - 사용자: ${userId}, 개수: ${answers.length}`);

    const activeEvent = await this.eventService.getActiveEvent();
    await this.validateSurveyAvailability(activeEvent, type, userId);

    const eventUser = await this.getOrCreateEventUser(userId, activeEvent.id);

    return await this.prisma.$transaction(async (tx) => {
      const createdAnswers: SurveyAnswer[] = [];

      for (const { questionId, optionId } of answers) {
        const existing = await tx.surveyAnswer.findFirst({
          where: {
            userId,
            surveyQuestionId: questionId,
            type,
          },
        });

        if (!existing) {
          const answer = await tx.surveyAnswer.create({
            data: {
              userId,
              surveyQuestionId: questionId,
              surveyOptionId: optionId,
              type,
            },
          });
          createdAnswers.push(answer);
        }
      }

      return createdAnswers;
    });
  }

  /**
   * 설문 사용 가능 여부 검증
   */
  private async validateSurveyAvailability(
    activeEvent: any,
    type: 'before' | 'after',
    userId: number
  ): Promise<void> {
    // 이벤트-설문 관계 확인
    const eventSurvey = activeEvent.eventSurveys?.find((es: any) => {
      if (!es.isActive || !es.surveyOptions) return false;
      if (isEventSurveyOptions(es.surveyOptions)) {
        return es.surveyOptions.type === type;
      }
      return false;
    });

    if (!eventSurvey) {
      throw new BadRequestException(`이 이벤트는 ${type === 'before' ? '사전' : '사후'} 설문을 사용하지 않습니다.`);
    }

    const surveyOptions = eventSurvey.surveyOptions as EventSurveyOptions;

    // 일차 확인
    const currentDay = await this.eventService.calculateEventDay(
      new Date().toISOString().split('T')[0]
    );
    
    const fromDay = surveyOptions.fromDay || (type === 'before' ? 1 : activeEvent.totalDays);
    if (currentDay < fromDay) {
      throw new BadRequestException(
        `${type === 'before' ? '사전' : '사후'} 설문은 ${fromDay}일차부터 가능합니다.`
      );
    }

    // 사후 설문의 경우 사전 설문 완료 체크
    if (type === 'after') {
      await this.validateBeforeSurveyCompletion(activeEvent, userId);
    }
  }

  /**
   * 사전 설문 완료 여부 확인
   */
  private async validateBeforeSurveyCompletion(
    activeEvent: any,
    userId: number
  ): Promise<void> {
    const hasBeforeSurvey = activeEvent.eventSurveys?.some((es: any) => {
      if (!es.isActive || !es.surveyOptions) return false;
      if (isEventSurveyOptions(es.surveyOptions)) {
        return es.surveyOptions.type === 'before';
      }
      return false;
    });

    if (!hasBeforeSurvey) return;

    const totalQuestions = await this.prisma.surveyQuestion.count();
    const beforeAnswerCount = await this.prisma.surveyAnswer.count({
      where: {
        userId: userId,
        type: 'before',
      },
    });

    if (beforeAnswerCount < totalQuestions) {
      throw new BadRequestException(
        `사전 설문을 먼저 완료해주세요. (${beforeAnswerCount}/${totalQuestions})`
      );
    }
  }

  /**
   * 질문과 선택지 검증
   */
  private async validateQuestionAndOption(
    questionId: number,
    optionId: number
  ): Promise<void> {
    const [question, option] = await Promise.all([
      this.prisma.surveyQuestion.findUnique({ where: { id: questionId } }),
      this.prisma.surveyOption.findUnique({ where: { id: optionId } }),
    ]);

    if (!question) {
      throw new NotFoundException(`질문을 찾을 수 없습니다: ${questionId}`);
    }

    if (!option) {
      throw new NotFoundException(`선택지를 찾을 수 없습니다: ${optionId}`);
    }
  }

  /**
   * 이벤트 참여자 확인/생성
   */
  private async getOrCreateEventUser(userId: number, eventId: number) {
    let eventUser = await this.prisma.eventUser.findUnique({
      where: {
        eventId_userId: {
          eventId: eventId,
          userId: userId,
        },
      },
    });

    if (!eventUser) {
      eventUser = await this.prisma.eventUser.create({
        data: {
          eventId: eventId,
          userId: userId,
          status: 'ACTIVE',
        },
      });
    }

    return eventUser;
  }

  /**
   * 사용자 설문 답변 조회
   */
  async getUserAnswers(
    userId: number,
    type?: 'before' | 'after'
  ): Promise<(SurveyAnswer & { surveyQuestion: any; surveyOption: any })[]> {
    const where: any = { userId };
    if (type) where.type = type;

    return await this.prisma.surveyAnswer.findMany({
      where,
      include: {
        surveyQuestion: true,
        surveyOption: true,
      },
      orderBy: {
        surveyQuestion: {
          sortOrder: 'asc',
        },
      },
    });
  }

  /**
   * 설문 결과 분석
   */
  async analyzeSurveyResult(
    userId: number,
    type: 'before' | 'after'
  ): Promise<{
    categoryScores: Record<string, number>;
    totalScore: number;
    dominantCategory: string | null;
    animalCharacter?: string;
  }> {
    const answers = await this.getUserAnswers(userId, type);

    if (answers.length === 0) {
      throw new NotFoundException(`${type === 'before' ? '사전' : '사후'} 설문 답변이 없습니다.`);
    }

    // 카테고리별 점수 계산
    const categoryScores: Record<string, number> = {};
    let totalScore = 0;

    for (const answer of answers) {
      const category = answer.surveyQuestion.categoryCode;
      const score = answer.surveyOption.score;

      categoryScores[category] = (categoryScores[category] || 0) + score;
      totalScore += score;
    }

    // 최고 점수 카테고리 찾기
    let dominantCategory: string | null = null;
    let maxScore = 0;

    for (const [category, score] of Object.entries(categoryScores)) {
      if (score > maxScore) {
        maxScore = score;
        dominantCategory = category;
      }
    }

    // 동물 캐릭터 매칭
    let animalCharacter: string | undefined;
    if (dominantCategory) {
      const categoryDetail = await this.prisma.categoryDetail.findUnique({
        where: { categoryCode: dominantCategory },
      });
      animalCharacter = categoryDetail?.animalCharacter;
    }

    return {
      categoryScores,
      totalScore,
      dominantCategory,
      animalCharacter,
    };
  }

  /**
   * 설문 진행 상태 조회
   */
  async getSurveyStatus(userId: number): Promise<{
    beforeSurvey: {
      enabled: boolean;
      completed: boolean;
      answeredCount: number;
      totalQuestions: number;
    };
    afterSurvey: {
      enabled: boolean;
      available: boolean;
      completed: boolean;
      answeredCount: number;
      totalQuestions: number;
    };
    beforeCompleted: boolean;
    afterCompleted: boolean;
    canTakeAfterSurvey: boolean;
    nextAction: 'TAKE_BEFORE_SURVEY' | 'WAIT_FOR_AFTER_SURVEY' | 'TAKE_AFTER_SURVEY' | 'COMPLETED';
  }> {
    const activeEvent = await this.eventService.getActiveEvent();
    
    const beforeEnabled = activeEvent.eventSurveys?.some((es: any) => 
      es.isActive && isEventSurveyOptions(es.surveyOptions) && es.surveyOptions.type === 'before'
    );
    
    const afterEnabled = activeEvent.eventSurveys?.some((es: any) => 
      es.isActive && isEventSurveyOptions(es.surveyOptions) && es.surveyOptions.type === 'after'
    );

    const totalQuestions = await this.prisma.surveyQuestion.count();
    const [beforeAnswers, afterAnswers] = await Promise.all([
      this.getUserAnswers(userId, 'before'),
      this.getUserAnswers(userId, 'after'),
    ]);

    const beforeCompleted = beforeAnswers.length === totalQuestions;
    const afterCompleted = afterAnswers.length === totalQuestions;
    const canTakeAfterSurvey = !beforeEnabled || beforeCompleted;
    
    let nextAction: 'TAKE_BEFORE_SURVEY' | 'WAIT_FOR_AFTER_SURVEY' | 'TAKE_AFTER_SURVEY' | 'COMPLETED';
    
    if (!beforeCompleted && beforeEnabled) {
      nextAction = 'TAKE_BEFORE_SURVEY';
    } else if (afterEnabled && !canTakeAfterSurvey) {
      nextAction = 'WAIT_FOR_AFTER_SURVEY';
    } else if (afterEnabled && !afterCompleted) {
      nextAction = 'TAKE_AFTER_SURVEY';
    } else {
      nextAction = 'COMPLETED';
    }

    return {
      beforeSurvey: {
        enabled: !!beforeEnabled,
        completed: beforeCompleted,
        answeredCount: beforeAnswers.length,
        totalQuestions,
      },
      afterSurvey: {
        enabled: !!afterEnabled,
        available: canTakeAfterSurvey,
        completed: afterCompleted,
        answeredCount: afterAnswers.length,
        totalQuestions,
      },
      beforeCompleted,
      afterCompleted,
      canTakeAfterSurvey,
      nextAction,
    };
  }

  /**
   * 모든 설문 질문 조회
   */
  async getAllQuestions() {
    return await this.prisma.surveyQuestion.findMany({
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * 모든 설문 선택지 조회
   */
  async getAllOptions() {
    return await this.prisma.surveyOption.findMany({
      orderBy: { id: 'asc' },
    });
  }

  /**
   * 설문 질문 생성 (관리자용)
   */
  async createQuestion(data: any) {
    return await this.prisma.surveyQuestion.create({
      data,
      include: {
        survey: true,
      },
    });
  }

  /**
   * 설문 질문 조회
   */
  async findQuestions(categoryCode?: string) {
    const where = categoryCode ? { categoryCode } : {};
    
    return await this.prisma.surveyQuestion.findMany({
      where,
      include: {
        survey: true,
      },
      orderBy: { sortOrder: 'asc' },
    });
  }

  /**
   * 특정 설문 질문 조회
   */
  async findOneQuestion(id: number) {
    const question = await this.prisma.surveyQuestion.findUnique({
      where: { id },
      include: {
        survey: true,
      },
    });

    if (!question) {
      throw new NotFoundException(`설문 질문을 찾을 수 없습니다: ${id}`);
    }

    return question;
  }

  /**
   * 설문 선택지 생성 (관리자용)
   */
  async createOption(data: any) {
    return await this.prisma.surveyOption.create({
      data,
    });
  }

  /**
   * 사용자별 답변 조회
   */
  async findAnswersByUser(userId: number, type?: 'before' | 'after') {
    const where: any = { userId };
    if (type) where.type = type;

    return await this.prisma.surveyAnswer.findMany({
      where,
      include: {
        surveyQuestion: true,
        surveyOption: true,
      },
      orderBy: {
        surveyQuestion: {
          sortOrder: 'asc',
        },
      },
    });
  }

  /**
   * 질문별 답변 조회
   */
  async findAnswersByQuestion(questionId: number, type?: 'before' | 'after') {
    const where: any = { surveyQuestionId: questionId };
    if (type) where.type = type;

    return await this.prisma.surveyAnswer.findMany({
      where,
      include: {
        user: true,
        surveyOption: true,
      },
    });
  }

  /**
   * 설문 완료 (답변 포함)
   */
  async completeWithAnswers(
    userId: number,
    type: 'before' | 'after',
    answers: Array<{ questionId: number; optionId: number }>
  ) {
    // 트랜잭션으로 처리
    return await this.prisma.$transaction(async (tx) => {
      // 기존 답변 삭제
      await tx.surveyAnswer.deleteMany({
        where: {
          userId,
          type,
        },
      });

      // 새 답변 저장
      await tx.surveyAnswer.createMany({
        data: answers.map((answer) => ({
          userId,
          type,
          surveyQuestionId: answer.questionId,
          surveyOptionId: answer.optionId,
        })),
      });

      // 결과 분석
      return await this.analyzeSurveyResult(userId, type);
    });
  }

  /**
   * 설문 결과 조회
   */
  async findResults(userId: number, type?: 'before' | 'after') {
    const results = [];
    
    if (!type || type === 'before') {
      try {
        const beforeResult = await this.analyzeSurveyResult(userId, 'before');
        results.push({
          type: 'before' as const,
          ...beforeResult,
          createdAt: new Date(),
        });
      } catch (error) {
        // 결과가 없으면 무시
      }
    }

    if (!type || type === 'after') {
      try {
        const afterResult = await this.analyzeSurveyResult(userId, 'after');
        results.push({
          type: 'after' as const,
          ...afterResult,
          createdAt: new Date(),
        });
      } catch (error) {
        // 결과가 없으면 무시
      }
    }

    return results;
  }

  /**
   * 설문 전후 비교
   */
  async compareResults(userId: number) {
    const beforeResult = await this.analyzeSurveyResult(userId, 'before');
    const afterResult = await this.analyzeSurveyResult(userId, 'after');

    const categoryImprovements: Record<string, number> = {};
    
    for (const category of Object.keys(beforeResult.categoryScores)) {
      const before = beforeResult.categoryScores[category] || 0;
      const after = afterResult.categoryScores[category] || 0;
      categoryImprovements[category] = after - before;
    }

    // SurveyResultResponseDto 형식으로 변환
    const formatResult = (result: any, type: 'before' | 'after') => ({
      id: 0, // 실제 저장된 결과가 아님
      userId,
      type,
      skinHealthScore: result.categoryScores['SKIN_HEALTH'] || 0,
      metabolismScore: result.categoryScores['METABOLISM'] || 0,
      immuneBalanceScore: result.categoryScores['IMMUNE_BALANCE'] || 0,
      gutHealthScore: result.categoryScores['GUT_HEALTH'] || 0,
      totalScore: result.totalScore,
      dominantCategory: result.dominantCategory,
      animalCharacter: result.animalCharacter,
      animal: result.animalCharacter, // animal 필드 추가
      calculatedAt: new Date(), // calculatedAt 필드 추가
      createdAt: new Date(),
      updatedAt: new Date(),
    });

    return {
      before: formatResult(beforeResult, 'before'),
      after: formatResult(afterResult, 'after'),
      improvement: {
        totalScore: afterResult.totalScore - beforeResult.totalScore,
        categoryScores: categoryImprovements,
        percentage: Math.round(
          ((afterResult.totalScore - beforeResult.totalScore) / Math.abs(beforeResult.totalScore)) * 100
        ),
      },
    };
  }

  /**
   * 페이징 처리된 설문 목록 조회
   * 
   * @param page 페이지 번호
   * @param limit 페이지당 항목 수
   * @param filters 필터 조건
   * @param sort 정렬 조건
   * @returns 페이징 처리된 설문 목록
   */
  async getSurveysWithPagination(
    page: number,
    limit: number,
    filters: {
      search?: string;
      type?: string;
      category?: string;
      isActive?: boolean;
    },
    sort: {
      sortBy: string;
      sortOrder: 'asc' | 'desc';
    }
  ): Promise<PaginatedResult<any>> {
    this.logger.log(`페이징 처리된 설문 목록 조회 - page: ${page}, limit: ${limit}`);

    // WHERE 조건 구성
    const where: any = {};

    // 검색어 필터
    if (filters.search) {
      const searchCondition = PaginationHelper.createSearchCondition(filters.search, ['name', 'description']);
      if (searchCondition) {
        Object.assign(where, searchCondition);
      }
    }

    // 기타 필터
    const additionalFilters = PaginationHelper.buildWhereClause({
      isActive: filters.isActive,
    });
    
    Object.assign(where, additionalFilters);

    // 페이징 처리
    const result = await PaginationHelper.paginate(
      this.prisma.survey,
      { page, limit },
      {
        where,
        include: {
          _count: {
            select: {
              surveyQuestions: true,
              eventSurveys: true,
            },
          },
        },
      },
      sort
    );

    this.logger.log(`페이징 처리된 설문 목록 조회 완료 - 총 ${result.total}개, ${result.totalPages} 페이지`);

    return result;
  }
}