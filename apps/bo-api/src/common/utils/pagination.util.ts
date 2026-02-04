import { Prisma } from '@prisma/client';

/**
 * 페이징 요청 파라미터 인터페이스
 */
export interface PaginationParams {
  page?: number;
  limit?: number;
}

/**
 * 페이징 결과 인터페이스
 */
export interface PaginatedResult<T> {
  items: T[];
  total: number;
  page: number;
  limit: number;
  totalPages: number;
}

/**
 * 정렬 옵션 인터페이스
 */
export interface SortOptions {
  sortBy?: string;
  sortOrder?: 'asc' | 'desc';
}

/**
 * 페이징 헬퍼 클래스
 * Prisma와 함께 사용하기 위한 페이징 유틸리티
 */
export class PaginationHelper {
  /**
   * 페이징 파라미터를 Prisma skip/take로 변환
   */
  static getPaginationParams(params: PaginationParams) {
    const page = params.page || 1;
    const limit = params.limit || 20;
    const skip = (page - 1) * limit;

    return { skip, take: limit, page, limit };
  }

  /**
   * 정렬 옵션을 Prisma orderBy로 변환
   */
  static getSortOptions(sort: SortOptions, defaultSortBy: string = 'createdAt') {
    const sortBy = sort.sortBy || defaultSortBy;
    const sortOrder = sort.sortOrder || 'desc';

    return { [sortBy]: sortOrder };
  }

  /**
   * 페이징 결과 생성
   */
  static createPaginatedResult<T>(
    items: T[],
    total: number,
    page: number,
    limit: number
  ): PaginatedResult<T> {
    return {
      items,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * Prisma 페이징 쿼리 실행 헬퍼
   * 
   * @example
   * const result = await PaginationHelper.paginate(
   *   prisma.user,
   *   { page: 1, limit: 10 },
   *   { where: { isActive: true } },
   *   { sortBy: 'name', sortOrder: 'asc' }
   * );
   */
  static async paginate<T>(
    model: any,
    paginationParams: PaginationParams,
    queryOptions: any = {},
    sortOptions?: SortOptions
  ): Promise<PaginatedResult<T>> {
    const { skip, take, page, limit } = this.getPaginationParams(paginationParams);
    
    // 정렬 옵션 설정
    if (sortOptions) {
      queryOptions.orderBy = this.getSortOptions(sortOptions);
    }

    // 전체 개수와 페이징된 데이터를 병렬로 조회
    // count 쿼리에 where 조건만 전달
    const countOptions = queryOptions.where ? { where: queryOptions.where } : {};
    
    const [total, items] = await Promise.all([
      model.count(countOptions),
      model.findMany({
        ...queryOptions,
        skip,
        take,
      }),
    ]);

    return this.createPaginatedResult(items, total, page, limit);
  }

  /**
   * 날짜 필터 조건 생성 헬퍼
   * 
   * @example
   * const dateFilter = PaginationHelper.createDateFilter(
   *   'startDate',
   *   { startDate: '2024-01-01', endDate: '2024-12-31' }
   * );
   */
  static createDateFilter(
    field: string,
    filters: { startDate?: string; endDate?: string }
  ) {
    const conditions: any = {};
    
    if (filters.startDate) {
      conditions.gte = new Date(filters.startDate);
    }
    
    if (filters.endDate) {
      conditions.lte = new Date(filters.endDate);
    }
    
    return Object.keys(conditions).length > 0 ? { [field]: conditions } : undefined;
  }

  /**
   * 검색 조건 생성 헬퍼 (텍스트 필드용)
   * 
   * @example
   * const searchCondition = PaginationHelper.createSearchCondition(
   *   'test',
   *   ['name', 'description', 'code']
   * );
   */
  static createSearchCondition(search: string | undefined, fields: string[]) {
    if (!search) return undefined;

    return {
      OR: fields.map(field => ({
        [field]: { contains: search, mode: 'insensitive' as const }
      }))
    };
  }

  /**
   * WHERE 조건 빌더
   * null/undefined 값은 자동으로 제외
   */
  static buildWhereClause(conditions: Record<string, any>) {
    const where: Record<string, any> = {};

    for (const [key, value] of Object.entries(conditions)) {
      if (value !== undefined && value !== null) {
        where[key] = value;
      }
    }

    return where;
  }
}