import { PaginationHelper } from './pagination.util';

describe('PaginationHelper', () => {
  describe('getPaginationParams', () => {
    it('page와 limit을 skip/take로 변환해야 한다', () => {
      const result = PaginationHelper.getPaginationParams({ page: 2, limit: 10 });

      expect(result.skip).toBe(10);
      expect(result.take).toBe(10);
      expect(result.page).toBe(2);
      expect(result.limit).toBe(10);
    });

    it('첫 페이지는 skip이 0이어야 한다', () => {
      const result = PaginationHelper.getPaginationParams({ page: 1, limit: 20 });

      expect(result.skip).toBe(0);
      expect(result.take).toBe(20);
    });

    it('기본값으로 page=1, limit=20을 사용해야 한다', () => {
      const result = PaginationHelper.getPaginationParams({});

      expect(result.page).toBe(1);
      expect(result.limit).toBe(20);
      expect(result.skip).toBe(0);
      expect(result.take).toBe(20);
    });

    it('page만 지정하면 limit은 기본값 20이어야 한다', () => {
      const result = PaginationHelper.getPaginationParams({ page: 3 });

      expect(result.skip).toBe(40); // (3-1) * 20
      expect(result.take).toBe(20);
    });

    it('limit만 지정하면 page는 기본값 1이어야 한다', () => {
      const result = PaginationHelper.getPaginationParams({ limit: 50 });

      expect(result.skip).toBe(0);
      expect(result.take).toBe(50);
    });
  });

  describe('getSortOptions', () => {
    it('sortBy와 sortOrder를 orderBy 객체로 변환해야 한다', () => {
      const result = PaginationHelper.getSortOptions({
        sortBy: 'name',
        sortOrder: 'asc',
      });

      expect(result).toEqual({ name: 'asc' });
    });

    it('기본값으로 createdAt desc를 사용해야 한다', () => {
      const result = PaginationHelper.getSortOptions({});

      expect(result).toEqual({ createdAt: 'desc' });
    });

    it('sortBy만 지정하면 sortOrder는 desc이어야 한다', () => {
      const result = PaginationHelper.getSortOptions({ sortBy: 'updatedAt' });

      expect(result).toEqual({ updatedAt: 'desc' });
    });

    it('기본 sortBy를 변경할 수 있어야 한다', () => {
      const result = PaginationHelper.getSortOptions({}, 'id');

      expect(result).toEqual({ id: 'desc' });
    });
  });

  describe('createPaginatedResult', () => {
    it('페이징 결과 객체를 생성해야 한다', () => {
      const items = [{ id: 1 }, { id: 2 }];
      const result = PaginationHelper.createPaginatedResult(items, 100, 1, 10);

      expect(result.items).toEqual(items);
      expect(result.total).toBe(100);
      expect(result.page).toBe(1);
      expect(result.limit).toBe(10);
      expect(result.totalPages).toBe(10);
    });

    it('totalPages를 올림으로 계산해야 한다', () => {
      const result = PaginationHelper.createPaginatedResult([], 25, 1, 10);

      expect(result.totalPages).toBe(3); // ceil(25/10) = 3
    });

    it('total이 0이면 totalPages도 0이어야 한다', () => {
      const result = PaginationHelper.createPaginatedResult([], 0, 1, 10);

      expect(result.totalPages).toBe(0);
    });

    it('total이 limit보다 작으면 totalPages는 1이어야 한다', () => {
      const result = PaginationHelper.createPaginatedResult([{ id: 1 }], 5, 1, 10);

      expect(result.totalPages).toBe(1);
    });
  });

  describe('createDateFilter', () => {
    it('startDate만 있으면 gte 조건을 생성해야 한다', () => {
      const result = PaginationHelper.createDateFilter('createdAt', {
        startDate: '2025-01-01',
      });

      expect(result).toEqual({
        createdAt: {
          gte: new Date('2025-01-01'),
        },
      });
    });

    it('endDate만 있으면 lte 조건을 생성해야 한다', () => {
      const result = PaginationHelper.createDateFilter('createdAt', {
        endDate: '2025-12-31',
      });

      expect(result).toEqual({
        createdAt: {
          lte: new Date('2025-12-31'),
        },
      });
    });

    it('startDate와 endDate 모두 있으면 gte/lte 조건을 생성해야 한다', () => {
      const result = PaginationHelper.createDateFilter('createdAt', {
        startDate: '2025-01-01',
        endDate: '2025-12-31',
      });

      expect(result).toEqual({
        createdAt: {
          gte: new Date('2025-01-01'),
          lte: new Date('2025-12-31'),
        },
      });
    });

    it('날짜가 없으면 undefined를 반환해야 한다', () => {
      const result = PaginationHelper.createDateFilter('createdAt', {});

      expect(result).toBeUndefined();
    });
  });

  describe('createSearchCondition', () => {
    it('검색어로 OR 조건을 생성해야 한다', () => {
      const result = PaginationHelper.createSearchCondition('test', ['name', 'email']);

      expect(result).toEqual({
        OR: [
          { name: { contains: 'test', mode: 'insensitive' } },
          { email: { contains: 'test', mode: 'insensitive' } },
        ],
      });
    });

    it('검색어가 없으면 undefined를 반환해야 한다', () => {
      const result = PaginationHelper.createSearchCondition(undefined, ['name']);

      expect(result).toBeUndefined();
    });

    it('빈 문자열도 undefined를 반환해야 한다', () => {
      const result = PaginationHelper.createSearchCondition('', ['name']);

      expect(result).toBeUndefined();
    });

    it('여러 필드에 대해 OR 조건을 생성해야 한다', () => {
      const result = PaginationHelper.createSearchCondition('keyword', [
        'name',
        'description',
        'code',
      ]);

      expect(result?.OR).toHaveLength(3);
    });
  });

  describe('buildWhereClause', () => {
    it('null/undefined 값을 제외해야 한다', () => {
      const result = PaginationHelper.buildWhereClause({
        name: 'test',
        email: null,
        age: undefined,
        isActive: true,
      });

      expect(result).toEqual({
        name: 'test',
        isActive: true,
      });
    });

    it('falsy 값 중 유효한 값은 포함해야 한다', () => {
      const result = PaginationHelper.buildWhereClause({
        count: 0,
        isActive: false,
        name: '',
      });

      expect(result).toEqual({
        count: 0,
        isActive: false,
        name: '',
      });
    });

    it('빈 객체를 입력하면 빈 객체를 반환해야 한다', () => {
      const result = PaginationHelper.buildWhereClause({});

      expect(result).toEqual({});
    });

    it('모든 값이 null/undefined면 빈 객체를 반환해야 한다', () => {
      const result = PaginationHelper.buildWhereClause({
        a: null,
        b: undefined,
      });

      expect(result).toEqual({});
    });
  });
});
