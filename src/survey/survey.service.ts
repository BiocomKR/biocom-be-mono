import { Injectable, Logger, ConflictException, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { UserChallengeStatus, SurveyOptionType, SurveyType, HealthCategory, HEALTH_CATEGORY_PRIORITY } from '../common/enums';
import { CreateSurveyAnswerDto } from './dto/create-survey-answer.dto';
import type { Prisma, SurveyAnswer, SurveyQuestion, SurveyOption } from '@prisma/client';
import { getNowKST, calculateChallengeDay } from '../common/utils/kst-date.util';

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
        createdAt: getNowKST(),
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
    type: SurveyType,
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
              createdAt: getNowKST(),
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
    type?: SurveyType
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
    type?: SurveyType
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
   * 설문 결과 분석 (타입별 분기)
   */
  async analyzeSurveyResult(
    userId: number,
    type: SurveyType,
    tx?: Prisma.TransactionClient
  ): Promise<{
    categoryScores: Record<string, number>;
    totalScore: number;
    dominantCategory: string | null;
    animalCharacter?: string;
    sleepScore?: number;
    recommendMetaDream?: boolean;
  }> {
    // 사전설문: 동물 할당 + 영양제 루틴 생성
    if (type === SurveyType.BEFORE) {
      return this.analyzePreSurveyResult(userId, tx);
    }
    // 사후설문: 점수 계산만
    return this.analyzePostSurveyResult(userId, tx);
  }

  /**
   * 사전설문 결과 분석
   * - 카테고리별 점수 계산
   * - 건강유형 동물 할당
   * - 영양제 루틴 생성
   */
  private async analyzePreSurveyResult(
    userId: number,
    tx?: Prisma.TransactionClient
  ): Promise<{
    categoryScores: Record<string, number>;
    totalScore: number;
    dominantCategory: string | null;
    animalCharacter?: string;
    sleepScore?: number;
    recommendMetaDream?: boolean;
  }> {
    const prismaClient = tx || this.prisma;

    // 트랜잭션 내부에서 답변 조회
    const answers = await prismaClient.surveyAnswer.findMany({
      where: { userId, type: SurveyType.BEFORE },
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

    if (answers.length === 0) {
      throw new NotFoundException('사전 설문 답변이 없습니다.');
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

    // health_type_animals 테이블에 있는 유효한 건강 타입만 조회
    const validHealthTypes = await prismaClient.healthTypeAnimal.findMany({
      select: { healthType: true },
    });
    const validTypesSet = new Set(validHealthTypes.map((t) => t.healthType));

    // 최고 점수 카테고리 찾기 (유효한 건강 타입만 대상)
    let dominantCategory: string | null = null;
    let maxScore = 0;

    for (const [category, score] of Object.entries(categoryScores)) {
      // health_type_animals에 없는 카테고리(예: SLEEP)는 제외
      if (!validTypesSet.has(category)) continue;

      if (score > maxScore) {
        maxScore = score;
        dominantCategory = category;
      }
    }

    // 동물 캐릭터 매칭 및 영양제 루틴 생성
    let animalCharacter: string | undefined;

    if (dominantCategory) {
      const healthTypeAnimal = await prismaClient.healthTypeAnimal.findUnique({
        where: { healthType: dominantCategory },
      });

      if (healthTypeAnimal) {
        animalCharacter = healthTypeAnimal.animalName;
        const healthTypeAnimalId = healthTypeAnimal.id;

        // 1. users 테이블의 health_type_animal_id에 동물id 업데이트
        await prismaClient.user.update({
          where: { id: userId },
          data: {
            health_type_animal_id: healthTypeAnimalId,
          },
        });

        this.logger.log(`[사전설문] 사용자 ${userId}에게 동물 ${animalCharacter} (ID: ${healthTypeAnimalId}) 할당 완료`);

        // 2. health_type_animal_products 테이블에서 동물id로 조회
        const animalProducts = await prismaClient.healthTypeAnimalProduct.findMany({
          where: {
            healthTypeAnimalId: healthTypeAnimalId,
            isActive: true,
          },
          orderBy: {
            displayOrder: 'asc',
          },
        });

        this.logger.log(`[사전설문] 동물 ${animalCharacter}의 맞춤 영양제 ${animalProducts.length}개 조회 완료`);

        // 3. userSupplementRoutine 테이블에 기본 영양제 3종 insert
        if (animalProducts.length > 0) {
          const now = getNowKST();

          // 기존 기본 영양제 루틴 삭제 (중복 방지)
          await prismaClient.userSupplementRoutine.deleteMany({
            where: {
              userId,
              isDefault: true,
            },
          });

          // 새로운 기본 영양제 루틴 생성
          await prismaClient.userSupplementRoutine.createMany({
            data: animalProducts.map((product, index) => ({
              userId,
              productId: product.productId,
              isDefault: true,
              displayOrder: index + 1,
              isActive: true,
              createdAt: now,
            })),
            skipDuplicates: true,
          });

          this.logger.log(`[사전설문] 사용자 ${userId}의 영양제 루틴 ${animalProducts.length}개 생성 완료`);
        }
      }
    }

    // 수면 문제 점수
    const sleepScore = categoryScores[HealthCategory.SLEEP] || 0;
    const recommendMetaDream = sleepScore >= 60;

    if (recommendMetaDream) {
      this.logger.log(`[사전설문] 사용자 ${userId} 수면 문제 점수 ${sleepScore}점 - 메타드림 추천`);
    }

    return {
      categoryScores,
      totalScore,
      dominantCategory,
      animalCharacter,
      sleepScore,
      recommendMetaDream,
    };
  }

  /**
   * 사후설문 결과 분석
   * - 카테고리별 점수 계산만 수행
   * - 동물 할당 및 영양제 루틴 생성 없음
   */
  private async analyzePostSurveyResult(
    userId: number,
    tx?: Prisma.TransactionClient
  ): Promise<{
    categoryScores: Record<string, number>;
    totalScore: number;
    dominantCategory: string | null;
    animalCharacter?: string;
    sleepScore?: number;
    recommendMetaDream?: boolean;
  }> {
    const prismaClient = tx || this.prisma;

    // 트랜잭션 내부에서 답변 조회
    const answers = await prismaClient.surveyAnswer.findMany({
      where: { userId, type: SurveyType.AFTER },
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

    if (answers.length === 0) {
      throw new NotFoundException('사후 설문 답변이 없습니다.');
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

    // health_type_animals 테이블에 있는 유효한 건강 타입만 조회
    const validHealthTypes = await prismaClient.healthTypeAnimal.findMany({
      select: { healthType: true },
    });
    const validTypesSet = new Set(validHealthTypes.map((t) => t.healthType));

    // 최고 점수 카테고리 찾기 (유효한 건강 타입만 대상)
    let dominantCategory: string | null = null;
    let maxScore = 0;

    for (const [category, score] of Object.entries(categoryScores)) {
      if (!validTypesSet.has(category)) continue;

      if (score > maxScore) {
        maxScore = score;
        dominantCategory = category;
      }
    }

    // 수면 문제 점수
    const sleepScore = categoryScores[HealthCategory.SLEEP] || 0;
    const recommendMetaDream = sleepScore >= 60;

    this.logger.log(`[사후설문] 사용자 ${userId} 점수 계산 완료 - 총점: ${totalScore}, 최고카테고리: ${dominantCategory}`);

    return {
      categoryScores,
      totalScore,
      dominantCategory,
      // 사후설문에서는 동물 캐릭터 반환하지 않음 (기존 동물 유지)
      sleepScore,
      recommendMetaDream,
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
      this.getUserAnswersByChallenge(userId, productId, SurveyType.BEFORE),
      this.getUserAnswersByChallenge(userId, productId, SurveyType.AFTER),
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
  async findAnswersByUser(userId: number, type?: SurveyType) {
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
   * 설문 ID 기반 설문 완료 처리
   */
  async completeSurveyById(
    userId: number,
    surveyId: number,
    type: SurveyType,
    answers: Array<{ questionId: number; optionId: number }>
  ) {
    this.logger.log(`설문 완료 처리 - 사용자: ${userId}, 설문ID: ${surveyId}, 타입: ${type}`);

    // 트랜잭션으로 처리
    return await this.prisma.$transaction(async (tx) => {
      // 활성 챌린지 조회
      const activeChallenge = await tx.userChallenge.findFirst({
        where: {
          userId,
          status: UserChallengeStatus.ACTIVE
        }
      });

      // 기존 답변 삭제
      await tx.surveyAnswer.deleteMany({
        where: {
          userId,
          type,
        },
      });

      // 새 답변 저장 (userChallengeId 포함)
      const now = getNowKST();
      await tx.surveyAnswer.createMany({
        data: answers.map((answer) => ({
          userId,
          type,
          surveyQuestionId: answer.questionId,
          surveyOptionId: answer.optionId,
          userChallengeId: activeChallenge?.id || null,
          createdAt: now,
        })),
      });

      // 🔥 챌린지 연동 로직 추가
      await this.processChallengeIntegration(tx, userId, surveyId, type);

      // 결과 분석 (트랜잭션 클라이언트 전달)
      return await this.analyzeSurveyResult(userId, type, tx);
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
    // 초기 점수는 각 카테고리별로 100점 (SLEEP 포함)
    const categoryScores: Record<string, number> = {
      [HealthCategory.SKIN_HEALTH]: 100,
      [HealthCategory.METABOLISM]: 100,
      [HealthCategory.IMMUNE_BALANCE]: 100,
      [HealthCategory.GUT_HEALTH]: 100,
      [HealthCategory.SLEEP]: 100,
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
   * 최저점수 카테고리 찾기
   * 우선순위: GUT_HEALTH(장) → IMMUNE_BALANCE(면역) → SKIN_HEALTH(염증) → METABOLISM(대사)
   */
  private findLowestScoreCategory(categoryScores: Record<string, number>): string {
    const lowestScore = Math.min(...Object.values(categoryScores));

    // 우선순위에 따라 최저점수 카테고리 선택
    for (const category of HEALTH_CATEGORY_PRIORITY) {
      if (categoryScores[category] === lowestScore) {
        return category;
      }
    }

    return HealthCategory.GUT_HEALTH;
  }

  /**
   * 사용자별 챌린지별 설문 결과 저장/업데이트 (Product 기반)
   */
  private async saveOrUpdateSurveyResult(
    userId: number,
    productId: number,
    surveyType: SurveyType,
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

    if (surveyType === SurveyType.BEFORE) {
      updateData.beforeHealthType = lowestCategory;
      updateData.beforeScoreSkinHealth = categoryScores.SKIN_HEALTH;
      updateData.beforeScoreMetabolism = categoryScores.METABOLISM;
      updateData.beforeScoreImmune = categoryScores.IMMUNE_BALANCE;
      updateData.beforeScoreGutHealth = categoryScores.GUT_HEALTH;
      updateData.beforeCompletedAt = getNowKST();
    } else {
      updateData.afterHealthType = lowestCategory;
      updateData.afterScoreSkinHealth = categoryScores.SKIN_HEALTH;
      updateData.afterScoreMetabolism = categoryScores.METABOLISM;
      updateData.afterScoreImmune = categoryScores.IMMUNE_BALANCE;
      updateData.afterScoreGutHealth = categoryScores.GUT_HEALTH;
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
   * 설문 완료 시 활성 챌린지가 있으면 진행상황 업데이트
   */
  private async processChallengeIntegration(
    tx: Prisma.TransactionClient,
    userId: number,
    surveyId: number,
    surveyType: SurveyType
  ): Promise<void> {
    try {
      // 사후 문진은 별도 처리 없음 (추후 앱에서 호출 시 구현)
      if (surveyType === SurveyType.AFTER) {
        this.logger.log(`사후 문진 완료 - 사용자: ${userId}`);
        return;
      }

      // 사전 문진(BEFORE)인 경우
      const userChallenge = await tx.userChallenge.findFirst({
        where: {
          userId,
          status: UserChallengeStatus.ACTIVE
        },
        include: { product: true },
        orderBy: { createdAt: 'desc' }
      });

      if (!userChallenge) {
        this.logger.log(`설문 완료 - 챌린지 없음 (사용자: ${userId})`);
        return;
      }

      const today = getNowKST();
      const todayStr = today.toISOString().split('T')[0];
      const currentDay = calculateChallengeDay(userChallenge.activatedAt);

      const todaySurvey = await tx.challengeSurvey.findFirst({
        where: {
          productId: userChallenge.productId,
          day: currentDay,
          surveyId,
          isActive: true
        },
        include: { survey: true }
      });

      if (!todaySurvey) {
        this.logger.log(`설문 완료 - 완료한 설문(${surveyId})이 오늘(${currentDay}일차) 챌린지 설문이 아님`);
        return;
      }

      // 4️⃣ DailyProgress 조회/생성
      let dailyProgress = await tx.dailyProgress.findFirst({
        where: {
          userChallengeId: userChallenge.id,
          day: currentDay
        }
      });

      if (!dailyProgress) {
        const now = getNowKST();
        dailyProgress = await tx.dailyProgress.create({
          data: {
            userChallengeId: userChallenge.id,
            day: currentDay,
            date: new Date(todayStr),
            createdAt: now,
            updatedAt: now
          }
        });
      }

      // 5️⃣ DailyProgress 업데이트
      await tx.dailyProgress.update({
        where: {
          userChallengeId_day: {
            userChallengeId: userChallenge.id,
            day: currentDay
          }
        },
        data: {
          surveysCompleted: { increment: 1 }
        }
      });

      this.logger.log(`설문 완료 챌린지 연동 성공 - 사용자: ${userId}, 설문: ${todaySurvey.survey.name}, 타입: ${surveyType}`);

    } catch (error) {
      this.logger.error('설문 완료 챌린지 연동 실패:', error);
      // 챌린지 연동 실패해도 설문 완료는 진행
    }
  }

  /**
   * 설문 결과 조회
   */
  async findResults(userId: number, type?: SurveyType) {
    const results = [];

    if (!type || type === SurveyType.BEFORE) {
      try {
        const beforeResult = await this.analyzeSurveyResult(userId, SurveyType.BEFORE);
        results.push({
          type: SurveyType.BEFORE,
          ...beforeResult,
          createdAt: getNowKST(),
        });
      } catch (error) {
        // 결과가 없으면 무시
      }
    }

    if (!type || type === SurveyType.AFTER) {
      try {
        const afterResult = await this.analyzeSurveyResult(userId, SurveyType.AFTER);
        results.push({
          type: SurveyType.AFTER,
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
    const beforeHealthTypeAnimal = result.beforeHealthType
      ? await this.prisma.healthTypeAnimal.findFirst({
          where: { healthType: result.beforeHealthType },
        })
      : null;

    // After 동물 캐릭터 정보
    const afterHealthTypeAnimal = result.afterHealthType
      ? await this.prisma.healthTypeAnimal.findFirst({
          where: { healthType: result.afterHealthType },
        })
      : null;

    return {
      userId,
      surveyId,
      productId: challengeSurvey.productId,
      before: {
        category: result.beforeHealthType,
        animalCharacter: beforeHealthTypeAnimal?.animalName,
        characterKeyword: beforeHealthTypeAnimal?.catchphrase,
        detailedFeatures: beforeHealthTypeAnimal?.symptoms,
        scores: {
          skinHealth: result.beforeScoreSkinHealth,
          metabolism: result.beforeScoreMetabolism,
          immune: result.beforeScoreImmune,
          gutHealth: result.beforeScoreGutHealth,
        },
        completedAt: result.beforeCompletedAt,
      },
      after: result.afterHealthType ? {
        category: result.afterHealthType,
        animalCharacter: afterHealthTypeAnimal?.animalName,
        characterKeyword: afterHealthTypeAnimal?.catchphrase,
        detailedFeatures: afterHealthTypeAnimal?.symptoms,
        scores: {
          skinHealth: result.afterScoreSkinHealth,
          metabolism: result.afterScoreMetabolism,
          immune: result.afterScoreImmune,
          gutHealth: result.afterScoreGutHealth,
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
    if (!result.beforeHealthType || !result.afterHealthType) {
      return null;
    }

    const beforeTotalScore =
      (result.beforeScoreSkinHealth || 0) +
      (result.beforeScoreMetabolism || 0) +
      (result.beforeScoreImmune || 0) +
      (result.beforeScoreGutHealth || 0);

    const afterTotalScore =
      (result.afterScoreSkinHealth || 0) +
      (result.afterScoreMetabolism || 0) +
      (result.afterScoreImmune || 0) +
      (result.afterScoreGutHealth || 0);

    return {
      totalScoreImprovement: afterTotalScore - beforeTotalScore,
      categoryScoreChanges: {
        skinHealth: (result.afterScoreSkinHealth || 0) - (result.beforeScoreSkinHealth || 0),
        metabolism: (result.afterScoreMetabolism || 0) - (result.beforeScoreMetabolism || 0),
        immune: (result.afterScoreImmune || 0) - (result.beforeScoreImmune || 0),
        gutHealth: (result.afterScoreGutHealth || 0) - (result.beforeScoreGutHealth || 0),
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
    const beforeResult = await this.analyzeSurveyResult(userId, SurveyType.BEFORE);
    const afterResult = await this.analyzeSurveyResult(userId, SurveyType.AFTER);

    const categoryImprovements: Record<string, number> = {};
    
    for (const category of Object.keys(beforeResult.categoryScores)) {
      const before = beforeResult.categoryScores[category] || 0;
      const after = afterResult.categoryScores[category] || 0;
      categoryImprovements[category] = after - before;
    }

    // SurveyResultResponseDto 형식으로 변환
    const formatResult = (result: any, type: SurveyType) => ({
      id: 0, // 실제 저장된 결과가 아님
      userId,
      type,
      skinHealthScore: result.categoryScores[HealthCategory.SKIN_HEALTH] || 0,
      metabolismScore: result.categoryScores[HealthCategory.METABOLISM] || 0,
      immuneBalanceScore: result.categoryScores[HealthCategory.IMMUNE_BALANCE] || 0,
      gutHealthScore: result.categoryScores[HealthCategory.GUT_HEALTH] || 0,
      totalScore: result.totalScore,
      dominantCategory: result.dominantCategory,
      animalCharacter: result.animalCharacter,
      animal: result.animalCharacter,
      calculatedAt: getNowKST(),
      createdAt: getNowKST(),
      updatedAt: getNowKST(),
    });

    return {
      before: formatResult(beforeResult, SurveyType.BEFORE),
      after: formatResult(afterResult, SurveyType.AFTER),
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
   * @param surveyId 설문 ID
   * @param categoryCode 카테고리 코드
   * @param surveyType 설문 옵션 타입 (PRE_SURVEY: 사전문진, DAILY: 데일리문진)
   */
  async findQuestions(surveyId?: number, categoryCode?: string, surveyType: string = SurveyOptionType.PRE_SURVEY) {
    this.logger.log(`설문 질문 조회 - surveyId: ${surveyId || '전체'}, 카테고리: ${categoryCode || '전체'}, 타입: ${surveyType}`);

    // 타입별 옵션 조회
    const options = await this.prisma.surveyOption.findMany({
      where: {
        isActive: true,
        surveyType: surveyType,
      },
      select: {
        id: true,
        optionText: true,
        score: true
      },
      orderBy: { score: 'asc' }
    });

    const questions = await this.prisma.surveyQuestion.findMany({
      where: {
        isActive: true,
        ...(surveyId && { surveyId }),
        ...(categoryCode && { categoryCode }),
      },
      orderBy: [
        { sortOrder: 'asc' }  // 일단 sortOrder로 정렬
      ],
    });

    // 커스텀 카테고리 순서: 염증 → 대사밸런스 → 장건강 → 면역과민반응
    const categoryOrder: Record<string, number> = {
      [HealthCategory.SKIN_HEALTH]: 1,
      [HealthCategory.METABOLISM]: 2,
      [HealthCategory.GUT_HEALTH]: 3,
      [HealthCategory.IMMUNE_BALANCE]: 4,
    };

    // 카테고리 순서 → sortOrder 순으로 정렬
    const sortedQuestions = questions.sort((a, b) => {
      const categoryDiff = (categoryOrder[a.categoryCode] || 999) - (categoryOrder[b.categoryCode] || 999);
      if (categoryDiff !== 0) return categoryDiff;
      return a.sortOrder - b.sortOrder;
    });

    // 각 질문에 옵션 추가
    return sortedQuestions.map(question => ({
      ...question,
      options: options.map(opt => ({
        id: opt.id,
        text: opt.optionText,
        score: opt.score
      }))
    }));
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
    });

    if (!question) {
      throw new NotFoundException(`설문 질문 ID ${id}를 찾을 수 없습니다.`);
    }

    return question;
  }

  // ==================== 테스트용 메서드 ====================

  /**
   * [테스트] 사전설문 답변 배치 등록
   * 2D 배열로 여러 사용자의 설문 답변을 한 번에 등록
   * 각 배열: [userId, ...25개 optionId]
   * questionId 매핑: [1~20, 41~45] 총 25개
   * type: BEFORE 고정
   * surveyId: 1 고정 (현재 미사용, 향후 확장용)
   */
  async createBulkAnswersTest(
    data: number[][]
  ): Promise<{ success: boolean; userId: number; count?: number; error?: string }[]> {
    this.logger.log(`[테스트] 사전설문 배치 등록 시작 - ${data.length}명`);

    // questionId 매핑: 1~20, 41~45 총 25개
    const questionIds = [
      1, 2, 3, 4, 5, 6, 7, 8, 9, 10,
      11, 12, 13, 14, 15, 16, 17, 18, 19, 20,
      41, 42, 43, 44, 45
    ];

    const results: { success: boolean; userId: number; count?: number; error?: string }[] = [];

    for (const row of data) {
      const userId = row[0];
      const optionIds = row.slice(1); // 25개 optionId

      if (optionIds.length !== 25) {
        results.push({
          success: false,
          userId,
          error: `optionId 개수가 25개가 아닙니다 (${optionIds.length}개)`,
        });
        continue;
      }

      try {
        // 트랜잭션으로 처리
        const createdCount = await this.prisma.$transaction(async (tx) => {
          // 기존 BEFORE 답변 삭제 (덮어쓰기)
          await tx.surveyAnswer.deleteMany({
            where: {
              userId,
              type: SurveyType.BEFORE,
            },
          });

          // 새 답변 저장
          const now = getNowKST();
          await tx.surveyAnswer.createMany({
            data: questionIds.map((questionId, index) => ({
              userId,
              surveyQuestionId: questionId,
              surveyOptionId: optionIds[index],
              type: SurveyType.BEFORE,
              createdAt: now,
            })),
          });

          return 25;
        });

        results.push({
          success: true,
          userId,
          count: createdCount,
        });

        this.logger.log(`[테스트] 사용자 ${userId} 사전설문 등록 완료 - ${createdCount}개`);
      } catch (error) {
        results.push({
          success: false,
          userId,
          error: error.message,
        });
        this.logger.error(`[테스트] 사용자 ${userId} 사전설문 등록 실패`, error);
      }
    }

    return results;
  }

  /**
   * 사용자의 활성 챌린지 기반 설문 ID 조회
   * @param userId 사용자 ID
   * @param type 설문 타입 (BEFORE/AFTER) - Survey.type으로 필터링
   * @returns challengeSurveyId (challenge_surveys 테이블의 PK)
   */
  async findMySurveyId(userId: number, type: SurveyType): Promise<number> {
    this.logger.log(`사용자 ${userId}의 활성 챌린지 설문 ID 조회 - 타입: ${type}`);

    // 1. 사용자의 활성 챌린지 조회
    const userChallenge = await this.prisma.userChallenge.findFirst({
      where: {
        userId,
        status: UserChallengeStatus.ACTIVE,
      },
      select: {
        productId: true,
      },
    });

    let productId: number;

    if (userChallenge) {
      productId = userChallenge.productId;
    } else {
      // 활성 챌린지가 없으면 기본 챌린지 상품에서 조회
      this.logger.log(`사용자 ${userId}의 활성 챌린지 없음 - 기본 챌린지 상품 조회`);
      const defaultProduct = await this.findDefaultChallengeProduct();
      productId = defaultProduct.id;
    }

    // 2. 해당 상품의 설문 조회 (Survey.type으로 필터링)
    const challengeSurvey = await this.prisma.challengeSurvey.findFirst({
      where: {
        productId,
        isActive: true,
        survey: {
          type: type,
          isActive: true,
        },
      },
      select: {
        id: true,
        surveyId: true,
      },
    });

    if (!challengeSurvey) {
      throw new NotFoundException(`${type === SurveyType.BEFORE ? '사전' : '사후'}설문이 연결되어 있지 않습니다.`);
    }

    this.logger.log(`사용자 ${userId}의 챌린지 설문 ID: ${challengeSurvey.id} (surveyId: ${challengeSurvey.surveyId}, type: ${type})`);

    return challengeSurvey.id;
  }

  /**
   * 기본 챌린지 상품 조회
   * ChallengeSurvey가 연결된 가장 첫 번째 상품 반환
   *
   * TODO: 추후 challenge, survey, mission 관계 재정비 후 ChallengeSurvey 테이블을 안 쓸 수도 있음
   * 그때 이 로직도 함께 수정 필요
   */
  private async findDefaultChallengeProduct(): Promise<{ id: number }> {
    // ChallengeSurvey가 연결된 상품 중 가장 오래된(id가 작은) 상품 조회
    const challengeSurvey = await this.prisma.challengeSurvey.findFirst({
      where: {
        isActive: true,
      },
      orderBy: {
        productId: 'asc',
      },
      select: {
        productId: true,
      },
    });

    if (!challengeSurvey) {
      throw new NotFoundException('설문이 연결된 챌린지 상품이 없습니다.');
    }

    this.logger.log(`기본 챌린지 상품 조회 완료 - productId: ${challengeSurvey.productId}`);

    return { id: challengeSurvey.productId };
  }

  /**
   * 사용자의 활성 챌린지 기반 설문 질문 조회
   * @param userId 사용자 ID
   * @param type 설문 타입 (BEFORE/AFTER)
   * @returns 설문 질문 목록
   */
  async findMyQuestions(userId: number, type: SurveyType) {
    const challengeSurveyId = await this.findMySurveyId(userId, type);

    const challengeSurvey = await this.prisma.challengeSurvey.findUnique({
      where: { id: challengeSurveyId },
      select: { surveyId: true },
    });

    if (!challengeSurvey) {
      throw new NotFoundException('챌린지 설문 매핑을 찾을 수 없습니다.');
    }

    return await this.findQuestions(challengeSurvey.surveyId);
  }

  /**
   * 사용자의 활성 챌린지 기반 설문 완료
   * @param userId 사용자 ID
   * @param type 설문 타입 (BEFORE/AFTER)
   * @param answers 답변 목록
   */
  async completeMySurvey(
    userId: number,
    type: SurveyType,
    answers: Array<{ questionId: number; optionId: number }>,
  ) {
    const challengeSurveyId = await this.findMySurveyId(userId, type);

    const challengeSurvey = await this.prisma.challengeSurvey.findUnique({
      where: { id: challengeSurveyId },
      select: { surveyId: true },
    });

    if (!challengeSurvey) {
      throw new NotFoundException('챌린지 설문 매핑을 찾을 수 없습니다.');
    }

    return await this.completeSurveyById(userId, challengeSurvey.surveyId, type, answers);
  }

  /**
   * 질문별 답변 조회
   */
  async findAnswersByQuestion(questionId: number, type?: SurveyType) {
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