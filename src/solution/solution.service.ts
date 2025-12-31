import { Injectable } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';

@Injectable()
export class SolutionService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 건강유형 동물 목록 조회
   */
  async getHealthTypeAnimals(params: { page: number; limit: number }) {
    const { page, limit } = params;

    const [items, total] = await Promise.all([
      this.prisma.healthTypeAnimal.findMany({
        orderBy: { id: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.healthTypeAnimal.count(),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 건강유형 추천상품 목록 조회
   */
  async getHealthTypeAnimalProducts(params: { page: number; limit: number; healthTypeAnimalId?: number }) {
    const { page, limit, healthTypeAnimalId } = params;

    const where: any = {};
    if (healthTypeAnimalId) {
      where.healthTypeAnimalId = healthTypeAnimalId;
    }

    const [items, total] = await Promise.all([
      this.prisma.healthTypeAnimalProduct.findMany({
        where,
        include: {
          healthTypeAnimal: {
            select: { id: true, typeName: true, animalName: true },
          },
          product: {
            select: { id: true, name: true, sku: true },
          },
        },
        orderBy: [{ healthTypeAnimalId: 'asc' }, { displayOrder: 'asc' }],
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.healthTypeAnimalProduct.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 라인업 목록 조회
   */
  async getProductLineups(params: { page: number; limit: number }) {
    const { page, limit } = params;

    const [items, total] = await Promise.all([
      this.prisma.productLineup.findMany({
        orderBy: { sortOrder: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.productLineup.count(),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 솔루션 관련 상품 목록 조회 (식단/영양제)
   */
  async getSolutionProducts(params: { page: number; limit: number; categoryCode?: string }) {
    const { page, limit, categoryCode } = params;

    const where: any = {
      categoryCode: { in: ['DIET', 'SUPPLEMENT'] },
    };
    if (categoryCode) {
      where.categoryCode = categoryCode;
    }

    const [items, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        select: {
          id: true,
          sku: true,
          name: true,
          categoryCode: true,
          categoryName: true,
          productType: true,
          status: true,
          price: true,
          originalPrice: true,
          lineupId: true,
          metadata: true,
          createdAt: true,
          lineup: {
            select: { id: true, key: true, name: true },
          },
        },
        orderBy: { id: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      this.prisma.product.count({ where }),
    ]);

    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }
}
