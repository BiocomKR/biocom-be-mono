// import { Injectable, Logger, NotFoundException, ConflictException, BadRequestException } from '@nestjs/common';
// import { PrismaService } from '../common/services/prisma.service';
// import { CreateSurveyQuestionDto } from './dto/create-survey-question.dto';
// import { CreateSurveyOptionDto } from './dto/create-survey-option.dto';
// import { CreateSurveyAnswerDto } from './dto/create-survey-answer.dto';
// import {
//   SurveyQuestionResponseDto,
//   SurveyOptionResponseDto,
//   SurveyAnswerResponseDto,
// } from './dto/survey-response.dto';
// import { SurveyResultResponseDto, SurveyComparisonResponseDto } from './dto/survey-result-response.dto';
// import { SurveyStatusResponseDto } from './dto/survey-status-response.dto';

// /**
//  * 설문 관리 서비스 클래스
//  * 설문 질문, 선택지, 답변과 관련된 모든 비즈니스 로직을 처리
//  * 
//  * 주요 기능:
//  * - 설문 질문 생성, 조회, 수정, 삭제
//  * - 설문 선택지 생성, 조회, 수정, 삭제
//  * - 사용자 설문 답변 생성, 조회, 분석
//  * - 사전/사후 설문 구분 관리
//  * - 상세한 로깅 및 예외 처리
//  */
// @Injectable()
// export class SurveyService {
//   private readonly logger = new Logger(SurveyService.name);
//   private readonly CHALLENGE_DURATION_DAYS = 180; // 사후 설문까지 필요한 일수
//   private readonly AFTER_SURVEY_OPEN_DATE = '2026-02-18'; // After 설문이 열리는 날짜

//   constructor(private readonly prisma: PrismaService) {}

//   // ==================== 설문 질문 관련 메서드 ====================

//   /**
//    * 새로운 설문 질문 생성
//    * 
//    * @param createSurveyQuestionDto 설문 질문 생성 데이터
//    * @returns Promise<SurveyQuestionResponseDto> 생성된 설문 질문 정보
//    */
//   async createQuestion(
//     createSurveyQuestionDto: CreateSurveyQuestionDto,
//   ): Promise<SurveyQuestionResponseDto> {
//     this.logger.log(`새로운 설문 질문 생성 시도: ${createSurveyQuestionDto.questionText}`);

//     try {
//       const newQuestion = await this.prisma.surveyQuestion.create({
//         data: {
//           category: createSurveyQuestionDto.category,
//           categoryCode: createSurveyQuestionDto.categoryCode,
//           questionText: createSurveyQuestionDto.questionText,
//           sortOrder: createSurveyQuestionDto.sortOrder,
//         },
//         // Note: Options are managed separately in survey_options table
//       });

//       this.logger.log(`설문 질문 생성 완료 - ID: ${newQuestion.id}`);

//       return {
//         id: newQuestion.id,
//         category: newQuestion.category,
//         categoryCode: newQuestion.categoryCode,
//         questionText: newQuestion.questionText,
//         sortOrder: newQuestion.sortOrder,
//         createdAt: newQuestion.createdAt,
//         updatedAt: newQuestion.updatedAt,
//         // Options are now managed separately in survey_options table
//       };
//     } catch (error) {
//       this.logger.error(`설문 질문 생성 중 오류 발생: ${createSurveyQuestionDto.questionText}`, error);
//       throw error;
//     }
//   }

//   /**
//    * 설문 질문 조회 (카테고리 필터링 가능)
//    * 
//    * @param categoryCode 카테고리 코드 (선택사항)
//    * @returns Promise<SurveyQuestionResponseDto[]> 설문 질문 목록
//    */
//   async findQuestions(categoryCode?: string): Promise<SurveyQuestionResponseDto[]> {
//     this.logger.log(`설문 질문 조회 시도 - 카테고리: ${categoryCode || '전체'}`);

//     try {
//       // 카테고리 코드 유효성 검증
//       if (categoryCode) {
//         const validCategories = ['SKIN_HEALTH', 'METABOLISM', 'IMMUNE_BALANCE', 'GUT_HEALTH'];
//         if (!validCategories.includes(categoryCode)) {
//           this.logger.warn(`유효하지 않은 카테고리 코드: ${categoryCode}`);
//           throw new BadRequestException(`유효하지 않은 카테고리 코드입니다. 사용 가능한 카테고리: ${validCategories.join(', ')}`);
//         }
//       }

//       const whereCondition = categoryCode ? { categoryCode } : {};
      
//       const questions = await this.prisma.surveyQuestion.findMany({
//         where: whereCondition,
//         // Note: Options are managed separately
//         orderBy: [
//           { categoryCode: 'asc' },
//           { sortOrder: 'asc' },
//         ],
//       });

//       this.logger.log(`설문 질문 조회 완료 - 카테고리: ${categoryCode || '전체'}, 총 ${questions.length}개`);

//       return questions.map(question => ({
//         id: question.id,
//         category: question.category,
//         categoryCode: question.categoryCode,
//         questionText: question.questionText,
//         sortOrder: question.sortOrder,
//         createdAt: question.createdAt,
//         updatedAt: question.updatedAt,
//         // Options are now managed through OptionMaster
//       }));
//     } catch (error) {
//       this.logger.error(`설문 질문 조회 중 오류 발생 - 카테고리: ${categoryCode}`, error);
//       throw error;
//     }
//   }

