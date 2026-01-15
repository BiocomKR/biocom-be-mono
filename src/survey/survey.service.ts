import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { Survey, SurveyQuestion } from '@prisma/client';
import { PaginationHelper, PaginatedResult } from '../common/utils/pagination.util';
import { getNowKST } from '../common/utils/kst-date.util';

/**
 * Management 설문 관리 서비스
 * 백오피스에서 설문 생성, 수정, 삭제, 질문 관리 등을 담당
 */
@Injectable()
export class SurveyService {
  private readonly logger = new Logger(SurveyService.name);

  constructor(private readonly prisma: PrismaService) {}

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
              challengeSurveys: true,
            },
          },
        },
      },
      sort
    );

    this.logger.log(`페이징 처리된 설문 목록 조회 완료 - 총 ${result.total}개, ${result.totalPages} 페이지`);

    return result;
  }

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
    name: string;
    description?: string;
    type?: string;
    category?: string;
    isActive?: boolean;
  }): Promise<any> {
    this.logger.log(`설문 생성 - 이름: ${createSurveyDto.name}`);

    const survey = await this.prisma.survey.create({
      data: {
        name: createSurveyDto.name,
        description: createSurveyDto.description,
        isActive: createSurveyDto.isActive ?? true,
        createdAt: getNowKST(),
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
      name: string;
      description: string;
      isActive: boolean;
    }>
  ): Promise<any> {
    this.logger.log(`설문 수정 - ID: ${id}`);

    const updateData: any = {};
    if (updateSurveyDto.name !== undefined) {
      updateData.name = updateSurveyDto.name;
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
      throw new ConflictException(`답변이 존재하는 설문은 삭제할 수 없습니다. (답변 수: ${answers})`);
    }

    // Soft delete: isActive = false (연관 데이터는 유지)
    await this.prisma.survey.update({
      where: { id },
      data: { isActive: false }
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
          createdAt: getNowKST(),
        }
      });

      // 옵션이 있으면 생성
      if (createQuestionDto.options && createQuestionDto.options.length > 0) {
        const now = getNowKST();
        await tx.surveyOption.createMany({
          data: createQuestionDto.options.map((optionText, index) => ({
            surveyQuestionId: question.id,
            optionText,
            score: index + 1,
            createdAt: now,
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
   * 설문 선택지 생성 (관리자용)
   */
  async createOption(data: any) {
    return await this.prisma.surveyOption.create({
      data,
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
   * 특정 설문 상세 조회 (질문 포함) - survey-master.service.ts에서 가져온 메서드
   * 
   * @param id 설문 ID
   * @returns 설문 정보와 질문 목록
   */
  async findSurveyWithQuestions(id: number): Promise<Survey & { surveyQuestions: SurveyQuestion[] }> {
    this.logger.log(`설문 상세 조회 - ID: ${id}`);
    
    const survey = await this.prisma.survey.findUnique({
      where: { id },
      include: {
        surveyQuestions: {
          orderBy: [
            { categoryCode: 'asc' },
            { sortOrder: 'asc' }
          ]
        }
      }
    });
    
    if (!survey) {
      this.logger.warn(`존재하지 않는 설문 조회 시도 - ID: ${id}`);
      throw new NotFoundException(`ID ${id}에 해당하는 설문을 찾을 수 없습니다.`);
    }
    
    this.logger.log(`설문 상세 조회 완료 - 질문 수: ${survey.surveyQuestions.length}개`);
    return survey;
  }

  /**
   * 설문에 질문들 추가
   * 
   * @param surveyId 설문 ID
   * @param questionIds 추가할 질문 ID 목록
   * @returns 업데이트된 설문
   */
  async addQuestionsToSurvey(surveyId: number, questionIds: number[]): Promise<Survey> {
    this.logger.log(`설문에 질문 추가 - 설문 ID: ${surveyId}, 질문 수: ${questionIds.length}개`);
    
    // 설문 존재 확인
    const survey = await this.prisma.survey.findUnique({
      where: { id: surveyId }
    });
    
    if (!survey) {
      throw new NotFoundException(`ID ${surveyId}에 해당하는 설문을 찾을 수 없습니다.`);
    }
    
    // 질문들을 설문에 연결
    await this.prisma.surveyQuestion.updateMany({
      where: {
        id: { in: questionIds }
      },
      data: {
        surveyId: surveyId
      }
    });
    
    this.logger.log(`설문에 질문 추가 완료`);
    return this.findSurveyWithQuestions(surveyId);
  }

  /**
   * 설문에서 질문 제거
   * 
   * @param surveyId 설문 ID
   * @param questionIds 제거할 질문 ID 목록
   * @returns 업데이트된 설문
   */
  async removeQuestionsFromSurvey(surveyId: number, questionIds: number[]): Promise<Survey> {
    this.logger.log(`설문에서 질문 제거 - 설문 ID: ${surveyId}, 질문 수: ${questionIds.length}개`);
    
    // 질문들의 surveyId를 null로 설정
    await this.prisma.surveyQuestion.updateMany({
      where: {
        id: { in: questionIds },
        surveyId: surveyId
      },
      data: {
        surveyId: null
      }
    });
    
    this.logger.log(`설문에서 질문 제거 완료`);
    return this.findSurveyWithQuestions(surveyId);
  }

  /**
   * 공통 질문 목록 조회 (특정 설문에 속하지 않은 질문들)
   *
   * @returns 공통 질문 목록
   */
  async findCommonQuestions(): Promise<SurveyQuestion[]> {
    this.logger.log('공통 질문 목록 조회');

    const questions = await this.prisma.surveyQuestion.findMany({
      where: { surveyId: null },
      orderBy: [
        { categoryCode: 'asc' },
        { sortOrder: 'asc' }
      ]
    });

    this.logger.log(`공통 질문 조회 완료 - 총 ${questions.length}개`);
    return questions;
  }

  /**
   * 설문 답변 목록 조회 (페이징 및 필터링)
   *
   * @param page 페이지 번호
   * @param limit 페이지당 항목 수
   * @param filters 필터 조건
   * @param sort 정렬 조건
   * @returns 페이징 처리된 설문 답변 목록
   */
  async getAnswersWithPagination(
    page: number,
    limit: number,
    filters: {
      surveyId?: number;
      type?: string;
      categoryCode?: string;
      userId?: number;
      userChallengeId?: number;
      search?: string;
      startDate?: string;
      endDate?: string;
      excludeTesters?: boolean;
    },
    sort: {
      sortBy: string;
      sortOrder: 'asc' | 'desc';
    }
  ): Promise<PaginatedResult<any>> {
    this.logger.log(`페이징 처리된 설문 답변 목록 조회 - page: ${page}, limit: ${limit}, excludeTesters: ${filters.excludeTesters}`);

    const skip = (page - 1) * limit;

    // WHERE 조건 구성
    const where: any = {};

    // 설문 ID 필터
    if (filters.surveyId) {
      where.surveyQuestion = {
        surveyId: filters.surveyId,
      };
    }

    // 타입 필터 (before/after)
    if (filters.type) {
      where.type = filters.type;
    }

    // 카테고리 코드 필터
    if (filters.categoryCode) {
      where.surveyQuestion = {
        ...where.surveyQuestion,
        categoryCode: filters.categoryCode,
      };
    }

    // 사용자 ID 필터
    if (filters.userId) {
      where.userId = filters.userId;
    }

    // 챌린지 참여 ID 필터
    if (filters.userChallengeId) {
      where.userChallengeId = filters.userChallengeId;
    }

    // 날짜 범위 필터
    if (filters.startDate || filters.endDate) {
      where.createdAt = {};
      if (filters.startDate) {
        where.createdAt.gte = new Date(filters.startDate);
      }
      if (filters.endDate) {
        where.createdAt.lte = new Date(filters.endDate + 'T23:59:59.999Z');
      }
    }

    // 테스터 제외 필터
    if (filters.excludeTesters) {
      where.user = {
        ...where.user,
        isTester: false,
      };
    }

    // 검색어 필터 (사용자 이름, 이메일)
    if (filters.search) {
      where.user = {
        ...where.user,
        OR: [
          { name: { contains: filters.search, mode: 'insensitive' } },
          { email: { contains: filters.search, mode: 'insensitive' } },
        ],
      };
    }

    // 정렬 조건
    const orderBy: any = {};
    if (sort.sortBy === 'userName') {
      orderBy.user = { name: sort.sortOrder };
    } else if (sort.sortBy === 'questionText') {
      orderBy.surveyQuestion = { questionText: sort.sortOrder };
    } else {
      orderBy[sort.sortBy] = sort.sortOrder;
    }

    const [answers, total] = await Promise.all([
      this.prisma.surveyAnswer.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          user: {
            select: {
              id: true,
              name: true,
              email: true,
              mobile: true,
            },
          },
          surveyQuestion: {
            select: {
              id: true,
              category: true,
              categoryCode: true,
              questionText: true,
              sortOrder: true,
              survey: {
                select: {
                  id: true,
                  name: true,
                  type: true,
                },
              },
            },
          },
          surveyOption: {
            select: {
              id: true,
              optionText: true,
              score: true,
            },
          },
          userChallenge: {
            select: {
              id: true,
              product: {
                select: {
                  id: true,
                  name: true,
                },
              },
            },
          },
        },
      }),
      this.prisma.surveyAnswer.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    this.logger.log(`페이징 처리된 설문 답변 목록 조회 완료 - 총 ${total}개, ${totalPages} 페이지`);

    return {
      items: answers,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * 설문 답변 통계 조회
   *
   * @param surveyId 설문 ID
   * @param type 설문 타입 (before/after)
   * @param excludeTesters 테스터 제외 여부
   * @returns 카테고리별, 질문별 답변 통계
   */
  async getAnswerStatistics(surveyId: number, type?: string, excludeTesters: boolean = false): Promise<any> {
    this.logger.log(`설문 답변 통계 조회 - surveyId: ${surveyId}, type: ${type || '전체'}, excludeTesters: ${excludeTesters}`);

    // 설문 정보 조회
    const survey = await this.prisma.survey.findUnique({
      where: { id: surveyId },
      include: {
        surveyQuestions: {
          where: { isActive: true },
          orderBy: [
            { categoryCode: 'asc' },
            { sortOrder: 'asc' },
          ],
        },
      },
    });

    if (!survey) {
      throw new NotFoundException(`설문을 찾을 수 없습니다: ${surveyId}`);
    }

    // 전체 옵션 조회
    const options = await this.prisma.surveyOption.findMany({
      where: { isActive: true },
      orderBy: { score: 'asc' },
    });

    // 답변 통계 조회
    const whereCondition: any = {
      surveyQuestion: { surveyId },
    };
    if (type) {
      whereCondition.type = type;
    }
    if (excludeTesters) {
      whereCondition.user = { isTester: false };
    }

    const answers = await this.prisma.surveyAnswer.groupBy({
      by: ['surveyQuestionId', 'surveyOptionId'],
      where: whereCondition,
      _count: {
        id: true,
      },
    });

    // 총 응답자 수 (유니크 사용자 기준)
    const uniqueRespondents = await this.prisma.surveyAnswer.findMany({
      where: whereCondition,
      select: { userId: true },
      distinct: ['userId'],
    });
    const totalRespondents = uniqueRespondents.length;

    // 카테고리별 그룹화
    const categoryGroups: { [key: string]: any[] } = {};
    survey.surveyQuestions.forEach((question) => {
      if (!categoryGroups[question.categoryCode]) {
        categoryGroups[question.categoryCode] = [];
      }
      categoryGroups[question.categoryCode].push(question);
    });

    // 통계 데이터 구성
    const statistics = Object.entries(categoryGroups).map(([categoryCode, questions]) => {
      const categoryName = questions[0]?.category || categoryCode;

      const questionStats = questions.map((question) => {
        const questionAnswers = answers.filter((a) => a.surveyQuestionId === question.id);
        const totalAnswers = questionAnswers.reduce((sum, a) => sum + a._count.id, 0);

        const optionStats = options.map((option) => {
          const answerCount = questionAnswers.find((a) => a.surveyOptionId === option.id)?._count.id || 0;
          return {
            optionId: option.id,
            optionText: option.optionText,
            score: option.score,
            count: answerCount,
            percentage: totalAnswers > 0 ? Math.round((answerCount / totalAnswers) * 100 * 10) / 10 : 0,
          };
        });

        // 평균 점수 계산
        const totalScore = questionAnswers.reduce((sum, a) => {
          const option = options.find((o) => o.id === a.surveyOptionId);
          return sum + (option?.score || 0) * a._count.id;
        }, 0);
        const averageScore = totalAnswers > 0 ? Math.round((totalScore / totalAnswers) * 10) / 10 : 0;

        return {
          questionId: question.id,
          questionText: question.questionText,
          sortOrder: question.sortOrder,
          totalAnswers,
          averageScore,
          options: optionStats,
        };
      });

      // 카테고리 평균 점수
      const categoryTotalScore = questionStats.reduce((sum, q) => sum + q.averageScore, 0);
      const categoryAverageScore = questionStats.length > 0
        ? Math.round((categoryTotalScore / questionStats.length) * 10) / 10
        : 0;

      return {
        categoryCode,
        categoryName,
        averageScore: categoryAverageScore,
        questions: questionStats,
      };
    });

    this.logger.log(`설문 답변 통계 조회 완료 - 총 응답자: ${totalRespondents}명`);

    return {
      survey: {
        id: survey.id,
        name: survey.name,
        type: survey.type,
        description: survey.description,
      },
      totalRespondents,
      statistics,
    };
  }

  /**
   * 사용자별 설문 답변 조회
   *
   * @param userId 사용자 ID
   * @param surveyId 설문 ID (선택)
   * @param type 설문 타입 (선택)
   * @returns 사용자의 설문 답변 목록
   */
  async getAnswersByUser(userId: number, surveyId?: number, type?: string): Promise<any> {
    this.logger.log(`사용자별 설문 답변 조회 - userId: ${userId}, surveyId: ${surveyId || '전체'}, type: ${type || '전체'}`);

    const where: any = { userId };

    if (surveyId) {
      where.surveyQuestion = { surveyId };
    }
    if (type) {
      where.type = type;
    }

    const answers = await this.prisma.surveyAnswer.findMany({
      where,
      include: {
        surveyQuestion: {
          include: {
            survey: true,
          },
        },
        surveyOption: true,
        userChallenge: {
          include: {
            product: {
              select: {
                id: true,
                name: true,
              },
            },
          },
        },
      },
      orderBy: [
        { surveyQuestion: { surveyId: 'asc' } },
        { surveyQuestion: { categoryCode: 'asc' } },
        { surveyQuestion: { sortOrder: 'asc' } },
      ],
    });

    // 설문별로 그룹화
    const groupedBySurvey: { [key: number]: any } = {};

    answers.forEach((answer) => {
      const survey = answer.surveyQuestion.survey;
      if (!survey) return;

      if (!groupedBySurvey[survey.id]) {
        groupedBySurvey[survey.id] = {
          survey: {
            id: survey.id,
            name: survey.name,
            type: survey.type,
          },
          answers: [],
          totalScore: 0,
        };
      }

      groupedBySurvey[survey.id].answers.push({
        answerId: answer.id,
        questionId: answer.surveyQuestionId,
        category: answer.surveyQuestion.category,
        categoryCode: answer.surveyQuestion.categoryCode,
        questionText: answer.surveyQuestion.questionText,
        optionText: answer.surveyOption.optionText,
        score: answer.surveyOption.score,
        type: answer.type,
        createdAt: answer.createdAt,
        userChallengeId: answer.userChallengeId,
        challengeName: answer.userChallenge?.product?.name,
      });

      groupedBySurvey[survey.id].totalScore += answer.surveyOption.score;
    });

    const result = Object.values(groupedBySurvey);

    this.logger.log(`사용자별 설문 답변 조회 완료 - 설문 수: ${result.length}개`);

    return result;
  }

  /**
   * 챌린지별 설문 답변 조회
   *
   * @param userChallengeId 사용자 챌린지 ID
   * @returns 해당 챌린지의 사전/사후 설문 답변
   */
  async getAnswersByChallenge(userChallengeId: number): Promise<any> {
    this.logger.log(`챌린지별 설문 답변 조회 - userChallengeId: ${userChallengeId}`);

    const answers = await this.prisma.surveyAnswer.findMany({
      where: { userChallengeId },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        surveyQuestion: {
          include: {
            survey: true,
          },
        },
        surveyOption: true,
      },
      orderBy: [
        { type: 'asc' },
        { surveyQuestion: { categoryCode: 'asc' } },
        { surveyQuestion: { sortOrder: 'asc' } },
      ],
    });

    // 사전/사후로 분리
    const beforeAnswers = answers.filter((a) => a.type === 'before' || a.type === 'BEFORE');
    const afterAnswers = answers.filter((a) => a.type === 'after' || a.type === 'AFTER');

    const formatAnswers = (answerList: any[]) => {
      // 카테고리별 그룹화
      const categoryGroups: { [key: string]: any[] } = {};

      answerList.forEach((answer) => {
        const categoryCode = answer.surveyQuestion.categoryCode;
        if (!categoryGroups[categoryCode]) {
          categoryGroups[categoryCode] = [];
        }
        categoryGroups[categoryCode].push({
          questionId: answer.surveyQuestionId,
          questionText: answer.surveyQuestion.questionText,
          category: answer.surveyQuestion.category,
          optionText: answer.surveyOption.optionText,
          score: answer.surveyOption.score,
          createdAt: answer.createdAt,
        });
      });

      const categories = Object.entries(categoryGroups).map(([code, items]) => ({
        categoryCode: code,
        categoryName: items[0]?.category || code,
        totalScore: items.reduce((sum, item) => sum + item.score, 0),
        answers: items,
      }));

      return {
        totalScore: answerList.reduce((sum, a) => sum + a.surveyOption.score, 0),
        categories,
      };
    };

    const user = answers[0]?.user;

    this.logger.log(`챌린지별 설문 답변 조회 완료 - 사전: ${beforeAnswers.length}개, 사후: ${afterAnswers.length}개`);

    return {
      userChallengeId,
      user: user ? {
        id: user.id,
        name: user.name,
        email: user.email,
      } : null,
      before: formatAnswers(beforeAnswers),
      after: formatAnswers(afterAnswers),
      comparison: beforeAnswers.length > 0 && afterAnswers.length > 0 ? {
        beforeTotalScore: beforeAnswers.reduce((sum, a) => sum + a.surveyOption.score, 0),
        afterTotalScore: afterAnswers.reduce((sum, a) => sum + a.surveyOption.score, 0),
        scoreDifference: afterAnswers.reduce((sum, a) => sum + a.surveyOption.score, 0) - beforeAnswers.reduce((sum, a) => sum + a.surveyOption.score, 0),
      } : null,
    };
  }

  /**
   * 질문 수정
   *
   * @param id 질문 ID
   * @param updateData 수정할 데이터
   * @returns 수정된 질문
   */
  async updateQuestion(
    id: number,
    updateData: Partial<{
      category: string;
      categoryCode: string;
      questionText: string;
      sortOrder: number;
      isActive: boolean;
    }>
  ): Promise<any> {
    this.logger.log(`질문 수정 - ID: ${id}`);

    const question = await this.prisma.surveyQuestion.findUnique({
      where: { id },
    });

    if (!question) {
      throw new NotFoundException(`질문을 찾을 수 없습니다: ${id}`);
    }

    const updated = await this.prisma.surveyQuestion.update({
      where: { id },
      data: updateData,
      include: {
        survey: true,
      },
    });

    this.logger.log(`질문 수정 완료 - ID: ${id}`);
    return updated;
  }

  /**
   * 질문 삭제
   *
   * @param id 질문 ID
   */
  async deleteQuestion(id: number): Promise<void> {
    this.logger.log(`질문 삭제 - ID: ${id}`);

    const question = await this.prisma.surveyQuestion.findUnique({
      where: { id },
      include: {
        surveyAnswers: true,
      },
    });

    if (!question) {
      throw new NotFoundException(`질문을 찾을 수 없습니다: ${id}`);
    }

    if (question.surveyAnswers.length > 0) {
      throw new ConflictException(`답변이 존재하는 질문은 삭제할 수 없습니다. (답변 수: ${question.surveyAnswers.length})`);
    }

    await this.prisma.surveyQuestion.delete({
      where: { id },
    });

    this.logger.log(`질문 삭제 완료 - ID: ${id}`);
  }

  /**
   * 선택지 목록 조회 (페이징)
   *
   * @param page 페이지 번호
   * @param limit 페이지당 항목 수
   * @returns 선택지 목록
   */
  async getOptionsWithPagination(
    page: number,
    limit: number
  ): Promise<PaginatedResult<any>> {
    this.logger.log(`선택지 목록 조회 - page: ${page}, limit: ${limit}`);

    const skip = (page - 1) * limit;

    const [options, total] = await Promise.all([
      this.prisma.surveyOption.findMany({
        skip,
        take: limit,
        orderBy: { score: 'asc' },
      }),
      this.prisma.surveyOption.count(),
    ]);

    const totalPages = Math.ceil(total / limit);

    this.logger.log(`선택지 목록 조회 완료 - 총 ${total}개`);

    return {
      items: options,
      total,
      page,
      limit,
      totalPages,
    };
  }

  /**
   * 질문 목록 조회 (페이징 및 필터링)
   *
   * @param page 페이지 번호
   * @param limit 페이지당 항목 수
   * @param filters 필터 조건
   * @param sort 정렬 조건
   * @returns 질문 목록
   */
  async getQuestionsWithPagination(
    page: number,
    limit: number,
    filters: {
      surveyId?: number;
      categoryCode?: string;
      isActive?: boolean;
      search?: string;
    },
    sort: {
      sortBy: string;
      sortOrder: 'asc' | 'desc';
    }
  ): Promise<PaginatedResult<any>> {
    this.logger.log(`질문 목록 조회 - page: ${page}, limit: ${limit}`);

    const skip = (page - 1) * limit;

    const where: any = {};

    if (filters.surveyId !== undefined) {
      where.surveyId = filters.surveyId;
    }

    if (filters.categoryCode) {
      where.categoryCode = filters.categoryCode;
    }

    if (filters.isActive !== undefined) {
      where.isActive = filters.isActive;
    }

    if (filters.search) {
      where.OR = [
        { questionText: { contains: filters.search, mode: 'insensitive' } },
        { category: { contains: filters.search, mode: 'insensitive' } },
      ];
    }

    const orderBy: any = {};
    orderBy[sort.sortBy] = sort.sortOrder;

    const [questions, total] = await Promise.all([
      this.prisma.surveyQuestion.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          survey: {
            select: {
              id: true,
              name: true,
              type: true,
            },
          },
          _count: {
            select: {
              surveyAnswers: true,
            },
          },
        },
      }),
      this.prisma.surveyQuestion.count({ where }),
    ]);

    const totalPages = Math.ceil(total / limit);

    this.logger.log(`질문 목록 조회 완료 - 총 ${total}개`);

    return {
      items: questions,
      total,
      page,
      limit,
      totalPages,
    };
  }
}