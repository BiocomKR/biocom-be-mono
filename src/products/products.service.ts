import { Injectable, NotFoundException, Logger } from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import { ProductQueryDto, ProductSort, ProductStatus } from './dto/product-query.dto';
import { 
  ProductResponseDto, 
  ProductPaginatedResponseDto,
  CheckStockRequestDto,
  CheckStockResponseDto 
} from './dto/product-response.dto';
import { Prisma } from '@prisma/client';

@Injectable()
export class ProductsService {
  private readonly logger = new Logger(ProductsService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 상품 목록 조회 (페이지네이션)
   */
  async findAll(query: ProductQueryDto): Promise<ProductPaginatedResponseDto> {
    const page = parseInt(query.page || '1');
    const limit = parseInt(query.limit || '20');
    const skip = (page - 1) * limit;

    // WHERE 조건 구성
    const where: Prisma.ProductWhereInput = {
      status: query.status || ProductStatus.ACTIVE,
    };

    if (query.category_id) {
      where.categoryId = parseInt(query.category_id);
    }

    if (query.featured === 'true') {
      where.isFeatured = true;
    }

    if (query.q) {
      where.OR = [
        { name: { contains: query.q, mode: 'insensitive' } },
        { description: { contains: query.q, mode: 'insensitive' } },
        { sku: { contains: query.q, mode: 'insensitive' } },
      ];
    }

    // 정렬 조건 구성
    let orderBy: Prisma.ProductOrderByWithRelationInput = {};
    switch (query.sort) {
      case ProductSort.PRICE_ASC:
        // 최저가 기준 정렬을 위해서는 옵션 조인이 필요
        orderBy = { createdAt: 'desc' }; // 일단 기본값 사용
        break;
      case ProductSort.PRICE_DESC:
        orderBy = { createdAt: 'desc' }; // 일단 기본값 사용
        break;
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

    // 데이터 조회
    const [products, total] = await Promise.all([
      this.prisma.product.findMany({
        where,
        skip,
        take: limit,
        orderBy,
        include: {
          category: true,
          options: {
            where: { isActive: true },
            orderBy: { sortOrder: 'asc' },
          },
          images: {
            orderBy: { sortOrder: 'asc' },
          },
        },
      }),
      this.prisma.product.count({ where }),
    ]);

    // 가격 범위 계산
    const productsWithPrice = products.map(product => {
      const prices = product.options.map(opt => Number(opt.price));
      return {
        ...product,
        minPrice: prices.length > 0 ? Math.min(...prices) : 0,
        maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
        options: product.options.map(opt => ({
          ...opt,
          price: Number(opt.price)
        }))
      };
    });

    return {
      items: productsWithPrice,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 상품 검색
   */
  async search(keyword: string, page = 1, limit = 20): Promise<ProductPaginatedResponseDto> {
    return this.findAll({
      q: keyword,
      page: page.toString(),
      limit: limit.toString(),
    });
  }

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
        category: true,
        options: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
        images: {
          orderBy: { sortOrder: 'asc' },
        },
      },
    });

    if (!product) {
      throw new NotFoundException('상품을 찾을 수 없습니다');
    }

    // 가격 범위 계산
    const prices = product.options.map(opt => Number(opt.price));
    
    return {
      ...product,
      minPrice: prices.length > 0 ? Math.min(...prices) : 0,
      maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
      options: product.options.map(opt => ({
        ...opt,
        price: Number(opt.price)
      }))
    };
  }

  /**
   * 상품 조회수 증가
   */
  async increaseViewCount(id: number): Promise<{ viewCount: number }> {
    const product = await this.prisma.product.update({
      where: { id },
      data: {
        viewCount: { increment: 1 },
      },
      select: { viewCount: true },
    });

    return product;
  }

  /**
   * 카테고리별 상품 조회
   */
  async findByCategory(
    categoryId: number, 
    page = 1, 
    limit = 20
  ): Promise<ProductPaginatedResponseDto> {
    return this.findAll({
      category_id: categoryId.toString(),
      page: page.toString(),
      limit: limit.toString(),
    });
  }

  /**
   * 추천 상품 조회
   */
  async findFeatured(limit = 10): Promise<ProductResponseDto[]> {
    const products = await this.prisma.product.findMany({
      where: {
        isFeatured: true,
        status: ProductStatus.ACTIVE,
      },
      take: limit,
      orderBy: { createdAt: 'desc' },
      include: {
        category: true,
        options: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
        images: {
          where: { imageType: 'MAIN' },
          orderBy: { sortOrder: 'asc' },
          take: 1,
        },
      },
    });

    return products.map(product => {
      const prices = product.options.map(opt => Number(opt.price));
      return {
        ...product,
        minPrice: prices.length > 0 ? Math.min(...prices) : 0,
        maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
        options: product.options.map(opt => ({
          ...opt,
          price: Number(opt.price)
        }))
      };
    });
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
            lastUpdated: new Date(),
          },
          create: {
            sku: item.sku,
            availableQty: mockStock,
            lastUpdated: new Date(),
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
            createdAt: new Date(),
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

  /**
   * 인기 상품 조회
   * 주문 수 기준으로 정렬
   */
  async findPopular(limit = 10): Promise<ProductResponseDto[]> {
    // 최근 30일간 주문이 많은 상품 조회
    const thirtyDaysAgo = new Date();
    thirtyDaysAgo.setDate(thirtyDaysAgo.getDate() - 30);

    const popularProducts = await this.prisma.orderItem.groupBy({
      by: ['productId'],
      _sum: {
        quantity: true,
      },
      where: {
        createdAt: {
          gte: thirtyDaysAgo,
        },
        order: {
          status: {
            notIn: ['CANCELLED', 'PENDING_PAYMENT'],
          },
        },
      },
      orderBy: {
        _sum: {
          quantity: 'desc',
        },
      },
      take: limit,
    });

    const productIds = popularProducts.map(item => item.productId);
    
    const products = await this.prisma.product.findMany({
      where: {
        id: { in: productIds },
        status: ProductStatus.ACTIVE,
      },
      include: {
        category: true,
        options: {
          where: { isActive: true },
          orderBy: { sortOrder: 'asc' },
        },
        images: {
          where: { imageType: 'MAIN' },
          orderBy: { sortOrder: 'asc' },
          take: 1,
        },
      },
    });

    // 정렬 순서 유지
    const sortedProducts = productIds.map(id => 
      products.find(p => p.id === id)
    ).filter(Boolean);

    return sortedProducts.map(product => {
      const prices = product!.options.map(opt => Number(opt.price));
      return {
        ...product!,
        minPrice: prices.length > 0 ? Math.min(...prices) : 0,
        maxPrice: prices.length > 0 ? Math.max(...prices) : 0,
        options: product!.options.map(opt => ({
          ...opt,
          price: Number(opt.price)
        }))
      };
    });
  }
}