//   /**
//    * 모든 설문 질문 조회 (선택지 포함) - 기존 메서드 유지
//    * 
//    * @returns Promise<SurveyQuestionResponseDto[]> 모든 설문 질문 목록
//    */
//   async findAllQuestions(): Promise<SurveyQuestionResponseDto[]> {
//     return this.findQuestions(); // 새로운 메서드로 위임
//   }

//   /**
//    * 특정 설문 질문 조회 (선택지 포함)
//    * 
//    * @param id 설문 질문 ID
//    * @returns Promise<SurveyQuestionResponseDto> 설문 질문 정보
//    * @throws {NotFoundException} 질문을 찾을 수 없을 때 발생
//    */
//   async findOneQuestion(id: number): Promise<SurveyQuestionResponseDto> {
//     this.logger.log(`설문 질문 조회 시도 - ID: ${id}`);

//     try {
//       const question = await this.prisma.surveyQuestion.findUnique({
//         where: { id },
//         // Note: Options are managed separately
//       });

//       if (!question) {
//         this.logger.warn(`존재하지 않는 설문 질문 조회 시도 - ID: ${id}`);
//         throw new NotFoundException(`ID ${id}에 해당하는 설문 질문을 찾을 수 없습니다.`);
//       }

//       this.logger.log(`설문 질문 조회 완료 - ID: ${question.id}`);

//       return {
//         id: question.id,
//         category: question.category,
//         categoryCode: question.categoryCode,
//         questionText: question.questionText,
//         sortOrder: question.sortOrder,
//         createdAt: question.createdAt,
//         updatedAt: question.updatedAt,
//         // Options are now managed through OptionMaster
//       };
//     } catch (error) {
//       this.logger.error(`설문 질문 조회 중 오류 발생 - ID: ${id}`, error);
//       throw error;
//     }
//   }

//   // ==================== 설문 선택지 관련 메서드 ====================

//   /**
//    * 새로운 설문 선택지 생성 (Deprecated - 공통 선택지 사용)
//    * 
//    * @param createSurveyOptionDto 설문 선택지 생성 데이터
//    * @returns Promise<SurveyOptionResponseDto> 생성된 설문 선택지 정보
//    * @deprecated 공통 survey_options 테이블을 사용합니다
//    */
//   async createOption(createSurveyOptionDto: CreateSurveyOptionDto): Promise<SurveyOptionResponseDto> {
//     this.logger.log(`설문 선택지 생성 - 공통 survey_options 사용`);

//     try {
//       // survey_options는 surveyQuestionId를 가지지 않으므로 optionText와 score만 사용
//       const newOption = await this.prisma.surveyOption.create({
//         data: {
//           optionText: createSurveyOptionDto.optionText,
//           score: createSurveyOptionDto.score,
//         },
//       });

//       this.logger.log(`SurveyOption 생성 완료 - ID: ${newOption.id}`);

//       return {
//         id: newOption.id,
//         surveyQuestionId: createSurveyOptionDto.surveyQuestionId, // 호환성을 위해 유지
//         optionText: newOption.optionText,
//         score: newOption.score,
//         createdAt: newOption.createdAt,
//         updatedAt: newOption.createdAt, // SurveyOption doesn't have updatedAt field
//       };
//     } catch (error) {
//       this.logger.error(`SurveyOption 생성 중 오류 발생`, error);
//       throw error;
//     }
//   }

//   // ==================== 설문 답변 관련 메서드 ====================

//   /**
//    * 새로운 설문 답변 생성
//    * 
//    * @param createSurveyAnswerDto 설문 답변 생성 데이터
//    * @returns Promise<SurveyAnswerResponseDto> 생성된 설문 답변 정보
//    * @throws {NotFoundException} 사용자, 질문, 선택지를 찾을 수 없을 때 발생
//    * @throws {ConflictException} 동일한 질문에 이미 답변이 존재할 때 발생
//    * @throws {BadRequestException} 선택지가 질문과 매치되지 않을 때 발생
//    */
//   async createAnswer(createSurveyAnswerDto: CreateSurveyAnswerDto): Promise<SurveyAnswerResponseDto> {
//     this.logger.log(`새로운 설문 답변 생성 시도 - 사용자 ID: ${createSurveyAnswerDto.userId}`);

//     try {
//       // 사용자 존재 여부 확인
//       const existingUser = await this.prisma.user.findUnique({
//         where: { id: createSurveyAnswerDto.userId },
//       });

//       if (!existingUser) {
//         this.logger.warn(`존재하지 않는 사용자의 답변 생성 시도 - 사용자 ID: ${createSurveyAnswerDto.userId}`);
//         throw new NotFoundException(`ID ${createSurveyAnswerDto.userId}에 해당하는 사용자를 찾을 수 없습니다.`);
//       }

//       // after 설문 답변인 경우, 21일 경과 여부 확인
//       if (createSurveyAnswerDto.type === 'after') {
//         // before 설문 결과 조회
//         const beforeResult = await this.prisma.surveyResult.findUnique({
//           where: {
//             userId_type: {
//               userId: createSurveyAnswerDto.userId,
//               type: 'before',
//             },
//           },
//         });

