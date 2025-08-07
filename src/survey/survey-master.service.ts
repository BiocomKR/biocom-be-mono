import { Injectable, Logger, NotFoundException, ConflictException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { Survey, SurveyQuestion } from '@prisma/client';

/**
 * 설문 마스터 관리 서비스
 * 설문 세트와 질문들을 관리하는 서비스
 */
@Injectable()
export class SurveyMasterService {
  private readonly logger = new Logger(SurveyMasterService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 모든 설문 목록 조회
   * 
   * @returns 설문 목록
   */
  async findAllSurveys(): Promise<Survey[]> {
    this.logger.log('모든 설문 목록 조회');
    
    const surveys = await this.prisma.survey.findMany({
      orderBy: { createdAt: 'desc' },
    });
    
    this.logger.log(`설문 목록 조회 완료 - 총 ${surveys.length}개`);
    return surveys;
  }

  /**
   * 특정 설문 상세 조회 (질문 포함)
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
   * 새로운 설문 생성
   * 
   * @param data 설문 생성 데이터
   * @returns 생성된 설문
   */
  async createSurvey(data: {
    name: string;
    description?: string;
  }): Promise<Survey> {
    this.logger.log(`새로운 설문 생성 - ${data.name}`);
    
    // 중복 체크
    const existing = await this.prisma.survey.findFirst({
      where: { name: data.name }
    });
    
    if (existing) {
      throw new ConflictException(`이미 동일한 이름의 설문이 존재합니다: ${data.name}`);
    }
    
    const survey = await this.prisma.survey.create({
      data: {
        name: data.name,
        description: data.description,
        isActive: true
      }
    });
    
    this.logger.log(`설문 생성 완료 - ID: ${survey.id}`);
    return survey;
  }

  /**
   * 설문 수정
   * 
   * @param id 설문 ID
   * @param data 수정할 데이터
   * @returns 수정된 설문
   */
  async updateSurvey(id: number, data: {
    name?: string;
    description?: string;
    isActive?: boolean;
  }): Promise<Survey> {
    this.logger.log(`설문 수정 - ID: ${id}`);
    
    const existing = await this.prisma.survey.findUnique({
      where: { id }
    });
    
    if (!existing) {
      throw new NotFoundException(`ID ${id}에 해당하는 설문을 찾을 수 없습니다.`);
    }
    
    const survey = await this.prisma.survey.update({
      where: { id },
      data
    });
    
    this.logger.log(`설문 수정 완료 - ID: ${survey.id}`);
    return survey;
  }

  /**
   * 설문에 질문 추가
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
   * 설문 삭제
   * 
   * @param id 설문 ID
   */
  async deleteSurvey(id: number): Promise<void> {
    this.logger.log(`설문 삭제 - ID: ${id}`);
    
    // 이벤트와 연결된 설문인지 확인
    const connectedEvents = await this.prisma.eventSurvey.findFirst({
      where: { surveyId: id }
    });
    
    if (connectedEvents) {
      throw new ConflictException('이벤트와 연결된 설문은 삭제할 수 없습니다.');
    }
    
    // 설문에 연결된 질문들의 surveyId를 null로 설정
    await this.prisma.surveyQuestion.updateMany({
      where: { surveyId: id },
      data: { surveyId: null }
    });
    
    // 설문 삭제
    await this.prisma.survey.delete({
      where: { id }
    });
    
    this.logger.log(`설문 삭제 완료`);
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