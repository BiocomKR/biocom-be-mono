import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import {
  SolutionResponseDto,
  HealthTypeAnimalDto,
  RecommendProductDto,
  LineupDto,
  IngredientDto,
  TabRecommendationsDto,
} from './dto/solution.dto';

/**
 * 조건부 추천 상품 상수
 * 자주 변경되지 않는 데이터로 코드에서 관리
 */
const CONDITIONAL_PRODUCTS = {
  // 메타드림: 수면 관련 상품 (향후 productId 확정 시 업데이트)
  metadream: {
    productId: null as number | null, // TODO: 실제 productId로 교체
    name: '메타드림',
    description: '숙면을 도와 신진대사 회복을 돕습니다',
  },
  // 리셋데이: 단식 관련 상품 (향후 productId 확정 시 업데이트)
  resetDay: {
    productId: null as number | null, // TODO: 실제 productId로 교체
    name: '리셋데이',
    description: '간헐적 단식을 위한 프리미엄 식단입니다',
  },
};

/**
 * 맞춤 솔루션 서비스
 * 건강유형별 영양제/식단 추천 데이터 제공
 */
@Injectable()
export class SolutionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 맞춤 솔루션 전체 데이터 조회
   * @param userId 사용자 ID
   * @returns 맞춤 솔루션 응답 데이터
   */
  async getSolution(userId: number): Promise<SolutionResponseDto> {
    // 1. 사용자 건강유형 조회
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        health_type_animal_id: true,
        healthTypeAnimal: {
          select: { healthType: true }
        }
      },
    });

    if (!user?.healthTypeAnimal?.healthType) {
      throw new NotFoundException('건강유형이 설정되지 않았습니다. 검사를 먼저 완료해주세요.');
    }

    // 2. 건강유형 동물 정보 조회
    const healthTypeAnimal = await this.prisma.healthTypeAnimal.findUnique({
      where: { healthType: user.healthTypeAnimal.healthType },
      include: {
        recommendedProducts: {
          where: { isActive: true },
          include: {
            product: {
              include: {
                productIngredients: {
                  include: {
                    ingredient: true,
                  },
                },
                lineup: true,
                images: {
                  where: { imageType: 'MAIN' },
                  take: 1,
                },
              },
            },
          },
          orderBy: [{ type: 'asc' }, { priority: 'asc' }],
        },
      },
    });

    if (!healthTypeAnimal) {
      throw new NotFoundException('건강유형 정보를 찾을 수 없습니다.');
    }

    // 3. 동물 정보 매핑
    const animal = this.mapAnimal(healthTypeAnimal);

    // 4. 영양제 추천 목록 (type = 'SUPPLEMENT')
    const supplements = this.mapRecommendations(
      healthTypeAnimal.recommendedProducts.filter((rp) => rp.type === 'SUPPLEMENT'),
      false,
    );

    // 5. 식단 추천 목록 (type = 'DIET')
    const diets = this.mapRecommendations(
      healthTypeAnimal.recommendedProducts.filter((rp) => rp.type === 'DIET'),
      true,
    );

    // 6. 라인업 목록 조회
    const lineups = await this.getLineups();

    // 7. 알레르겐 목록 조회
    const allergens = await this.getAllergens();

    // 8. 조건부 추천 상품 조회
    const conditionalProducts = await this.getConditionalProducts();

    return {
      animal,
      supplements,
      diets,
      lineups,
      allergens,
      conditionalProducts,
    };
  }

  /**
   * 건강유형 동물 정보 매핑
   */
  private mapAnimal(healthTypeAnimal: any): HealthTypeAnimalDto {
    return {
      healthType: healthTypeAnimal.healthType,
      typeName: healthTypeAnimal.typeName,
      animalName: healthTypeAnimal.animalName,
      description: healthTypeAnimal.description,
      solution: healthTypeAnimal.solution,
      imageUrl: healthTypeAnimal.imageUrl,
      metadata: healthTypeAnimal.metadata as any,
    };
  }

  /**
   * 추천 상품 목록을 탭별(core/plus/condition)로 매핑
   */
  private mapRecommendations(
    recommendedProducts: any[],
    includeDietInfo: boolean,
  ): TabRecommendationsDto {
    const core: RecommendProductDto[] = [];
    const plus: RecommendProductDto[] = [];
    const condition: RecommendProductDto[] = [];

    for (const rp of recommendedProducts) {
      const product = this.mapProduct(rp, includeDietInfo);

      // priority 1 = CORE, 2 = PLUS, 3 = CONDITION
      switch (rp.priority) {
        case 1:
          core.push(product);
          break;
        case 2:
          plus.push(product);
          break;
        case 3:
          condition.push(product);
          break;
        default:
          // priority가 없으면 displayOrder 기준으로 core에 추가
          core.push(product);
      }
    }

    return { core, plus, condition };
  }

  /**
   * 단일 상품 매핑
   */
  private mapProduct(rp: any, includeDietInfo: boolean): RecommendProductDto {
    const product = rp.product;
    const thumbnail = product.images?.[0]?.imageUrl || undefined;

    const result: RecommendProductDto = {
      id: product.id,
      name: product.name,
      thumbnail,
      keyword: rp.keyword,
      recommendReason: rp.recommendReason,
      dosage: rp.dosage,
      mechanisms: Array.isArray(rp.mechanisms) ? rp.mechanisms : undefined,
      priority: rp.priority,
    };

    // 식단인 경우 추가 정보 포함
    if (includeDietInfo) {
      // 라인업
      if (product.lineup) {
        result.lineup = {
          id: product.lineup.id,
          key: product.lineup.key,
          name: product.lineup.name,
          description: product.lineup.description,
          sortOrder: product.lineup.sortOrder,
        };
      }

      // 영양 정보
      result.nutrition = {
        calories: product.calories ? Number(product.calories) : undefined,
        netCarbs: product.netCarbs ? Number(product.netCarbs) : undefined,
        protein: product.protein ? Number(product.protein) : undefined,
        fat: product.fat ? Number(product.fat) : undefined,
        fiber: product.fiber ? Number(product.fiber) : undefined,
      };

      // 알레르겐
      if (product.productIngredients?.length > 0) {
        result.allergens = product.productIngredients.map((pi: any) => ({
          id: pi.ingredient.id,
          key: pi.ingredient.key,
          code: pi.ingredient.code,
          name: pi.ingredient.name,
          nameEn: pi.ingredient.nameEn,
          category: pi.ingredient.category,
        }));
      }
    }

    return result;
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
   * 알레르겐 목록 조회
   */
  private async getAllergens(): Promise<IngredientDto[]> {
    const ingredients = await this.prisma.ingredient.findMany({
      where: { isActive: true },
      orderBy: { sortOrder: 'asc' },
    });

    return ingredients.map((i) => ({
      id: i.id,
      key: i.key,
      code: i.code,
      name: i.name,
      nameEn: i.nameEn || undefined,
      category: i.category || undefined,
    }));
  }

  /**
   * 조건부 추천 상품 조회
   */
  private async getConditionalProducts() {
    const result: SolutionResponseDto['conditionalProducts'] = {};

    // 메타드림
    if (CONDITIONAL_PRODUCTS.metadream.productId) {
      const metadreamProduct = await this.prisma.product.findUnique({
        where: { id: CONDITIONAL_PRODUCTS.metadream.productId },
        include: {
          images: {
            where: { imageType: 'MAIN' },
            take: 1,
          },
        },
      });

      if (metadreamProduct) {
        result.metadream = {
          productId: metadreamProduct.id,
          name: metadreamProduct.name,
          description: CONDITIONAL_PRODUCTS.metadream.description,
          thumbnail: metadreamProduct.images?.[0]?.imageUrl || undefined,
        };
      }
    }

    // 리셋데이
    if (CONDITIONAL_PRODUCTS.resetDay.productId) {
      const resetDayProduct = await this.prisma.product.findUnique({
        where: { id: CONDITIONAL_PRODUCTS.resetDay.productId },
        include: {
          images: {
            where: { imageType: 'MAIN' },
            take: 1,
          },
        },
      });

      if (resetDayProduct) {
        result.resetDay = {
          productId: resetDayProduct.id,
          name: resetDayProduct.name,
          description: CONDITIONAL_PRODUCTS.resetDay.description,
          thumbnail: resetDayProduct.images?.[0]?.imageUrl || undefined,
        };
      }
    }

    return Object.keys(result).length > 0 ? result : undefined;
  }
}