//         if (!beforeResult) {
//           this.logger.warn(`before 설문을 먼저 완료해야 함 - 사용자 ID: ${createSurveyAnswerDto.userId}`);
//           throw new BadRequestException('사전 설문을 먼저 완료해주세요.');
//         }

//         // After 설문 오픈일 체크
//         const today = new Date().toISOString().split('T')[0];
//         if (today >= this.AFTER_SURVEY_OPEN_DATE) {
//           this.logger.log(`After 설문 오픈일(${this.AFTER_SURVEY_OPEN_DATE}) 이상: 21일 체크 무시 - 사용자 ID: ${createSurveyAnswerDto.userId}`);
//         } else {
//           // before 설문 완료 후 경과일 계산
//           const daysSinceBeforeSurvey = Math.floor(
//             (new Date().getTime() - beforeResult.calculatedAt.getTime()) / (1000 * 60 * 60 * 24)
//           );

//           if (daysSinceBeforeSurvey < this.CHALLENGE_DURATION_DAYS) {
//             const daysRemaining = this.CHALLENGE_DURATION_DAYS - daysSinceBeforeSurvey;
//             this.logger.warn(`21일이 경과하지 않음 - 사용자 ID: ${createSurveyAnswerDto.userId}, 경과일: ${daysSinceBeforeSurvey}, 남은 일수: ${daysRemaining}`);
//             throw new BadRequestException(
//               `아직 사후 설문을 진행할 수 없습니다. ${daysRemaining}일 후에 진행 가능합니다. (현재 ${daysSinceBeforeSurvey}일째)`
//             );
//           }
//         }
//       }

//       // 질문 존재 여부 확인
//       const existingQuestion = await this.prisma.surveyQuestion.findUnique({
//         where: { id: createSurveyAnswerDto.surveyQuestionId },
//       });

//       if (!existingQuestion) {
//         this.logger.warn(`존재하지 않는 질문에 대한 답변 생성 시도 - 질문 ID: ${createSurveyAnswerDto.surveyQuestionId}`);
//         throw new NotFoundException(`ID ${createSurveyAnswerDto.surveyQuestionId}에 해당하는 설문 질문을 찾을 수 없습니다.`);
//       }

//       // 선택지 존재 여부 확인
//       const existingOption = await this.prisma.surveyOption.findUnique({
//         where: { id: createSurveyAnswerDto.surveyOptionId },
//       });

//       if (!existingOption) {
//         this.logger.warn(`존재하지 않는 선택지 선택 시도 - 선택지 ID: ${createSurveyAnswerDto.surveyOptionId}`);
//         throw new NotFoundException(`ID ${createSurveyAnswerDto.surveyOptionId}에 해당하는 설문 선택지를 찾을 수 없습니다.`);
//       }

//       // 중복 답변 확인 (동일 사용자, 동일 질문, 동일 타입)
//       const existingAnswer = await this.prisma.surveyAnswer.findUnique({
//         where: {
//           userId_surveyQuestionId_type: {
//             userId: createSurveyAnswerDto.userId,
//             surveyQuestionId: createSurveyAnswerDto.surveyQuestionId,
//             type: createSurveyAnswerDto.type,
//           },
//         },
//       });

//       if (existingAnswer) {
//         this.logger.warn(`중복 답변 생성 시도 - 사용자 ID: ${createSurveyAnswerDto.userId}, 질문 ID: ${createSurveyAnswerDto.surveyQuestionId}, 타입: ${createSurveyAnswerDto.type}`);
//         throw new ConflictException('이미 해당 질문에 답변하셨습니다.');
//       }

//       const newAnswer = await this.prisma.surveyAnswer.create({
//         data: {
//           userId: createSurveyAnswerDto.userId,
//           surveyOptionId: createSurveyAnswerDto.surveyOptionId,
//           surveyQuestionId: createSurveyAnswerDto.surveyQuestionId,
//           type: createSurveyAnswerDto.type,
//         },
//       });

//       this.logger.log(`설문 답변 생성 완료 - ID: ${newAnswer.id}`);

//       return {
//         id: newAnswer.id,
//         userId: newAnswer.userId,
//         surveyOptionId: newAnswer.surveyOptionId,
//         surveyQuestionId: newAnswer.surveyQuestionId,
//         type: newAnswer.type,
//         createdAt: newAnswer.createdAt,
//         updatedAt: newAnswer.updatedAt,
//       };
//     } catch (error) {
//       this.logger.error(`설문 답변 생성 중 오류 발생 - 사용자 ID: ${createSurveyAnswerDto.userId}`, error);
//       throw error;
//     }
//   }

//   /**
//    * 특정 사용자의 설문 답변 조회
//    * 
//    * @param userId 사용자 ID
//    * @param type 설문 타입 ('before' 또는 'after', 선택적)
//    * @returns Promise<SurveyAnswerResponseDto[]> 사용자의 설문 답변 목록
//    */
//   async findAnswersByUser(userId: number, type?: 'before' | 'after'): Promise<SurveyAnswerResponseDto[]> {
//     this.logger.log(`사용자의 설문 답변 조회 시도 - 사용자 ID: ${userId}, 타입: ${type || '전체'}`);

