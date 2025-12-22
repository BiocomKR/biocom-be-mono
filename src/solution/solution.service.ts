import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { SibApiService } from '../sib/services/sib-api.service';
import { FoodLevelItem } from '../sib/interfaces/sib-response.interface';
import {
  SolutionResponseDto,
  HealthTypeAnimalDto,
  SupplementProductDto,
  DietProductDto,
  LineupDto,
  IngredientLevelDto,
} from './dto/solution.dto';

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
                images: {
                  where: { imageType: 'MAIN' },
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
    let foodLevelResult: FoodLevelItem | null = null;
    if (user.mobile) {
      foodLevelResult = await this.getFoodLevelResult(user.mobile);
    }

    // 5. 영양제 추천 목록 (type = 'SUPPLEMENT')
    const supplements = this.mapSupplements(
      healthTypeAnimal.recommendedProducts.filter(
        (rp) => rp.type === 'SUPPLEMENT',
      ),
    );

    // 6. 식단 추천 목록 (type = 'DIET') - SIB 결과 포함
    const diets = this.mapDiets(
      healthTypeAnimal.recommendedProducts.filter((rp) => rp.type === 'DIET'),
      foodLevelResult,
    );

    // 7. 라인업 목록 조회
    const lineups = await this.getLineups();

    return {
      animal,
      supplements,
      diets,
      lineups,
    };
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
      solution: healthTypeAnimal.solution || undefined,
      imageUrl: thumbnailImage || healthTypeAnimal.imageUrl || undefined,
      metadata: healthTypeAnimal.metadata as any,
    };
  }

  /**
   * 영양제 추천 목록 매핑
   * - displayOrder 순 정렬
   * - keyword로 슬라이드바 구분 (맞춤 포뮬러, 장건강 등)
   */
  private mapSupplements(recommendedProducts: any[]): SupplementProductDto[] {
    return recommendedProducts.map((rp) => {
      const product = rp.product;
      const thumbnail = product.images?.[0]?.imageUrl || undefined;

      return {
        id: product.id,
        name: product.name,
        thumbnail,
        keyword: rp.keyword || undefined,
        originalPrice: product.originalPrice
          ? Number(product.originalPrice)
          : undefined,
        price: product.price ? Number(product.price) : undefined,
        recommendReason: rp.recommendReason || undefined,
        dosage: rp.dosage || undefined,
        mechanisms: Array.isArray(rp.mechanisms) ? rp.mechanisms : undefined,
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
    foodLevelResult: FoodLevelItem | null,
  ): DietProductDto[] {
    const diets: DietProductDto[] = recommendedProducts.map((rp) => {
      const product = rp.product;
      const thumbnail = product.images?.[0]?.imageUrl || undefined;

      // 식재료 목록 (metadata에서 가져오기)
      const metadata = product.metadata as { ingredients?: string[] } | null;
      const ingredients = metadata?.ingredients || [];

      // SIB 결과로 레벨 분류
      let ingredientLevels: IngredientLevelDto | undefined;
      let isEdible = true; // 기본값: 먹을 수 있음

      if (foodLevelResult && ingredients.length > 0) {
        ingredientLevels = this.classifyIngredientsByLevel(
          ingredients,
          foodLevelResult,
        );
        // 4,5단계 식재료가 하나라도 있으면 먹을 수 없음
        isEdible = ingredientLevels.caution.length === 0;
      }

      // 라인업 정보
      const lineup = product.lineup
        ? {
            id: product.lineup.id,
            key: product.lineup.key,
            name: product.lineup.name,
            description: product.lineup.description || undefined,
            sortOrder: product.lineup.sortOrder,
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
        originalPrice: product.originalPrice
          ? Number(product.originalPrice)
          : undefined,
        price: product.price ? Number(product.price) : undefined,
        recommendReason: rp.recommendReason || undefined,
        dosage: rp.dosage || undefined,
        lineup,
        nutrition: {
          calories: product.calories ? Number(product.calories) : undefined,
          netCarbs: product.netCarbs ? Number(product.netCarbs) : undefined,
          protein: product.protein ? Number(product.protein) : undefined,
          fat: product.fat ? Number(product.fat) : undefined,
          fiber: product.fiber ? Number(product.fiber) : undefined,
        },
        ingredients: ingredients.length > 0 ? ingredients : undefined,
        ingredientLevels,
        isEdible,
        displayOrder: rp.displayOrder,
      };
    });

    // 가나다순 정렬 (먹을 수 있는 것 먼저, 그 다음 가나다순)
    return diets.sort((a, b) => {
      // 먹을 수 있는 것 먼저
      if (a.isEdible !== b.isEdible) {
        return a.isEdible ? -1 : 1;
      }
      // 가나다순
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
      sortOrder: l.sortOrder,
    }));
  }

  /**
   * SIB 음식물 과민증 검사 결과 조회
   * @param mobile 전화번호
   * @returns 레벨별 음식 목록 또는 null
   */
  private async getFoodLevelResult(
    mobile: string,
  ): Promise<FoodLevelItem | null> {
    try {
      // 1. 전화번호로 차트 ID 조회
      const homeExamInfo = await this.sibApiService.getHomeExamInfo(mobile);

      if (!homeExamInfo.chartId) {
        this.logger.debug(`SIB 검사 결과 없음 (mobile: ${mobile})`);
        return null;
      }

      // 2. 차트 ID로 IgG 레벨 조회
      const iggLevels = await this.sibApiService.getIggLevels(
        homeExamInfo.chartId,
      );

      if (!iggLevels || iggLevels.length === 0) {
        this.logger.debug(
          `IgG 레벨 조회 실패 (chartId: ${homeExamInfo.chartId})`,
        );
        return null;
      }

      // 첫 번째 결과 반환 (일반적으로 하나)
      return iggLevels[0];
    } catch (error) {
      this.logger.error(`SIB 검사 결과 조회 실패 (mobile: ${mobile}):`, error);
      return null;
    }
  }

  /**
   * 식재료를 SIB 레벨별로 분류
   * - safe: 1-3단계 (안전)
   * - caution: 4-5단계 (주의)
   *
   * @param ingredients 상품 식재료 목록
   * @param foodLevelResult SIB 검사 결과
   * @returns 레벨별 분류된 식재료
   */
  private classifyIngredientsByLevel(
    ingredients: string[],
    foodLevelResult: FoodLevelItem,
  ): IngredientLevelDto {
    // SIB 결과에서 레벨별 식재료 파싱 (쉼표 구분)
    const safeFoods = new Set<string>();
    const cautionFoods = new Set<string>();

    // 1-3단계: 안전
    [foodLevelResult.level1, foodLevelResult.level2, foodLevelResult.level3]
      .filter((level) => level && level !== '해당없음')
      .forEach((level) => {
        level.split(',').forEach((food) => {
          const trimmed = food.trim();
          if (trimmed) safeFoods.add(trimmed);
        });
      });

    // 4-5단계: 주의
    [foodLevelResult.level4, foodLevelResult.level5]
      .filter((level) => level && level !== '해당없음')
      .forEach((level) => {
        level.split(',').forEach((food) => {
          const trimmed = food.trim();
          if (trimmed) cautionFoods.add(trimmed);
        });
      });

    // 상품 식재료와 매칭
    const safe: string[] = [];
    const caution: string[] = [];

    for (const ingredient of ingredients) {
      // 정확히 일치하거나 포함 관계 체크
      const normalizedIngredient = ingredient.trim();

      // 주의 식품 매칭 (4-5단계 우선)
      const isCaution = [...cautionFoods].some(
        (food) =>
          food === normalizedIngredient ||
          food.includes(normalizedIngredient) ||
          normalizedIngredient.includes(food),
      );

      if (isCaution) {
        caution.push(normalizedIngredient);
        continue;
      }

      // 안전 식품 매칭 (1-3단계)
      const isSafe = [...safeFoods].some(
        (food) =>
          food === normalizedIngredient ||
          food.includes(normalizedIngredient) ||
          normalizedIngredient.includes(food),
      );

      if (isSafe) {
        safe.push(normalizedIngredient);
      }
    }

    return { safe, caution };
  }
}
