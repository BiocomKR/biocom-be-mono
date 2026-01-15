import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { SibApiService } from '../sib/services/sib-api.service';
import { ExamType, IGG_EXAM_TYPES } from '../sib/enums/exam-type.enum';
import { FoodLevelItem } from '../sib/interfaces/sib-response.interface';
import {
  SolutionResponseDto,
  HealthTypeAnimalDto,
  SupplementProductDto,
  DietProductDto,
  LineupDto,
  IngredientLevelDto,
  ConditionalProductDto,
  DietSolutionResponseDto,
  SupplementSolutionResponseDto,
  AnimalLineupDto,
} from './dto/solution.dto';
import {
  classifyIngredients,
  getGlutenLevel,
} from './utils/ingredient-mapper.util';
import { getNowKST } from '../common/utils/kst-date.util';

/**
 * 맞춤 솔루션 서비스
 * 건강유형별 영양제/식단 추천 데이터 제공
 */
@Injectable()
export class SolutionService {
  private readonly logger = new Logger(SolutionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly sibApiService: SibApiService,
  ) {}

  /**
   * 맞춤 솔루션 전체 데이터 조회
   * @param userId 사용자 ID
   * @returns 맞춤 솔루션 응답 데이터
   */
  async getSolution(userId: number): Promise<SolutionResponseDto> {
    // 1. 사용자 건강유형 및 전화번호 조회
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        health_type_animal_id: true,
        mobile: true,
        healthTypeAnimal: {
          select: { healthType: true },
        },
      },
    });

    if (!user?.healthTypeAnimal?.healthType) {
      throw new NotFoundException(
        '건강유형이 설정되지 않았습니다. 검사를 먼저 완료해주세요.',
      );
    }

    // 2. 건강유형 동물 정보 조회
    const healthTypeAnimal = await this.prisma.healthTypeAnimal.findUnique({
      where: { healthType: user.healthTypeAnimal.healthType },
      include: {
        // 동물 썸네일 이미지
        images: {
          where: { imageType: 'THUMBNAIL' },
          include: { file: true },
          take: 1,
        },
        recommendedProducts: {
          where: { isActive: true },
          include: {
            product: {
              include: {
                lineup: true,
                productFiles: {
                  where: { imageType: 'MAIN' },
                  include: { file: true },
                  take: 1,
                },
              },
            },
          },
          orderBy: [{ type: 'asc' }, { displayOrder: 'asc' }],
        },
      },
    });

    if (!healthTypeAnimal) {
      throw new NotFoundException('건강유형 정보를 찾을 수 없습니다.');
    }

    // 3. 동물 정보 매핑
    const animal = this.mapAnimal(healthTypeAnimal);

    // 4. SIB 음식물 과민증 검사 결과 조회
    const sibResult = user.mobile
      ? await this.getFoodLevelResult(userId, user.mobile)
      : null;

    // metadata에서 intakeGuide 추출
    const metadata = healthTypeAnimal.metadata as {
      intakeGuide?: {
        diet?: { routine?: string; synergy?: string };
        supplement?: { formula?: string };
      };
      dietRecommendation?: {
        lunch?: { lineupKey?: string };
        dinner?: { lineupKey?: string };
      };
    } | null;

    // 5. 영양제 추천 목록 - FORMULA를 맨 앞에, SUPPLEMENT는 뒤에
    const supplementFormula = metadata?.intakeGuide?.supplement?.formula;
    const formulaProducts = healthTypeAnimal.recommendedProducts.filter(
      (rp: { type: string }) => rp.type === 'FORMULA',
    );
    const supplementProducts = healthTypeAnimal.recommendedProducts.filter(
      (rp: { type: string }) => rp.type === 'SUPPLEMENT',
    );
    const supplements = this.mapSupplements(
      [...formulaProducts, ...supplementProducts],
      supplementFormula,
    );

    // 6. 식단 추천 목록 (type = 'DIET') - SIB 결과 포함
    const diets = this.mapDiets(
      healthTypeAnimal.recommendedProducts.filter((rp: { type: string }) => rp.type === 'DIET'),
      sibResult,
    );

    // 7. 라인업 목록 조회
    const lineups = await this.getLineups();

    // 8. 식단 섭취 가이드 (별도 필드)
    const dietGuideRaw = metadata?.intakeGuide?.diet;
    const dietGuide = dietGuideRaw?.routine || dietGuideRaw?.synergy
      ? {
          ...dietGuideRaw,
          items: [
            ...(dietGuideRaw.routine ? [{ label: '루틴', content: dietGuideRaw.routine }] : []),
            ...(dietGuideRaw.synergy ? [{ label: '시너지', content: dietGuideRaw.synergy }] : []),
          ],
        }
      : undefined;

    // 9. 조건부 추천 제품 (메타드림/리셋데이)
    const conditionalProducts = await this.getConditionalProducts(
      userId,
      healthTypeAnimal.id,
      sibResult,
    );

    return {
      animal,
      supplements,
      diets,
      lineups,
      dietGuide,
      conditionalProducts: conditionalProducts.length > 0 ? conditionalProducts : undefined,
    };
  }

  /**
   * 식단 솔루션 조회
   * GET /api/solution/diet
   */
  async getDietSolution(userId: number): Promise<DietSolutionResponseDto> {
    // 1. 사용자 건강유형 및 전화번호 조회
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        health_type_animal_id: true,
        mobile: true,
        healthTypeAnimal: {
          select: { healthType: true },
        },
      },
    });

    if (!user?.healthTypeAnimal?.healthType) {
      throw new NotFoundException(
        '건강유형이 설정되지 않았습니다. 검사를 먼저 완료해주세요.',
      );
    }

    // 2. 건강유형 동물 정보 조회
    const healthTypeAnimal = await this.prisma.healthTypeAnimal.findUnique({
      where: { healthType: user.healthTypeAnimal.healthType },
      include: {
        images: {
          where: { imageType: 'THUMBNAIL' },
          include: { file: true },
          take: 1,
        },
        recommendedProducts: {
          where: { isActive: true, type: 'DIET' },
          include: {
            product: {
              include: {
                lineup: true,
                productFiles: {
                  where: { imageType: 'MAIN' },
                  include: { file: true },
                  take: 1,
                },
              },
            },
          },
          orderBy: { displayOrder: 'asc' },
        },
      },
    });

    if (!healthTypeAnimal) {
      throw new NotFoundException('건강유형 정보를 찾을 수 없습니다.');
    }

    // 3. 동물 정보 매핑
    const animal = this.mapAnimal(healthTypeAnimal);

    // 4. SIB 음식물 과민증 검사 결과 조회
    const sibResult = user.mobile
      ? await this.getFoodLevelResult(userId, user.mobile)
      : null;

    // 5. metadata에서 추출
    const metadata = healthTypeAnimal.metadata as {
      intakeGuide?: {
        diet?: { routine?: string; synergy?: string };
      };
      lineupDescriptions?: Array<{
        lineupKey: string;
        priority: number;
        description: string;
      }>;
    } | null;

    // 6. 식단 추천 목록
    const diets = this.mapDiets(
      healthTypeAnimal.recommendedProducts,
      sibResult,
    );

    // 7. 라인업 목록 조회 (동물별 설명 포함)
    const lineups = await this.getLineupsWithAnimalDescription(
      metadata?.lineupDescriptions || [],
    );

    // 8. 식단 섭취 가이드
    const dietGuideRaw = metadata?.intakeGuide?.diet;
    const dietGuide = dietGuideRaw?.routine || dietGuideRaw?.synergy
      ? {
          ...dietGuideRaw,
          items: [
            ...(dietGuideRaw.routine ? [{ label: '루틴', content: dietGuideRaw.routine }] : []),
            ...(dietGuideRaw.synergy ? [{ label: '시너지', content: dietGuideRaw.synergy }] : []),
          ],
        }
      : undefined;

    // 9. solutionSeenAt 갱신 (솔루션 조회 시점 기록)
    await this.prisma.user.update({
      where: { id: userId },
      data: { solutionSeenAt: getNowKST() },
    });

    return {
      animal,
      lineups,
      diets,
      dietGuide,
    };
  }

  /**
   * 영양제 솔루션 조회
   * GET /api/solution/supplement
   */
  async getSupplementSolution(userId: number): Promise<SupplementSolutionResponseDto> {
    // 1. 사용자 건강유형 및 전화번호 조회
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        health_type_animal_id: true,
        mobile: true,
        healthTypeAnimal: {
          select: { healthType: true },
        },
      },
    });

    if (!user?.healthTypeAnimal?.healthType) {
      throw new NotFoundException(
        '건강유형이 설정되지 않았습니다. 검사를 먼저 완료해주세요.',
      );
    }

    // 2. 건강유형 동물 정보 조회
    const healthTypeAnimal = await this.prisma.healthTypeAnimal.findUnique({
      where: { healthType: user.healthTypeAnimal.healthType },
      include: {
        images: {
          where: { imageType: 'THUMBNAIL' },
          include: { file: true },
          take: 1,
        },
        recommendedProducts: {
          where: {
            isActive: true,
            type: { in: ['FORMULA', 'SUPPLEMENT', 'CONDITIONAL'] },
          },
          include: {
            product: {
              include: {
                productFiles: {
                  where: { imageType: 'MAIN' },
                  include: { file: true },
                  take: 1,
                },
              },
            },
          },
          orderBy: [{ type: 'asc' }, { displayOrder: 'asc' }],
        },
      },
    });

    if (!healthTypeAnimal) {
      throw new NotFoundException('건강유형 정보를 찾을 수 없습니다.');
    }

    // 3. 동물 정보 매핑
    const animal = this.mapAnimal(healthTypeAnimal);

    // 4. SIB 음식물 과민증 검사 결과 조회 (조건부 추천용)
    const sibResult = user.mobile
      ? await this.getFoodLevelResult(userId, user.mobile)
      : null;

    // 5. metadata에서 추출
    const metadata = healthTypeAnimal.metadata as {
      intakeGuide?: {
        supplement?: { formula?: string };
      };
    } | null;

    // 6. 영양제 추천 목록
    const supplementFormula = metadata?.intakeGuide?.supplement?.formula;
    const formulaProducts = healthTypeAnimal.recommendedProducts.filter(
      (rp: { type: string }) => rp.type === 'FORMULA',
    );
    const supplementProducts = healthTypeAnimal.recommendedProducts.filter(
      (rp: { type: string }) => rp.type === 'SUPPLEMENT',
    );
    const supplements = this.mapSupplements(
      [...formulaProducts, ...supplementProducts],
      supplementFormula,
    );

    // 7. 조건부 추천 제품
    const conditionalProducts = await this.getConditionalProducts(
      userId,
      healthTypeAnimal.id,
      sibResult,
    );

    // 8. solutionSeenAt 갱신 (솔루션 조회 시점 기록)
    await this.prisma.user.update({
      where: { id: userId },
      data: { solutionSeenAt: getNowKST() },
    });

    return {
      animal,
      supplements,
      conditionalProducts: conditionalProducts.length > 0 ? conditionalProducts : undefined,
    };
  }

  /**
   * 라인업 목록 조회 (동물별 설명 포함)
   */
  private async getLineupsWithAnimalDescription(
    lineupDescriptions: Array<{ lineupKey: string; priority: number; description: string }>,
  ): Promise<AnimalLineupDto[]> {
    const lineups = await this.prisma.productLineup.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    // lineupDescriptions를 Map으로 변환
    const descriptionMap = new Map(
      lineupDescriptions.map((ld) => [ld.lineupKey, ld]),
    );

    return lineups.map((l) => {
      const animalDesc = descriptionMap.get(l.key);
      return {
        id: l.id,
        key: l.key,
        name: l.name,
        description: animalDesc?.description || l.description || undefined,
        imageUrl: l.imageUrl || undefined,
        sortOrder: l.sortOrder,
        originalPrice: l.originalPrice ? Number(l.originalPrice) : undefined,
        price: l.price ? Number(l.price) : undefined,
        priority: animalDesc?.priority,
      };
    });
  }

  /**
   * 건강유형 동물 정보 매핑
   */
  private mapAnimal(healthTypeAnimal: any): HealthTypeAnimalDto {
    // 썸네일 이미지는 images 관계에서 가져옴
    const thumbnailImage = healthTypeAnimal.images?.[0]?.file?.filePath;

    return {
      healthType: healthTypeAnimal.healthType,
      typeName: healthTypeAnimal.typeName,
      animalName: healthTypeAnimal.animalName,
      description: healthTypeAnimal.description || undefined,
      imageUrl: thumbnailImage || healthTypeAnimal.imageUrl || undefined,
    };
  }

  /**
   * 영양제 추천 목록 매핑
   * - FORMULA 타입: 맞춤솔루션 (synergyEffects 포함)
   * - SUPPLEMENT 타입: 단품 영양제 (mechanisms 포함)
   */
  private mapSupplements(
    recommendedProducts: any[],
    supplementFormula?: string,
  ): SupplementProductDto[] {
    return recommendedProducts.map((rp) => {
      const product = rp.product;
      const thumbnail = product.productFiles?.[0]?.file?.filePath || undefined;

      const isFormula = rp.type === 'FORMULA';

      // FORMULA 타입: mechanisms에 시너지 효과 데이터가 들어있음
      // SUPPLEMENT 타입: mechanisms에 작용기전 데이터가 들어있음
      let mechanisms: any[] | undefined;
      let synergyEffects: any | undefined;

      if (isFormula && rp.mechanisms) {
        // FORMULA: mechanisms 객체를 synergyEffects로 매핑
        synergyEffects = {
          synergyEffects: rp.mechanisms.synergyEffects,
        };
      } else if (Array.isArray(rp.mechanisms)) {
        // SUPPLEMENT: 배열 형태의 작용기전
        mechanisms = rp.mechanisms;
      }

      // FORMULA 타입이면 mechanisms.formulaName 사용, 아니면 product.name 사용
      const name = isFormula && rp.mechanisms?.formulaName
        ? rp.mechanisms.formulaName
        : product.name;

      return {
        id: product.id,
        name,
        thumbnail,
        type: rp.type,
        keyword: rp.keyword || undefined,
        originalPrice: product.originalPrice
          ? Number(product.originalPrice)
          : undefined,
        price: product.price ? Number(product.price) : undefined,
        recommendReason: rp.recommendReason || undefined,
        dosage: rp.dosage || undefined,
        mechanisms,
        synergyEffects,
        formula: isFormula ? supplementFormula : undefined,
        displayOrder: rp.displayOrder,
      };
    });
  }

  /**
   * 식단 추천 목록 매핑
   * - 라인업별 그룹화
   * - isEdible: 4,5단계 식재료 미포함 시 true
   * - 가나다순 정렬
   */
  private mapDiets(
    recommendedProducts: any[],
    sibResult: { data: FoodLevelItem; orderCode: string } | null,
  ): DietProductDto[] {
    const diets: DietProductDto[] = recommendedProducts.map((rp) => {
      const product = rp.product;
      const thumbnail = product.productFiles?.[0]?.file?.filePath || undefined;

      // 식재료 목록 (metadata에서 가져오기)
      const metadata = product.metadata as { ingredients?: string[] } | null;
      const ingredients = metadata?.ingredients || [];

      // SIB 결과로 레벨 분류 (새 매핑 유틸 사용)
      let ingredientLevels: IngredientLevelDto | undefined;
      let isEdible = true; // 기본값: 먹을 수 있음

      if (sibResult && ingredients.length > 0) {
        ingredientLevels = classifyIngredients(
          ingredients,
          sibResult.data,
          sibResult.orderCode,
        );
        // 4,5단계 식재료가 하나라도 있으면 먹을 수 없음
        isEdible = ingredientLevels.caution.length === 0;
      }

      // 라인업 정보 (가격 포함)
      const lineup = product.lineup
        ? {
            id: product.lineup.id,
            key: product.lineup.key,
            name: product.lineup.name,
            description: product.lineup.description || undefined,
            sortOrder: product.lineup.sortOrder,
            originalPrice: product.lineup.originalPrice
              ? Number(product.lineup.originalPrice)
              : undefined,
            price: product.lineup.price
              ? Number(product.lineup.price)
              : undefined,
          }
        : {
            id: 0,
            key: 'UNKNOWN',
            name: '기타',
            sortOrder: 999,
          };

      return {
        id: product.id,
        name: product.name,
        thumbnail,
        lineup,
        nutrition: {
          calories: product.calories ? Number(product.calories) : undefined,
          netCarbs: product.netCarbs ? Number(product.netCarbs) : undefined,
          protein: product.protein ? Number(product.protein) : undefined,
          fat: product.fat ? Number(product.fat) : undefined,
          fiber: product.fiber ? Number(product.fiber) : undefined,
        },
        ingredientLevels,
        isEdible,
        displayOrder: rp.displayOrder,
      };
    });

    // 4~5단계(caution) 식재료 개수 기준 오름차순 정렬
    // - 0개인 메뉴가 최상단
    // - 1개 포함된 메뉴가 그 다음
    // - 개수가 같으면 가나다순
    return diets.sort((a, b) => {
      const aCautionCount = a.ingredientLevels?.caution?.length || 0;
      const bCautionCount = b.ingredientLevels?.caution?.length || 0;

      // 4~5단계 식재료 개수 오름차순
      if (aCautionCount !== bCautionCount) {
        return aCautionCount - bCautionCount;
      }
      // 개수가 같으면 가나다순
      return a.name.localeCompare(b.name, 'ko');
    });
  }

  /**
   * 라인업 목록 조회
   */
  private async getLineups(): Promise<LineupDto[]> {
    const lineups = await this.prisma.productLineup.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    return lineups.map((l) => ({
      id: l.id,
      key: l.key,
      name: l.name,
      description: l.description || undefined,
      imageUrl: l.imageUrl || undefined,
      sortOrder: l.sortOrder,
      originalPrice: l.originalPrice ? Number(l.originalPrice) : undefined,
      price: l.price ? Number(l.price) : undefined,
    }));
  }

  /**
   * SIB 음식물 과민증 검사 결과 조회
   * - D0004(구), D0060(신) 중 최신 검사 결과 조회
   * - orderCode에 따라 신/구 API 분기 호출
   * - DB 캐싱 활용 (SIB 장애 시에도 캐시 데이터 반환)
   * @param userId 사용자 ID (캐시 저장용)
   * @param mobile 전화번호
   * @returns 레벨별 음식 목록 및 검사 타입, 또는 null
   */
  private async getFoodLevelResult(
    userId: number,
    mobile: string,
  ): Promise<{ data: FoodLevelItem; orderCode: string } | null> {
    try {
      // 1. 전화번호로 차트 목록 조회
      const chartList = await this.sibApiService.getChartIdByMobile(mobile);

      if (!chartList || chartList.length === 0) {
        this.logger.debug(`SIB 검사 결과 없음 (mobile: ${mobile})`);
        return null;
      }

      // 2. D0004, D0060만 필터링 후 최신순 정렬
      const iggExams = chartList
        .filter((exam) => IGG_EXAM_TYPES.includes(exam.orderCode as ExamType))
        .sort(
          (a, b) =>
            new Date(b.receiptDate).getTime() -
            new Date(a.receiptDate).getTime(),
        );

      if (iggExams.length === 0) {
        this.logger.debug(`지연성 알러지 검사 결과 없음 (mobile: ${mobile})`);
        return null;
      }

      const targetExam = iggExams[0];
      this.logger.debug(
        `SIB 검사 조회 - chartId: ${targetExam.chartID}, orderCode: ${targetExam.orderCode}`,
      );

      // 3. orderCode에 따라 신/구 API 분기 호출 (userId 전달하여 캐싱)
      let iggLevels;
      if (targetExam.orderCode === ExamType.IGG_OLD) {
        iggLevels = await this.sibApiService.getIggLevelsOld(targetExam.chartID, userId);
      } else {
        iggLevels = await this.sibApiService.getIggLevels(targetExam.chartID, userId);
      }

      if (!iggLevels || iggLevels.length === 0) {
        this.logger.debug(
          `IgG 레벨 조회 실패 (chartId: ${targetExam.chartID})`,
        );
        return null;
      }

      // 첫 번째 결과와 orderCode 함께 반환
      return {
        data: iggLevels[0],
        orderCode: targetExam.orderCode,
      };
    } catch (error) {
      this.logger.error(`SIB 검사 결과 조회 실패 (mobile: ${mobile}):`, error);
      return null;
    }
  }

  /**
   * 조건부 추천 제품 조회 (메타드림/리셋데이)
   * - 메타드림: 수면 문진 60점 이상일 때 추천
   * - 리셋데이: 글루텐 과민증 4~5단계일 때 추천
   */
  private async getConditionalProducts(
    userId: number,
    healthTypeAnimalId: number,
    sibResult: { data: FoodLevelItem; orderCode: string } | null,
  ): Promise<ConditionalProductDto[]> {
    // 1. CONDITIONAL 타입 제품 조회
    const conditionalProducts = await this.prisma.healthTypeAnimalProduct.findMany({
      where: {
        healthTypeAnimalId,
        type: 'CONDITIONAL',
        isActive: true,
      },
      include: {
        product: {
          include: {
            productFiles: {
              where: { imageType: 'MAIN' },
              include: { file: true },
              take: 1,
            },
          },
        },
      },
      orderBy: { displayOrder: 'asc' },
    });

    if (conditionalProducts.length === 0) {
      return [];
    }

    // 2. 사용자의 수면 점수 계산 (설문 응답에서 직접 계산)
    // SLEEP 카테고리 질문들의 점수 합산
    const sleepQuestions = await this.prisma.surveyQuestion.findMany({
      where: { categoryCode: 'SLEEP' },
      select: { id: true },
    });
    const sleepQuestionIds = sleepQuestions.map((q: { id: number }) => q.id);

    let sleepScore = 0;
    if (sleepQuestionIds.length > 0) {
      const sleepAnswers = await this.prisma.surveyAnswer.findMany({
        where: {
          userId,
          surveyQuestionId: { in: sleepQuestionIds },
        },
        include: {
          surveyOption: { select: { score: true } },
        },
        orderBy: { createdAt: 'desc' },
        take: sleepQuestionIds.length, // 최근 답변만
      });

      sleepScore = sleepAnswers.reduce(
        (sum: number, answer: { surveyOption?: { score: number } | null }) =>
          sum + (answer.surveyOption?.score || 0),
        0,
      );
    }

    // 3. 글루텐 과민 레벨 확인 (새 매핑 유틸 사용)
    const glutenLevel = sibResult
      ? getGlutenLevel(sibResult.data, sibResult.orderCode)
      : 0;

    // 4. 조건부 추천 매핑
    const result: ConditionalProductDto[] = [];

    for (const cp of conditionalProducts) {
      const product = cp.product;
      const thumbnail = product.productFiles?.[0]?.file?.filePath || undefined;

      // 메타드림: 수면 점수 60 이상인 경우에만 추천
      if (product.name === '메타드림' && sleepScore >= 60) {
        result.push({
          id: product.id,
          name: product.name,
          thumbnail,
          keyword: cp.keyword || undefined,
          originalPrice: product.originalPrice ? Number(product.originalPrice) : undefined,
          price: product.price ? Number(product.price) : undefined,
          recommendReason: cp.recommendReason || undefined,
          dosage: cp.dosage || undefined,
          mechanisms: Array.isArray(cp.mechanisms) ? cp.mechanisms : undefined,
        });
      }

      // 리셋데이: 글루텐 4~5단계인 경우에만 추천
      if (product.name === '리셋데이' && glutenLevel >= 4) {
        result.push({
          id: product.id,
          name: product.name,
          thumbnail,
          keyword: cp.keyword || undefined,
          originalPrice: product.originalPrice ? Number(product.originalPrice) : undefined,
          price: product.price ? Number(product.price) : undefined,
          recommendReason: cp.recommendReason || undefined,
          dosage: cp.dosage || undefined,
          mechanisms: Array.isArray(cp.mechanisms) ? cp.mechanisms : undefined,
        });
      }
    }

    return result;
  }
}