//     try {
//       const answers = await this.prisma.surveyAnswer.findMany({
//         where: {
//           userId,
//           ...(type && { type }),
//         },
//         orderBy: { createdAt: 'desc' },
//       });

//       this.logger.log(`사용자 설문 답변 조회 완료 - 사용자 ID: ${userId}, 답변 수: ${answers.length}`);

//       return answers.map(answer => ({
//         id: answer.id,
//         userId: answer.userId,
//         surveyOptionId: answer.surveyOptionId,
//         surveyQuestionId: answer.surveyQuestionId,
//         type: answer.type,
//         createdAt: answer.createdAt,
//         updatedAt: answer.updatedAt,
//       }));
//     } catch (error) {
//       this.logger.error(`사용자 설문 답변 조회 중 오류 발생 - 사용자 ID: ${userId}`, error);
//       throw error;
//     }
//   }

//   /**
//    * 특정 질문에 대한 모든 답변 조회
//    * 
//    * @param questionId 질문 ID
//    * @param type 설문 타입 ('before' 또는 'after', 선택적)
//    * @returns Promise<SurveyAnswerResponseDto[]> 질문에 대한 모든 답변 목록
//    */
//   async findAnswersByQuestion(questionId: number, type?: 'before' | 'after'): Promise<SurveyAnswerResponseDto[]> {
//     this.logger.log(`질문의 모든 답변 조회 시도 - 질문 ID: ${questionId}, 타입: ${type || '전체'}`);

//     try {
//       const answers = await this.prisma.surveyAnswer.findMany({
//         where: {
//           surveyQuestionId: questionId,
//           ...(type && { type }),
//         },
//         orderBy: { createdAt: 'desc' },
//       });

//       this.logger.log(`질문 답변 조회 완료 - 질문 ID: ${questionId}, 답변 수: ${answers.length}`);

//       return answers.map(answer => ({
//         id: answer.id,
//         userId: answer.userId,
//         surveyOptionId: answer.surveyOptionId,
//         surveyQuestionId: answer.surveyQuestionId,
//         type: answer.type,
//         createdAt: answer.createdAt,
//         updatedAt: answer.updatedAt,
//       }));
//     } catch (error) {
//       this.logger.error(`질문 답변 조회 중 오류 발생 - 질문 ID: ${questionId}`, error);
//       throw error;
//     }
//   }

//   // ==================== 설문 결과 관련 메서드 ====================

//   /**
//    * 사용자의 설문 결과 계산 및 저장
//    * 
//    * @param userId 사용자 ID
//    * @param type 설문 타입 ('before' 또는 'after')
//    * @returns Promise<SurveyResultResponseDto> 계산된 설문 결과
//    */
//   async calculateAndSaveResult(userId: number, type: 'before' | 'after'): Promise<SurveyResultResponseDto> {
//     this.logger.log(`설문 결과 계산 시작 - 사용자 ID: ${userId}, 타입: ${type}`);

//     try {
//       // after 설문인 경우, 21일 경과 여부 확인
//       if (type === 'after') {
//         // before 설문 결과 조회
//         const beforeResult = await this.prisma.surveyResult.findUnique({
//           where: {
//             userId_type: {
//               userId,
//               type: 'before',
//             },
//           },
//         });

//         if (!beforeResult) {
//           this.logger.warn(`before 설문을 먼저 완료해야 함 - 사용자 ID: ${userId}`);
//           throw new BadRequestException('사전 설문을 먼저 완료해주세요.');
//         }

//         const afterToday = new Date().toISOString().split('T')[0];
//         if (afterToday >= this.AFTER_SURVEY_OPEN_DATE) {
//           this.logger.log(`After 설문 오픈일(${this.AFTER_SURVEY_OPEN_DATE}) 이상: 21일 체크 무시 - 사용자 ID: ${userId}`);
//         } else {
//           const daysSinceBeforeSurvey = Math.floor(
//             (new Date().getTime() - beforeResult.calculatedAt.getTime()) / (1000 * 60 * 60 * 24)
//           );

//           if (daysSinceBeforeSurvey < this.CHALLENGE_DURATION_DAYS) {
//             const daysRemaining = this.CHALLENGE_DURATION_DAYS - daysSinceBeforeSurvey;
//             this.logger.warn(`21일이 경과하지 않음 - 사용자 ID: ${userId}, 경과일: ${daysSinceBeforeSurvey}, 남은 일수: ${daysRemaining}`);
//             throw new BadRequestException(
//               `아직 사후 설문을 진행할 수 없습니다. ${daysRemaining}일 후에 진행 가능합니다. (현재 ${daysSinceBeforeSurvey}일째)`
//             );
//           }
//         }
//       }

//       // 사용자의 모든 답변 조회 (선택지 정보와 질문 정보 포함)
//       const userAnswers = await this.prisma.surveyAnswer.findMany({
//         where: {
//           userId,
//           type,
//         },
//         include: {
//           surveyOption: true,
//           surveyQuestion: true,
//         },
//       });

//       if (userAnswers.length === 0) {
//         this.logger.warn(`설문 답변이 없음 - 사용자 ID: ${userId}, 타입: ${type}`);
//         throw new NotFoundException(`사용자 ID ${userId}의 ${type} 설문 답변을 찾을 수 없습니다.`);
//       }

