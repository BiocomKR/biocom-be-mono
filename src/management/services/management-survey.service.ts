import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { Survey, SurveyQuestion } from '@prisma/client';
import { PaginationHelper, PaginatedResult } from '../../common/utils/pagination.util';

/**
 * Management 설문 관리 서비스
 * 백오피스에서 설문 생성, 수정, 삭제, 질문 관리 등을 담당
 */
@Injectable()
export class ManagementSurveyService {
  private readonly logger = new Logger(ManagementSurveyService.name);

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
}