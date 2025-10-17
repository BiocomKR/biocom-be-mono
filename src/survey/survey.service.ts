import { Injectable, Logger, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { CreateSurveyAnswerDto } from './dto/create-survey-answer.dto';
import type { Prisma, SurveyAnswer, SurveyQuestion, SurveyOption, User } from '@prisma/client';
import { getNowKST } from '../common/utils/kst-date.util';

/**
 * 설문 서비스
 * 이벤트 참여자의 설문 답변을 관리
 */
@Injectable()
export class SurveyService {
  private readonly logger = new Logger(SurveyService.name);

  constructor(
    private readonly prisma: PrismaService,
  ) {}

  // ==================== 사용자용 설문 답변 및 결과 API ====================

  /**
   * 설문 답변 생성 (간단버전)
   */
  async createAnswer(createSurveyAnswerDto: CreateSurveyAnswerDto): Promise<SurveyAnswer & {
    surveyQuestion: SurveyQuestion;
    surveyOption: SurveyOption;
  }> {
    this.logger.log(`설문 답변 생성 - 사용자: ${createSurveyAnswerDto.userId}, 타입: ${createSurveyAnswerDto.type}`);

    // 질문과 선택지 검증
    await this.validateQuestionAndOption(
      createSurveyAnswerDto.surveyQuestionId,
      createSurveyAnswerDto.surveyOptionId
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
   * 설문 답변 대량 생성 (간단버전)
   */
  async createBulkAnswers(
    userId: number,
    type: 'before' | 'after',
    answers: Array<{ questionId: number; optionId: number }>
  ): Promise<SurveyAnswer[]> {
    this.logger.log(`설문 답변 대량 생성 - 사용자: ${userId}, 개수: ${answers.length}`);

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
   * 사용자 설문 답변 조회
   */
  async getUserAnswers(
    userId: number,
    type?: 'before' | 'after'
  ): Promise<(SurveyAnswer & { 
    surveyQuestion: SurveyQuestion; 
    surveyOption: SurveyOption; 
  })[]> {
    const where: Prisma.SurveyAnswerWhereInput = { userId };
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
   * 챌린지별 사용자 설문 답변 조회 (Product 기반)
   */
  async getUserAnswersByChallenge(
    userId: number,
    productId: number,
    type?: 'before' | 'after'
  ): Promise<(SurveyAnswer & {
    surveyQuestion: SurveyQuestion;
    surveyOption: SurveyOption;
  })[]> {
    // 챌린지 상품과 연결된 설문 ID들 조회
    const challengeSurveys = await this.prisma.challengeSurvey.findMany({
      where: {
        productId,
        isActive: true
      },
      select: {
        surveyId: true
      }
    });

    if (challengeSurveys.length === 0) {
      return [];
    }

    const surveyIds = challengeSurveys.map(cs => cs.surveyId);

    // 해당 설문들의 질문 ID들 조회
    const surveyQuestions = await this.prisma.surveyQuestion.findMany({
      where: {
        surveyId: {
          in: surveyIds
        }
      },
      select: {
        id: true
      }
    });

    const questionIds = surveyQuestions.map(sq => sq.id);

    const where: Prisma.SurveyAnswerWhereInput = {
      userId,
      surveyQuestionId: {
        in: questionIds
      }
    };
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
   * 설문 진행 상태 조회 (간단버전) - Product 기반
   */
  async getSurveyStatus(userId: number, productId: number): Promise<{
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
    // 챌린지 상품과 연결된 설문 정보 조회
    const challengeSurveys = await this.prisma.challengeSurvey.findMany({
      where: {
        productId,
        isActive: true
      },
      include: {
        survey: {
          include: {
            surveyQuestions: true
          }
        }
      }
    });

    if (challengeSurveys.length === 0) {
      throw new NotFoundException(`상품 ID ${productId}와 연결된 설문을 찾을 수 없습니다.`);
    }

    // 첫 번째 설문의 총 질문 수 (모든 설문이 동일한 질문 세트를 사용한다고 가정)
    const totalQuestions = challengeSurveys[0].survey.surveyQuestions.length;

    const [beforeAnswers, afterAnswers] = await Promise.all([
      this.getUserAnswersByChallenge(userId, productId, 'before'),
      this.getUserAnswersByChallenge(userId, productId, 'after'),
    ]);

    const beforeCompleted = beforeAnswers.length === totalQuestions;
    const afterCompleted = afterAnswers.length === totalQuestions;
    const canTakeAfterSurvey = beforeCompleted; // 사전 설문 완료 후 사후 설문 가능
    
    let nextAction: 'TAKE_BEFORE_SURVEY' | 'WAIT_FOR_AFTER_SURVEY' | 'TAKE_AFTER_SURVEY' | 'COMPLETED';
    
    if (!beforeCompleted) {
      nextAction = 'TAKE_BEFORE_SURVEY';
    } else if (!afterCompleted) {
      nextAction = 'TAKE_AFTER_SURVEY';
    } else {
      nextAction = 'COMPLETED';
    }

    return {
      beforeSurvey: {
        enabled: true, // 항상 사용 가능
        completed: beforeCompleted,
        answeredCount: beforeAnswers.length,
        totalQuestions,
      },
      afterSurvey: {
        enabled: true, // 항상 사용 가능
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

  // 관리자용 메서드들을 management/services/management-survey.service.ts로 이동

  /**
   * 사용자별 답변 조회
   */
  async findAnswersByUser(userId: number, type?: 'before' | 'after') {
    const where: Prisma.SurveyAnswerWhereInput = { userId };
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

  // 질문별 답변 조회는 management로 이동

  /**
   * 챌린지별 설문 완료 처리 (Product 기반)
   * CategoryDetail 기반 동물 배정 및 Before/After 결과 저장
   */
  async completeChallengeSurvey(
    userId: number,
    productId: number,
    type: 'before' | 'after',
    answers: Array<{ questionId: number; optionId: number }>
  ) {
    this.logger.log(`챌린지 설문 완료 처리 - 사용자: ${userId}, 상품: ${productId}, 타입: ${type}`);

    return await this.prisma.$transaction(async (tx) => {
      // 1. 설문 답변 저장
      for (const answer of answers) {
        await tx.surveyAnswer.create({
          data: {
            userId,
            type,
            surveyQuestionId: answer.questionId,
            surveyOptionId: answer.optionId,
          },
        });
      }

      // 2. 카테고리별 점수 계산 (old-survey.service.ts 로직 적용)
      const categoryScores = await this.calculateCategoryScores(answers, tx);
      this.logger.debug(`카테고리별 점수: ${JSON.stringify(categoryScores)}`);

      // 3. 최저점수 카테고리 찾기
      const lowestCategory = this.findLowestScoreCategory(categoryScores);
      this.logger.log(`최저점수 카테고리: ${lowestCategory}`);

      // 4. UserChallengeSurveyResult 저장/업데이트
      await this.saveOrUpdateSurveyResult(userId, productId, type, categoryScores, lowestCategory, tx);

      // 5. CategoryDetail에서 동물 캐릭터 정보 조회
      const categoryDetail = await tx.categoryDetail.findFirst({
        where: { categoryCode: lowestCategory },
      });

      // 6. 챌린지 진행 상황 업데이트
      await this.processChallengeIntegration(tx, userId, productId);

      return {
        scores: categoryScores,
        lowestCategory,
        animalCharacter: categoryDetail?.animalCharacter,
        characterKeyword: categoryDetail?.characterKeyword,
        detailedFeatures: categoryDetail?.detailedFeatures,
      };
    });
  }

  /**
   * 설문 ID 기반 설문 완료 처리
   */
  async completeSurveyById(
    userId: number,
    surveyId: number,
    type: 'before' | 'after',
    answers: Array<{ questionId: number; optionId: number }>
  ) {
    this.logger.log(`설문 완료 처리 - 사용자: ${userId}, 설문ID: ${surveyId}, 타입: ${type}`);

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

      // 🔥 챌린지 연동 로직 추가
      await this.processChallengeIntegration(tx, userId, surveyId);

      // 결과 분석
      return await this.analyzeSurveyResult(userId, type);
    });
  }

  /**
   * 카테고리별 점수 계산 (old-survey.service.ts 로직 적용)
   * 100점에서 답변 점수를 차감하는 방식
   */
  private async calculateCategoryScores(
    answers: Array<{ questionId: number; optionId: number }>,
    tx: Prisma.TransactionClient,
  ): Promise<Record<string, number>> {
    // 초기 점수는 각 카테고리별로 100점
    const categoryScores = {
      SKIN_HEALTH: 100,
      METABOLISM: 100,
      IMMUNE_BALANCE: 100,
      GUT_HEALTH: 100,
    };

    // 각 답변에 대해 점수 차감
    for (const answer of answers) {
      const option = await tx.surveyOption.findUnique({
        where: { id: answer.optionId },
      });

      // 질문 ID로 질문 정보를 가져와서 카테고리 확인
      const question = await tx.surveyQuestion.findUnique({
        where: { id: answer.questionId },
      });

      if (option && question && option.score) {
        const category = question.categoryCode as keyof typeof categoryScores;
        if (categoryScores[category] !== undefined) {
          categoryScores[category] -= option.score;
        }
      }
    }

    // 점수가 0 미만이 되지 않도록 보정
    Object.keys(categoryScores).forEach((key) => {
      if (categoryScores[key] < 0) {
        categoryScores[key] = 0;
      }
    });

    return categoryScores;
  }

  /**
   * 최저점수 카테고리 찾기 (old-survey.service.ts 우선순위 적용)
   * 우선순위: GUT_HEALTH → METABOLISM → SKIN_HEALTH → IMMUNE_BALANCE
   */
  private findLowestScoreCategory(categoryScores: Record<string, number>): string {
    const priorityOrder = ['GUT_HEALTH', 'METABOLISM', 'SKIN_HEALTH', 'IMMUNE_BALANCE'];
    
    let lowestScore = Math.min(...Object.values(categoryScores));
    
    // 우선순위에 따라 최저점수 카테고리 선택
    for (const category of priorityOrder) {
      if (categoryScores[category] === lowestScore) {
        return category;
      }
    }
    
    return 'GUT_HEALTH';
  }

  /**
   * 사용자별 챌린지별 설문 결과 저장/업데이트 (Product 기반)
   */
  private async saveOrUpdateSurveyResult(
    userId: number,
    productId: number,
    surveyType: 'before' | 'after',
    categoryScores: Record<string, number>,
    lowestCategory: string,
    tx: Prisma.TransactionClient,
  ): Promise<void> {
    const existing = await tx.userChallengeSurveyResult.findUnique({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
    });

    const updateData: Prisma.UserChallengeSurveyResultUpdateInput = {};

    if (surveyType === 'before') {
      updateData.beforeCategory = lowestCategory;
      updateData.beforeSkinHealthScore = categoryScores.SKIN_HEALTH;
      updateData.beforeMetabolismScore = categoryScores.METABOLISM;
      updateData.beforeImmuneScore = categoryScores.IMMUNE_BALANCE;
      updateData.beforeGutHealthScore = categoryScores.GUT_HEALTH;
      updateData.beforeCompletedAt = getNowKST();
    } else {
      updateData.afterCategory = lowestCategory;
      updateData.afterSkinHealthScore = categoryScores.SKIN_HEALTH;
      updateData.afterMetabolismScore = categoryScores.METABOLISM;
      updateData.afterImmuneScore = categoryScores.IMMUNE_BALANCE;
      updateData.afterGutHealthScore = categoryScores.GUT_HEALTH;
      updateData.afterCompletedAt = getNowKST();
    }

    // upsert 방식으로 변경 (unique 제약 조건 문제 해결)
    await tx.userChallengeSurveyResult.upsert({
      where: {
        userId_productId: {
          userId,
          productId,
        },
      },
      update: updateData,
      create: {
        userId,
        productId,
        ...updateData,
      } as any,
    });
  }

  /**
   * 챌린지 연동 처리 (Product 기반)
   * 설문 완료 시 활성 챌린지가 있으면 포인트 적립 및 진행상황 업데이트
   */
  private async processChallengeIntegration(
    tx: Prisma.TransactionClient,
    userId: number,
    productIdOrSurveyId: number
  ): Promise<void> {
    try {
      // 1️⃣ 활성 챌린지 조회
      const activeChallenge = await tx.userChallenge.findFirst({
        where: {
          userId,
          status: 'ACTIVE'
        },
        include: { product: true }
      });

      if (!activeChallenge) {
        this.logger.log(`설문 완료 - 활성 챌린지 없음 (사용자: ${userId})`);
        return;
      }

      // 2️⃣ 특정 설문이 오늘의 챌린지 설문인지 확인
      const today = getNowKST();
      const todayStr = today.toISOString().split('T')[0];
      const currentDay = activeChallenge.currentDay;

      const todaySurvey = await tx.challengeSurvey.findFirst({
        where: {
          productId: activeChallenge.productId,
          day: currentDay,
          surveyId: productIdOrSurveyId,  // 완료한 설문이 오늘의 설문과 일치하는지 확인
          isActive: true
        },
        include: { survey: true }
      });

      if (!todaySurvey) {
        this.logger.log(`설문 완료 - 완료한 설문(${productIdOrSurveyId})이 오늘(${currentDay}일차) 챌린지 설문이 아님`);
        return;
      }

      // 3️⃣ DailyProgress 조회/생성
      let dailyProgress = await tx.dailyProgress.findFirst({
        where: {
          userChallengeId: activeChallenge.id,
          day: currentDay
        }
      });

      if (!dailyProgress) {
        dailyProgress = await tx.dailyProgress.create({
          data: {
            userChallengeId: activeChallenge.id,
            day: currentDay,
            date: new Date(todayStr)
          }
        });
      }

      // 4️⃣ 설문 포인트 계산 (기본 50포인트)
      const surveyPoints = 50;

      // 5️⃣ DailyProgress 업데이트
      await tx.dailyProgress.update({
        where: {
          userChallengeId_day: {
            userChallengeId: activeChallenge.id,
            day: currentDay
          }
        },
        data: {
          surveysCompleted: { increment: 1 },
          pointsEarned: { increment: surveyPoints }
        }
      });

      // 6️⃣ 사용자 총 포인트 업데이트
      await tx.userChallenge.update({
        where: { id: activeChallenge.id },
        data: {
          totalPoints: { increment: surveyPoints }
        }
      });

      // 7️⃣ 포인트 히스토리 기록
      const user = await tx.user.update({
        where: { id: userId },
        data: {
          points: { increment: surveyPoints }
        }
      });

      await tx.pointHistory.create({
        data: {
          userId,
          type: 'EARNED',
          amount: surveyPoints,
          balance: user.points,
          description: `설문 완료: ${todaySurvey.survey.name}`,
          relatedType: 'SURVEY',
          relatedId: todaySurvey.id
        }
      });

      this.logger.log(`설문 완료 챌린지 연동 성공 - 사용자: ${userId}, 설문: ${todaySurvey.survey.name}, 포인트: ${surveyPoints}`);

    } catch (error) {
      this.logger.error('설문 완료 챌린지 연동 실패:', error);
      // 챌린지 연동 실패해도 설문 완료는 진행
    }
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
          createdAt: getNowKST(),
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
          createdAt: getNowKST(),
        });
      } catch (error) {
        // 결과가 없으면 무시
      }
    }

    return results;
  }

  /**
   * 설문 ID 기반 설문 전후 비교 (Product 기반)
   */
  async getSurveyComparison(userId: number, surveyId: number) {
    this.logger.log(`사용자 ${userId}의 설문 ${surveyId} 결과 비교를 조회합니다.`);

    // 설문에서 연결된 챌린지 상품 찾기
    const challengeSurvey = await this.prisma.challengeSurvey.findFirst({
      where: {
        surveyId,
        isActive: true,
      },
    });

    if (!challengeSurvey) {
      throw new NotFoundException('설문과 연결된 챌린지 상품을 찾을 수 없습니다.');
    }

    const result = await this.prisma.userChallengeSurveyResult.findUnique({
      where: {
        userId_productId: {
          userId,
          productId: challengeSurvey.productId,
        },
      },
    });

    if (!result) {
      throw new NotFoundException('설문 결과를 찾을 수 없습니다.');
    }

    // Before 동물 캐릭터 정보
    const beforeCategoryDetail = result.beforeCategory
      ? await this.prisma.categoryDetail.findFirst({
          where: { categoryCode: result.beforeCategory },
        })
      : null;

    // After 동물 캐릭터 정보
    const afterCategoryDetail = result.afterCategory
      ? await this.prisma.categoryDetail.findFirst({
          where: { categoryCode: result.afterCategory },
        })
      : null;

    return {
      userId,
      surveyId,
      productId: challengeSurvey.productId,
      before: {
        category: result.beforeCategory,
        animalCharacter: beforeCategoryDetail?.animalCharacter,
        characterKeyword: beforeCategoryDetail?.characterKeyword,
        detailedFeatures: beforeCategoryDetail?.detailedFeatures,
        scores: {
          skinHealth: result.beforeSkinHealthScore,
          metabolism: result.beforeMetabolismScore,
          immune: result.beforeImmuneScore,
          gutHealth: result.beforeGutHealthScore,
        },
        completedAt: result.beforeCompletedAt,
      },
      after: result.afterCategory ? {
        category: result.afterCategory,
        animalCharacter: afterCategoryDetail?.animalCharacter,
        characterKeyword: afterCategoryDetail?.characterKeyword,
        detailedFeatures: afterCategoryDetail?.detailedFeatures,
        scores: {
          skinHealth: result.afterSkinHealthScore,
          metabolism: result.afterMetabolismScore,
          immune: result.afterImmuneScore,
          gutHealth: result.afterGutHealthScore,
        },
        completedAt: result.afterCompletedAt,
      } : null,
      improvement: this.calculateImprovement(result),
    };
  }

  /**
   * Before & After 개선도 계산
   */
  private calculateImprovement(result: any) {
    if (!result.beforeCategory || !result.afterCategory) {
      return null;
    }

    const beforeTotalScore = 
      (result.beforeSkinHealthScore || 0) +
      (result.beforeMetabolismScore || 0) +
      (result.beforeImmuneScore || 0) +
      (result.beforeGutHealthScore || 0);

    const afterTotalScore = 
      (result.afterSkinHealthScore || 0) +
      (result.afterMetabolismScore || 0) +
      (result.afterImmuneScore || 0) +
      (result.afterGutHealthScore || 0);

    return {
      totalScoreImprovement: afterTotalScore - beforeTotalScore,
      categoryScoreChanges: {
        skinHealth: (result.afterSkinHealthScore || 0) - (result.beforeSkinHealthScore || 0),
        metabolism: (result.afterMetabolismScore || 0) - (result.beforeMetabolismScore || 0),
        immune: (result.afterImmuneScore || 0) - (result.beforeImmuneScore || 0),
        gutHealth: (result.afterGutHealthScore || 0) - (result.beforeGutHealthScore || 0),
      },
    };
  }

  /**
   * 설문 ID로 사전설문 조회
   */
  async getSurveyBeforeQuestions(surveyId: number) {
    this.logger.log(`설문 ${surveyId}의 사전설문 질문들을 조회합니다.`);

    const survey = await this.prisma.survey.findUnique({
      where: {
        id: surveyId,
        isActive: true,
      },
      include: {
        surveyQuestions: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!survey) {
      throw new NotFoundException(`설문 ${surveyId}을 찾을 수 없습니다.`);
    }

    return survey;
  }

  /**
   * 설문 ID로 사후설문 조회
   */
  async getSurveyAfterQuestions(surveyId: number) {
    this.logger.log(`설문 ${surveyId}의 사후설문 질문들을 조회합니다.`);

    const survey = await this.prisma.survey.findUnique({
      where: {
        id: surveyId,
        isActive: true,
      },
      include: {
        surveyQuestions: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!survey) {
      throw new NotFoundException(`설문 ${surveyId}을 찾을 수 없습니다.`);
    }

    return survey;
  }

  /**
   * 설문 전후 비교 (기존 로직 - 호환성 유지)
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
      calculatedAt: getNowKST(), // calculatedAt 필드 추가
      createdAt: getNowKST(),
      updatedAt: getNowKST(),
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

  // 페이징 처리된 설문 목록 조회는 management로 이동

  /**
   * 카테고리별 설문 질문 조회
   */
  async findQuestions(categoryCode?: string) {
    this.logger.log(`설문 질문 조회 - 카테고리: ${categoryCode || '전체'}`);

    const questions = await this.prisma.surveyQuestion.findMany({
      where: {
        isActive: true,
        ...(categoryCode && { categoryCode }),
      },
      include: {
        options: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
      orderBy: { sortOrder: 'asc' },
    });

    return questions;
  }

  /**
   * 설문 질문 단건 조회
   */
  async findOneQuestion(id: number) {
    this.logger.log(`설문 질문 단건 조회 - ID: ${id}`);

    const question = await this.prisma.surveyQuestion.findUnique({
      where: {
        id,
        isActive: true,
      },
      include: {
        options: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!question) {
      throw new NotFoundException(`설문 질문 ID ${id}를 찾을 수 없습니다.`);
    }

    return question;
  }

  /**
   * 질문별 답변 조회
   */
  async findAnswersByQuestion(questionId: number, type?: 'before' | 'after') {
    this.logger.log(`질문별 답변 조회 - 질문ID: ${questionId}, 타입: ${type || '전체'}`);

    const answers = await this.prisma.surveyAnswer.findMany({
      where: {
        surveyQuestionId: questionId,
        ...(type && { type }),
      },
      include: {
        user: {
          select: {
            id: true,
            name: true,
            email: true,
          },
        },
        surveyQuestion: true,
        surveyOption: true,
      },
      orderBy: { createdAt: 'desc' },
    });

    return answers;
  }
}