//       // 20개 질문 모두 답변했는지 확인
//       if (userAnswers.length !== 20) {
//         this.logger.warn(`설문 답변이 불완전함 - 사용자 ID: ${userId}, 타입: ${type}, 답변 수: ${userAnswers.length}`);
//         throw new BadRequestException(`모든 질문에 답변해주세요. 현재 ${userAnswers.length}/20개 답변 완료`);
//       }

//       // 카테고리별 점수 계산 (시작점: 100점)
//       const categoryScores = {
//         SKIN_HEALTH: 100,
//         METABOLISM: 100,
//         IMMUNE_BALANCE: 100,
//         GUT_HEALTH: 100,
//       };

//       // 카테고리별 답변 수 확인
//       const categoryAnswerCount: Record<string, number> = {
//         SKIN_HEALTH: 0,
//         METABOLISM: 0,
//         IMMUNE_BALANCE: 0,
//         GUT_HEALTH: 0,
//       };

//       // 각 답변의 점수를 카테고리별로 차감
//       userAnswers.forEach(answer => {
//         const categoryCode = answer.surveyQuestion.categoryCode;
//         const score = Math.abs(answer.surveyOption.score); // 음수를 양수로 변환
        
//         if (categoryCode in categoryScores) {
//           categoryScores[categoryCode] -= score;
//           categoryAnswerCount[categoryCode]++;
//         }
//       });

//       // 각 카테고리별로 5개씩 답변했는지 확인
//       for (const [category, count] of Object.entries(categoryAnswerCount)) {
//         if (count !== 5) {
//           this.logger.warn(`카테고리별 답변 수 불일치 - ${category}: ${count}/5`);
//           throw new BadRequestException(`${category} 카테고리의 모든 질문에 답변해주세요. (${count}/5)`);
//         }
//       }

//       // 점수가 음수가 되지 않도록 보정 
//       Object.keys(categoryScores).forEach(key => {
//         if (categoryScores[key] < 0) {
//           this.logger.warn(`음수 점수 발생 - ${key}: ${categoryScores[key]}`);
//           categoryScores[key] = 0;
//         }
//       });

//       // 전체 평균 점수 계산 (반올림 처리)
//       const totalScore = Math.round(
//         (categoryScores.SKIN_HEALTH + 
//          categoryScores.METABOLISM + 
//          categoryScores.IMMUNE_BALANCE + 
//          categoryScores.GUT_HEALTH) / 4
//       );

//       // 우선순위 순서 (동점일 때 적용)
//       const priorityOrder = ['GUT_HEALTH', 'METABOLISM', 'SKIN_HEALTH', 'IMMUNE_BALANCE'];
      
//       // 가장 낮은 점수 찾기
//       const lowestScore = Math.min(
//         categoryScores.SKIN_HEALTH,
//         categoryScores.METABOLISM,
//         categoryScores.IMMUNE_BALANCE,
//         categoryScores.GUT_HEALTH
//       );

//       // 동점인 카테고리들 찾기
//       const lowestCategories = Object.entries(categoryScores)
//         .filter(([_, score]) => score === lowestScore)
//         .map(([category, _]) => category);

//       // 우선순위에 따라 선택
//       let selectedCategory = lowestCategories[0];
//       for (const priority of priorityOrder) {
//         if (lowestCategories.includes(priority)) {
//           selectedCategory = priority;
//           break;
//         }
//       }

//       // DB에서 카테고리 상세 정보 조회
//       const categoryDetail = await this.prisma.categoryDetail.findUnique({
//         where: { categoryCode: selectedCategory }
//       });

//       if (!categoryDetail) {
//         this.logger.error(`카테고리 상세 정보를 찾을 수 없음 - 카테고리: ${selectedCategory}`);
//         throw new Error(`카테고리 ${selectedCategory}의 상세 정보를 찾을 수 없습니다.`);
//       }
      
//       const animal = categoryDetail.animalCharacter;

//       // 기존 결과가 있는지 확인
//       const existingResult = await this.prisma.surveyResult.findUnique({
//         where: {
//           userId_type: {
//             userId,
//             type,
//           },
//         },
//       });

//       // 결과 저장 또는 업데이트
//       const result = await this.prisma.surveyResult.upsert({
//         where: {
//           userId_type: {
//             userId,
//             type,
//           },
//         },
//         update: {
//           skinHealthScore: categoryScores.SKIN_HEALTH,
//           metabolismScore: categoryScores.METABOLISM,
//           immuneBalanceScore: categoryScores.IMMUNE_BALANCE,
//           gutHealthScore: categoryScores.GUT_HEALTH,
//           totalScore,
//           animal,
//           calculatedAt: new Date(),
//         },
//         create: {
//           userId,
//           type,
//           skinHealthScore: categoryScores.SKIN_HEALTH,
//           metabolismScore: categoryScores.METABOLISM,
//           immuneBalanceScore: categoryScores.IMMUNE_BALANCE,
//           gutHealthScore: categoryScores.GUT_HEALTH,
//           totalScore,
//           animal,
//         },
//       });

//       this.logger.log(`설문 결과 ${existingResult ? '업데이트' : '저장'} 완료 - ID: ${result.id}, 동물: ${result.animal}`);

