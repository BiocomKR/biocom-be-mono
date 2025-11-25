import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { ProductQueryDto, ProductSort, ProductStatus } from '../dto/products/product-query.dto';
import {
  ProductResponseDto,
  ProductPaginatedResponseDto,
  CheckStockRequestDto,
  CheckStockResponseDto,
  SimpleProductDto,
  GroupedProductResponseDto,
  CategoryProductGroupDto
} from '../dto/products/product-response.dto';
import { ProductDetailDto, ReviewSummaryDto, QnaSummaryDto } from '../dto/products/product-detail.dto';
import { Prisma } from '@prisma/client';
import { ProductCategory, CategoryNameMap, CategorySortOrder } from '../enums/product-category.enum';
import { getNowKST } from '../../common/utils/kst-date.util';
import { convertDecimalToNumber } from '../../common/utils/decimal.util';


@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);
  constructor(private readonly prisma: PrismaService) {}

  /**
   * 상품 상세 조회
   */
  async findOne(id: number): Promise<ProductResponseDto> {
    const product = await this.prisma.product.findFirst({
      where: {
        id,
        status: ProductStatus.ACTIVE,
      },
      include: {
        images: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('상품을 찾을 수 없습니다');
    }

    return {
      ...product,
      price: product.price ? Number(product.price.toString()) : null,
      originalPrice: product.originalPrice ? Number(product.originalPrice.toString()) : null,
      minPrice: product.price ? Number(product.price.toString()) : 0,
      maxPrice: product.price ? Number(product.price.toString()) : 0,
    };
  }

  /**
   * 상품 상세 조회 (간소화 버전: 기본정보 + 리뷰요약 + Q&A요약)
   */
  async findProductDetail(id: number): Promise<ProductDetailDto> {
    this.logger.log(`상품 상세 조회 시작: ${id}`);

    // 상품 기본 정보 조회
    const product = await this.prisma.product.findFirst({
      where: {
        id,
        status: ProductStatus.ACTIVE,
      },
      include: {
        images: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('상품을 찾을 수 없습니다');
    }

    // 리뷰 통계 조회
    const reviewStats = await this.getReviewSummary(id);

    // Q&A 통계 조회
    const qnaStats = await this.getQnaSummary(id);

    // 이미지 URL 배열 생성
    const imageUrls = product.images.map(img => img.imageUrl);

    return {
      id: product.id,
      categoryCode: product.categoryCode,
      categoryName: product.categoryName,
      name: product.name,
      description: product.description,
      productType: product.productType,
      setItems: product.setItems,
      status: product.status,
      viewCount: product.viewCount,
      imageUrl: imageUrls,
      originalPrice: convertDecimalToNumber(product.originalPrice),
      price: convertDecimalToNumber(product.price),
      reviewSummary: reviewStats,
      qnaSummary: qnaStats,
    };
  }

  /**
   * 리뷰 요약 정보 조회
   */
  private async getReviewSummary(productId: number): Promise<ReviewSummaryDto> {
    // 별점별 통계 조회
    const stats = await this.prisma.productFeedback.groupBy({
      by: ['rating'],
      where: {
        productId,
        feedbackType: 'REVIEW',
        status: 'ACTIVE',
        rating: { not: null },
      },
      _count: {
        rating: true,
      },
    });

    let totalCount = 0;
    let totalRating = 0;
    const ratingCounts = {
      rating1Count: 0,
      rating2Count: 0,
      rating3Count: 0,
      rating4Count: 0,
      rating5Count: 0,
    };

    stats.forEach(stat => {
      const rating = stat.rating!;
      const count = stat._count.rating;
      totalCount += count;
      totalRating += rating * count;

      switch (rating) {
        case 1: ratingCounts.rating1Count = count; break;
        case 2: ratingCounts.rating2Count = count; break;
        case 3: ratingCounts.rating3Count = count; break;
        case 4: ratingCounts.rating4Count = count; break;
        case 5: ratingCounts.rating5Count = count; break;
      }
    });

    // 포토 리뷰 수 조회
    const photoReviewCount = await this.prisma.productFeedback.count({
      where: {
        productId,
        feedbackType: 'REVIEW',
        status: 'ACTIVE',
        reviewType: 'PHOTO',
      },
    });

    return {
      totalCount,
      averageRating: totalCount > 0 ? Number((totalRating / totalCount).toFixed(1)) : 0,
      ...ratingCounts,
      photoReviewCount,
    };
  }

  /**
   * Q&A 요약 정보 조회
   */
  private async getQnaSummary(productId: number): Promise<QnaSummaryDto> {
    const [totalCount, answeredCount] = await Promise.all([
      // 전체 Q&A 수
      this.prisma.productFeedback.count({
        where: {
          productId,
          feedbackType: 'QUESTION',
          status: 'ACTIVE',
          parentId: null, // 원글만 (답글 제외)
        },
      }),
      // 답변 완료 수
      this.prisma.productFeedback.count({
        where: {
          productId,
          feedbackType: 'QUESTION',
          status: 'ACTIVE',
          parentId: null,
          hasAnswer: true,
        },
      }),
    ]);

    return {
      totalCount,
      answeredCount,
      unansweredCount: totalCount - answeredCount,
    };
  }

  /**
   * 상품 조회수 증가 (사용자별 중복 제외)
   */
  async increaseViewCount(id: number, userId: number): Promise<{ viewCount: number; isNewView: boolean }> {
    // 상품 존재 확인
    const product = await this.prisma.product.findFirst({
      where: { id, status: ProductStatus.ACTIVE },
      select: { id: true, viewCount: true },
    });

    if (!product) {
      throw new NotFoundException('상품을 찾을 수 없습니다');
    }

    // 사용자의 기존 조회 기록 확인
    const existingView = await this.prisma.recentlyViewed.findUnique({
      where: {
        userId_productId: {
          userId,
          productId: id,
        },
      },
    });

    if (existingView) {
      // 이미 조회한 적이 있는 경우 - 조회 시간만 업데이트
      await this.prisma.recentlyViewed.update({
        where: {
          userId_productId: {
            userId,
            productId: id,
          },
        },
        data: {
          viewedAt: getNowKST(),
        },
      });

      return {
        viewCount: product.viewCount,
        isNewView: false,
      };
    }

    // 새로운 조회인 경우 - 조회 기록 추가 및 조회수 증가
    const result = await this.prisma.$transaction(async (tx) => {
      // 조회 기록 추가
      await tx.recentlyViewed.create({
        data: {
          userId,
          productId: id,
        },
      });

      // 조회수 증가
      const updatedProduct = await tx.product.update({
        where: { id },
        data: {
          viewCount: { increment: 1 },
        },
        select: { viewCount: true },
      });

      return updatedProduct;
    });

    return {
      viewCount: result.viewCount,
      isNewView: true,
    };
  }

  /**
   * 간소화된 상품 목록 조회 (카테고리별 그룹핑)
   * 필터링된 상품을 카테고리별로 그룹핑하여 반환
   */
  async findAllGrouped(query?: ProductQueryDto): Promise<GroupedProductResponseDto> {
    this.logger.log('카테고리별 그룹핑된 상품 목록 조회 시작');

    // WHERE 조건 구성 (기존 필터 로직 사용)
    const where: Prisma.ProductWhereInput = {
      status: query?.status || ProductStatus.ACTIVE,
    };

    if (query?.categoryCode) {
      where.categoryCode = query.categoryCode;
    }

    if (query?.featured === 'true') {
      where.isFeatured = true;
    }

    if (query?.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
        { sku: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    // 정렬 조건 구성
    let orderBy: Prisma.ProductOrderByWithRelationInput = {};
    if (query?.sort) {
      switch (query.sort) {
        case ProductSort.NAME:
          orderBy = { name: 'asc' };
          break;
        case ProductSort.VIEW_COUNT:
          orderBy = { viewCount: 'desc' };
          break;
        case ProductSort.CREATED_AT:
        default:
          orderBy = { createdAt: 'desc' };
          break;
      }
    } else {
      orderBy = { createdAt: 'desc' };
    }

    // 필터링된 상품 조회 (select 없이 전체 조회)
    this.logger.log('상품 조회 시작...');
    const products = await this.prisma.product.findMany({
      where,
      orderBy,
    });

    this.logger.log(`조회된 상품 수: ${products.length}`);

    // 상품 ID 리스트로 이미지 조회
    const productIds = products.map(p => p.id);
    const images = await this.prisma.productImage.findMany({
      where: {
        productId: { in: productIds },
        imageType: 'MAIN',
      },
      orderBy: { sortOrder: 'asc' },
    });

    // 상품 ID별 이미지 맵 생성
    const imageMap = new Map<number, string>();
    images.forEach(img => {
      if (!imageMap.has(img.productId)) {
        imageMap.set(img.productId, img.imageUrl);
      }
    });

    // 간소화된 상품 DTO로 변환
    const simpleProducts: SimpleProductDto[] = products.map((product: any) => ({
      id: product.id,
      name: product.name,
      description: product.description,
      productType: product.productType,
      setItems: product.setItems,
      status: product.status,
      viewCount: product.viewCount,
      categoryCode: product.categoryCode,
      categoryName: product.categoryName,
      imageUrl: imageMap.get(product.id) || null,
      originalPrice: convertDecimalToNumber(product.originalPrice),
      price: convertDecimalToNumber(product.price),
    }));

    // 카테고리별로 그룹핑
    const categoryGroups = new Map<string, CategoryProductGroupDto>();

    for (const product of simpleProducts) {
      if (!categoryGroups.has(product.categoryCode)) {
        categoryGroups.set(product.categoryCode, {
          categoryCode: product.categoryCode,
          categoryName: product.categoryName,
          productCount: 0,
          products: [],
        });
      }

      const group = categoryGroups.get(product.categoryCode)!;
      group.products.push(product);
      group.productCount++;
    }

    // CategorySortOrder에 따라 정렬
    const sortedCategories: CategoryProductGroupDto[] = [];

    // 정의된 순서대로 카테고리 추가
    for (const categoryCode of CategorySortOrder) {
      if (categoryGroups.has(categoryCode)) {
        sortedCategories.push(categoryGroups.get(categoryCode)!);
      }
    }

    // CategorySortOrder에 없는 카테고리도 추가 (혹시 새로운 카테고리가 DB에 있을 경우)
    for (const [categoryCode, group] of categoryGroups.entries()) {
      if (!CategorySortOrder.includes(categoryCode as ProductCategory)) {
        sortedCategories.push(group);
      }
    }

    this.logger.log(`카테고리별 그룹핑 완료: ${sortedCategories.length}개 카테고리, 총 ${simpleProducts.length}개 상품`);

    return {
      totalCount: simpleProducts.length,
      categoryCount: sortedCategories.length,
      categories: sortedCategories,
    };
  }

  /**
   * 재고 확인 (외부 API 연동)
   * 현재는 모의 구현, 추후 실제 재고 API 연동
   */
  async checkStock(dto: CheckStockRequestDto): Promise<CheckStockResponseDto> {
    this.logger.log(`재고 확인 요청: ${JSON.stringify(dto.items)}`);

    // TODO: 실제 재고 API 호출
    // 현재는 모의 응답
    const results = await Promise.all(
      dto.items.map(async (item) => {
        // 재고 캐시 확인
        const cache = await this.prisma.inventoryCache.findUnique({
          where: { sku: item.sku },
        });

        if (cache) {
          // 캐시가 10분 이내면 사용
          const cacheAge = Date.now() - cache.lastUpdated.getTime();
          if (cacheAge < 10 * 60 * 1000) {
            return {
              sku: item.sku,
              available: cache.availableQty >= item.quantity,
              stock: cache.availableQty,
            };
          }
        }

        // 외부 API 호출 (모의)
        const mockStock = Math.floor(Math.random() * 100);
        
        // 캐시 업데이트
        await this.prisma.inventoryCache.upsert({
          where: { sku: item.sku },
          update: {
            availableQty: mockStock,
            lastUpdated: getNowKST(),
          },
          create: {
            sku: item.sku,
            availableQty: mockStock,
            lastUpdated: getNowKST(),
          },
        });

        // API 로그 기록
        await this.prisma.inventoryApiLog.create({
          data: {
            apiMethod: 'GET_STOCK',
            sku: item.sku,
            requestData: { quantity: item.quantity },
            responseData: { stock: mockStock },
            responseStatus: 200,
            createdAt: getNowKST(),
          },
        });

        return {
          sku: item.sku,
          available: mockStock >= item.quantity,
          stock: mockStock,
        };
      })
    );

    return { items: results };
  }

}