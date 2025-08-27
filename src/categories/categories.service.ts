import { Injectable, NotFoundException } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { CategoryResponseDto, CategoryWithCountDto } from './dto/category-response.dto';

@Injectable()
export class CategoriesService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 카테고리 목록 조회
   * 계층 구조로 카테고리를 반환
   */
  async findAll(parentId?: number): Promise<CategoryResponseDto[]> {
    const categories = await this.prisma.category.findMany({
      where: {
        parentId: parentId ?? null,
        isActive: true,
      },
      orderBy: [
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
      include: {
        children: {
          where: { isActive: true },
          orderBy: [
            { sortOrder: 'asc' },
            { name: 'asc' },
          ],
        },
      },
    });

    return categories;
  }

  /**
   * 카테고리 상세 조회
   * 하위 카테고리와 함께 반환
   */
  async findOne(id: number): Promise<CategoryResponseDto> {
    const category = await this.prisma.category.findFirst({
      where: {
        id,
        isActive: true,
      },
      include: {
        children: {
          where: { isActive: true },
          orderBy: [
            { sortOrder: 'asc' },
            { name: 'asc' },
          ],
        },
      },
    });

    if (!category) {
      throw new NotFoundException('카테고리를 찾을 수 없습니다');
    }

    return category;
  }

  /**
   * 카테고리별 상품 수 조회
   * 각 카테고리의 상품 수를 포함하여 반환
   */
  async findAllWithProductCount(): Promise<CategoryWithCountDto[]> {
    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [
        { depth: 'asc' },
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
      include: {
        _count: {
          select: { products: true },
        },
      },
    });

    return categories.map(category => ({
      ...category,
      productCount: category._count.products,
    }));
  }

  /**
   * 카테고리 트리 구조 생성
   * 전체 카테고리를 계층 구조로 변환
   */
  async getCategoryTree(): Promise<CategoryResponseDto[]> {
    const categories = await this.prisma.category.findMany({
      where: { isActive: true },
      orderBy: [
        { depth: 'asc' },
        { sortOrder: 'asc' },
        { name: 'asc' },
      ],
    });

    // 카테고리를 계층 구조로 변환
    const categoryMap = new Map<number, CategoryResponseDto>();
    const rootCategories: CategoryResponseDto[] = [];

    // 먼저 모든 카테고리를 맵에 저장
    categories.forEach(category => {
      categoryMap.set(category.id, {
        ...category,
        children: [],
      });
    });

    // 부모-자식 관계 설정
    categories.forEach(category => {
      const categoryDto = categoryMap.get(category.id)!;
      
      if (category.parentId === null) {
        rootCategories.push(categoryDto);
      } else {
        const parent = categoryMap.get(category.parentId);
        if (parent) {
          if (!parent.children) {
            parent.children = [];
          }
          parent.children.push(categoryDto);
        }
      }
    });

    return rootCategories;
  }

  /**
   * 카테고리 경로 조회
   * Breadcrumb용 카테고리 경로 반환
   */
  async getCategoryPath(id: number): Promise<CategoryResponseDto[]> {
    const category = await this.findOne(id);
    
    if (!category.path) {
      return [category];
    }

    // path가 "/1/3/5/" 형식이라고 가정
    const pathIds = category.path
      .split('/')
      .filter(id => id !== '')
      .map(id => parseInt(id));

    const pathCategories = await this.prisma.category.findMany({
      where: {
        id: { in: pathIds },
        isActive: true,
      },
      orderBy: {
        depth: 'asc',
      },
    });

    return [...pathCategories, category];
  }
}