//       return {
//         id: result.id,
//         userId: result.userId,
//         type: result.type,
//         skinHealthScore: result.skinHealthScore,
//         metabolismScore: result.metabolismScore,
//         immuneBalanceScore: result.immuneBalanceScore,
//         gutHealthScore: result.gutHealthScore,
//         totalScore: result.totalScore,
//         animal: result.animal,
//         categoryType: categoryDetail.categoryType,
//         characterKeyword: categoryDetail.characterKeyword,
//         detailedFeatures: categoryDetail.detailedFeatures,
//         calculatedAt: result.calculatedAt,
//         createdAt: result.createdAt,
//         updatedAt: result.updatedAt,
//       };
//     } catch (error) {
//       this.logger.error(`설문 결과 계산 중 오류 발생 - 사용자 ID: ${userId}, 타입: ${type}`, error);
//       throw error;
//     }
//   }

//   /**
//    * 설문 답변과 함께 완료 처리
//    * 
//    * @param userId 사용자 ID
//    * @param type 설문 타입 ('before' 또는 'after')
//    * @param answers 설문 답변 배열
//    * @returns Promise<SurveyResultResponseDto> 계산된 설문 결과
//    */
//   async completeWithAnswers(
//     userId: number,
//     type: 'before' | 'after',
//     answers: Array<{ questionId: number; optionId: number }>,
//   ): Promise<SurveyResultResponseDto> {
//     this.logger.log(`설문 답변 저장 및 결과 계산 시작 - 사용자 ID: ${userId}, 타입: ${type}, 답변 수: ${answers.length}`);

//     try {
//       await this.prisma.$transaction(async (prisma) => {
//         const user = await prisma.user.findUnique({
//           where: { id: userId },
//         });

//         if (!user) {
//           throw new NotFoundException(`사용자를 찾을 수 없습니다. ID: ${userId}`);
//         }

//         if (type === 'after') {
//           const beforeResult = await prisma.surveyResult.findUnique({
//             where: {
//               userId_type: {
//                 userId,
//                 type: 'before',
//               },
//             },
//           });

//           if (!beforeResult) {
//             throw new BadRequestException('사전 설문을 먼저 완료해주세요.');
//           }

//           const today = new Date().toISOString().split('T')[0];
//           if (today >= this.AFTER_SURVEY_OPEN_DATE) {
//             this.logger.log(`After 설문 오픈일(${this.AFTER_SURVEY_OPEN_DATE}) 이상: 21일 체크 무시 - 사용자 ID: ${userId}`);
//           } else {
//             const daysSinceBeforeSurvey = Math.floor(
//               (new Date().getTime() - beforeResult.calculatedAt.getTime()) / (1000 * 60 * 60 * 24)
//             );

//             if (daysSinceBeforeSurvey < this.CHALLENGE_DURATION_DAYS) {
//               const daysRemaining = this.CHALLENGE_DURATION_DAYS - daysSinceBeforeSurvey;
//               this.logger.warn(`21일 미경과 - 사용자 ID: ${userId}, 경과일: ${daysSinceBeforeSurvey}, 남은 일수: ${daysRemaining}`);
//               throw new BadRequestException(
//                 `아직 사후 설문을 진행할 수 없습니다. ${daysRemaining}일 후에 진행 가능합니다. (현재 ${daysSinceBeforeSurvey}일째)`
//               );
//             }
//           }
//         }

//         // 3. 기존 답변 삭제
//         await prisma.surveyAnswer.deleteMany({
//           where: {
//             userId,
//             type,
//           },
//         });

//         // 4. 새로운 답변 저장
//         for (const answer of answers) {
//           // 선택지 유효성 확인
//           const option = await prisma.surveyOption.findUnique({
//             where: {
//               id: answer.optionId,
//             },
//           });
          
//           // 질문 유효성 확인
//           const question = await prisma.surveyQuestion.findUnique({
//             where: {
//               id: answer.questionId,
//             },
//           });

//           if (!option || !question) {
//             throw new BadRequestException(
//               `유효하지 않은 답변입니다. 질문 ID: ${answer.questionId}, 옵션 ID: ${answer.optionId}`
//             );
//           }

//           await prisma.surveyAnswer.create({
//             data: {
//               userId,
//               surveyQuestionId: answer.questionId,
//               surveyOptionId: answer.optionId,
//               type,
//             },
//           });
//         }

//         // 5. 트랜잭션 내에서는 답변 저장만 완료
//         this.logger.log(`설문 답변 저장 완료 - 사용자 ID: ${userId}`);
//       });

//       // 트랜잭션 완료 후 결과 계산
//       const result = await this.calculateAndSaveResult(userId, type);
//       return result;
//     } catch (error) {
//       this.logger.error(`설문 답변 저장 중 오류 발생 - 사용자 ID: ${userId}`, error);
//       throw error;
//     }
//   }

//   // 삭제된 메서드 (calculateAndSaveResultInternal)

//   /**
//    * 사용자의 설문 결과 조회
//    * 
//    * @param userId 사용자 ID
//    * @param type 설문 타입 ('before' 또는 'after', 선택적)
//    * @returns Promise<SurveyResultResponseDto[]> 설문 결과 목록
//    */
//   async findResults(userId: number, type?: 'before' | 'after'): Promise<SurveyResultResponseDto[]> {
//     this.logger.log(`설문 결과 조회 시도 - 사용자 ID: ${userId}, 타입: ${type || '전체'}`);

//     try {
//       const results = await this.prisma.surveyResult.findMany({
//         where: {
//           userId,
//           ...(type && { type }),
//         },
//         orderBy: { calculatedAt: 'desc' },
//       });

//       this.logger.log(`설문 결과 조회 완료 - 사용자 ID: ${userId}, 결과 수: ${results.length}`);

//       // 각 결과에 대한 카테고리 상세 정보 조회
//       const resultsWithDetails = await Promise.all(
//         results.map(async (result) => {
//           // 가장 낮은 점수의 카테고리 찾기
//           const scores = {
//             SKIN_HEALTH: result.skinHealthScore,
//             METABOLISM: result.metabolismScore,
//             IMMUNE_BALANCE: result.immuneBalanceScore,
//             GUT_HEALTH: result.gutHealthScore,
//           };

//           const lowestScore = Math.min(...Object.values(scores));
//           const lowestCategories = Object.entries(scores)
//             .filter(([_, score]) => score === lowestScore)
//             .map(([category, _]) => category);

//           // 우선순위에 따라 선택
//           const priorityOrder = ['GUT_HEALTH', 'METABOLISM', 'SKIN_HEALTH', 'IMMUNE_BALANCE'];
//           let selectedCategory = lowestCategories[0];
//           for (const priority of priorityOrder) {
//             if (lowestCategories.includes(priority)) {
//               selectedCategory = priority;
//               break;
//             }
//           }

//           // 카테고리 상세 정보 조회
//           const categoryDetail = await this.prisma.categoryDetail.findUnique({
//             where: { categoryCode: selectedCategory }
//           });

//           return {
//             id: result.id,
//             userId: result.userId,
//             type: result.type,
//             skinHealthScore: result.skinHealthScore,
//             metabolismScore: result.metabolismScore,
//             immuneBalanceScore: result.immuneBalanceScore,
//             gutHealthScore: result.gutHealthScore,
//             totalScore: result.totalScore,
//             animal: result.animal,
//             categoryType: categoryDetail?.categoryType,
//             characterKeyword: categoryDetail?.characterKeyword,
//             detailedFeatures: categoryDetail?.detailedFeatures,
//             calculatedAt: result.calculatedAt,
//             createdAt: result.createdAt,
//             updatedAt: result.updatedAt,
//           };
//         })
//       );

//       return resultsWithDetails;
//     } catch (error) {
//       this.logger.error(`설문 결과 조회 중 오류 발생 - 사용자 ID: ${userId}`, error);
//       throw error;
//     }
//   }

//   /**
//    * 사용자의 전후 비교 결과 조회
//    * 
//    * @param userId 사용자 ID
//    * @returns Promise<SurveyComparisonResponseDto> 전후 비교 결과
//    */
//   async compareResults(userId: number): Promise<SurveyComparisonResponseDto> {
//     this.logger.log(`전후 비교 결과 조회 시도 - 사용자 ID: ${userId}`);

//     try {
//       // before와 after 결과 조회
//       const beforeResult = await this.prisma.surveyResult.findUnique({
//         where: {
//           userId_type: {
//             userId,
//             type: 'before',
//           },
//         },
//       });

//       const afterResult = await this.prisma.surveyResult.findUnique({
//         where: {
//           userId_type: {
//             userId,
//             type: 'after',
//           },
//         },
//       });

//       // 각 결과에 대한 카테고리 상세 정보 조회를 위한 헬퍼 함수
//       const getResultWithDetails = async (result: any) => {
//         if (!result) return null;

//         const scores = {
//           SKIN_HEALTH: result.skinHealthScore,
//           METABOLISM: result.metabolismScore,
//           IMMUNE_BALANCE: result.immuneBalanceScore,
//           GUT_HEALTH: result.gutHealthScore,
//         };

//         const lowestScore = Math.min(...Object.values(scores));
//         const lowestCategories = Object.entries(scores)
//           .filter(([_, score]) => score === lowestScore)
//           .map(([category, _]) => category);

//         const priorityOrder = ['GUT_HEALTH', 'METABOLISM', 'SKIN_HEALTH', 'IMMUNE_BALANCE'];
//         let selectedCategory = lowestCategories[0];
//         for (const priority of priorityOrder) {
//           if (lowestCategories.includes(priority)) {
//             selectedCategory = priority;
//             break;
//           }
//         }

//         const categoryDetail = await this.prisma.categoryDetail.findUnique({
//           where: { categoryCode: selectedCategory }
//         });

//         return {
//           id: result.id,
//           userId: result.userId,
//           type: result.type,
//           skinHealthScore: result.skinHealthScore,
//           metabolismScore: result.metabolismScore,
//           immuneBalanceScore: result.immuneBalanceScore,
//           gutHealthScore: result.gutHealthScore,
//           totalScore: result.totalScore,
//           animal: result.animal,
//           categoryType: categoryDetail?.categoryType,
//           characterKeyword: categoryDetail?.characterKeyword,
//           detailedFeatures: categoryDetail?.detailedFeatures,
//           calculatedAt: result.calculatedAt,
//           createdAt: result.createdAt,
//           updatedAt: result.updatedAt,
//         };
//       };

//       const response: SurveyComparisonResponseDto = {
//         before: await getResultWithDetails(beforeResult),
//         after: await getResultWithDetails(afterResult),
//       };

//       // 개선율 계산 (before와 after가 모두 있는 경우)
//       if (beforeResult && afterResult) {
//         response.improvements = {
//           skinHealthImprovement: afterResult.skinHealthScore - beforeResult.skinHealthScore,
//           metabolismImprovement: afterResult.metabolismScore - beforeResult.metabolismScore,
//           immuneBalanceImprovement: afterResult.immuneBalanceScore - beforeResult.immuneBalanceScore,
//           gutHealthImprovement: afterResult.gutHealthScore - beforeResult.gutHealthScore,
//           totalImprovement: afterResult.totalScore - beforeResult.totalScore,
//         };
//       }

//       this.logger.log(`전후 비교 결과 조회 완료 - 사용자 ID: ${userId}`);

//       return response;
//     } catch (error) {
//       this.logger.error(`전후 비교 결과 조회 중 오류 발생 - 사용자 ID: ${userId}`, error);
//       throw error;
//     }
//   }


//   /**
//    * 사용자 설문 상태 확인
//    * 
//    * @param userId 사용자 ID
//    * @returns 사용자의 설문 상태 정보
//    */
//   async getSurveyStatus(userId: number): Promise<SurveyStatusResponseDto> {
//     this.logger.log(`사용자 설문 상태 확인 시도 - 사용자 ID: ${userId}`);

//     try {
//       // 사용자 정보 조회 (챌린지 시작일 확인)
//       const user = await this.prisma.user.findUnique({
//         where: { id: userId },
//         select: { createdAt: true },
//       });

//       if (!user) {
//         throw new NotFoundException(`사용자를 찾을 수 없습니다.`);
//       }

//       // before/after 설문 결과 조회
//       const [beforeResult, afterResult] = await Promise.all([
//         this.prisma.surveyResult.findUnique({
//           where: { userId_type: { userId, type: 'before' } },
//         }),
//         this.prisma.surveyResult.findUnique({
//           where: { userId_type: { userId, type: 'after' } },
//         }),
//       ]);

//       const beforeCompleted = !!beforeResult;
//       const afterCompleted = !!afterResult;

//       // 챌린지 시작일로부터 경과일 계산
//       // before 설문을 완료한 경우에만 경과일을 계산
//       let challengeDaysElapsed: number | undefined;
//       let daysSinceBeforeSurvey: number | undefined;
      
//       if (beforeCompleted && beforeResult) {
//         // before 설문 완료일로부터 경과일 계산
//         daysSinceBeforeSurvey = Math.floor(
//           (new Date().getTime() - beforeResult.calculatedAt.getTime()) / (1000 * 60 * 60 * 24)
//         );
        
//         // 사용자 생성일로부터의 경과일도 계산 (참고용)
//         challengeDaysElapsed = Math.floor(
//           (new Date().getTime() - user.createdAt.getTime()) / (1000 * 60 * 60 * 24)
//         );
//       }

//       // after 설문 가능 여부 (before 설문 완료 후 21일 경과)
//       const canTakeAfterSurvey = beforeCompleted && 
//                                  !afterCompleted && 
//                                  daysSinceBeforeSurvey !== undefined &&
//                                  daysSinceBeforeSurvey >= this.CHALLENGE_DURATION_DAYS;

//       // after 설문 가능 예정일 (before 설문 완료일 기준)
//       const afterSurveyAvailableDate = beforeCompleted && !afterCompleted && beforeResult
//         ? new Date(beforeResult.calculatedAt.getTime() + this.CHALLENGE_DURATION_DAYS * 24 * 60 * 60 * 1000)
//         : undefined;

//       // 남은 일수 계산
//       const daysRemaining = beforeCompleted && !afterCompleted && daysSinceBeforeSurvey !== undefined
//         ? Math.max(0, this.CHALLENGE_DURATION_DAYS - daysSinceBeforeSurvey)
//         : undefined;

//       // 다음 필요한 액션 결정
//       let nextAction: string;
//       if (!beforeCompleted) {
//         nextAction = 'TAKE_BEFORE_SURVEY';
//       } else if (!afterCompleted && !canTakeAfterSurvey) {
//         nextAction = 'CHALLENGE_IN_PROGRESS';
//       } else if (!afterCompleted && canTakeAfterSurvey) {
//         nextAction = 'TAKE_AFTER_SURVEY';
//       } else {
//         nextAction = 'ALL_COMPLETED';
//       }

//       this.logger.log(`사용자 설문 상태 확인 완료 - 다음 액션: ${nextAction}, before 설문 후 경과일: ${daysSinceBeforeSurvey || 'N/A'}`);

//       return {
//         beforeCompleted,
//         beforeCompletedAt: beforeResult?.calculatedAt,
//         afterCompleted,
//         afterCompletedAt: afterResult?.calculatedAt,
//         canTakeAfterSurvey,
//         afterSurveyAvailableDate,
//         challengeDaysElapsed: beforeCompleted ? challengeDaysElapsed : undefined,
//         daysSinceBeforeSurvey,
//         daysRemaining,
//         nextAction,
//       };
//     } catch (error) {
//       this.logger.error(`사용자 설문 상태 확인 중 오류 발생 - 사용자 ID: ${userId}`, error);
//       throw error;
//     }
//   }
// }