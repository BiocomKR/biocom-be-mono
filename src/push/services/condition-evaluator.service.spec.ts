import { Test, TestingModule } from '@nestjs/testing';
import { ConditionEvaluatorService } from './condition-evaluator.service';
import { PrismaService } from '../../common/services/prisma.service';

describe('ConditionEvaluatorService', () => {
  let service: ConditionEvaluatorService;
  let prisma: PrismaService;

  const mockPrismaService = {
    user: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    userChallenge: {
      findMany: jest.fn(),
    },
    dailyProgress: {
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    userCoupon: {
      findMany: jest.fn(),
    },
    cart: {
      findMany: jest.fn(),
    },
    userDeepReport: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConditionEvaluatorService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ConditionEvaluatorService>(ConditionEvaluatorService);
    prisma = module.get<PrismaService>(PrismaService);

    // Reset all mocks
    jest.clearAllMocks();
  });

  describe('evaluateConditions (AND 조합)', () => {
    it('2개 조건의 AND 조합을 평가해야 함', async () => {
      // CHALLENGE_STATUS=ACTIVE: [1, 2, 3, 5]
      // POINTS>=100: [2, 3, 4, 5]
      // 교집합: [2, 3, 5]

      mockPrismaService.userChallenge.findMany.mockResolvedValue([
        { userId: 1 },
        { userId: 2 },
        { userId: 3 },
        { userId: 5 },
      ]);

      mockPrismaService.user.findMany.mockImplementation((args: any) => {
        if (args?.where?.points) {
          // POINTS 조건 - 푸시 토큰 필터링 후
          return Promise.resolve([
            { id: 2 },
            { id: 3 },
            { id: 4 },
            { id: 5 },
          ]);
        }
        if (args?.where?.id?.in && args?.where?.pushTokens) {
          // 푸시 토큰 필터링
          const ids = args.where.id.in as number[];
          // CHALLENGE_STATUS 결과 [1,2,3,5] 중 토큰 있는 유저: [1,2,3,5]
          // POINTS 결과 [2,3,4,5] 중 토큰 있는 유저: [2,3,4,5]
          const hasToken = [1, 2, 3, 4, 5];
          return Promise.resolve(
            ids.filter((id) => hasToken.includes(id)).map((id) => ({ id })),
          );
        }
        return Promise.resolve([]);
      });

      const result = await service.evaluateConditions({
        id: 1,
        conditions: [
          { type: 'CHALLENGE_STATUS', params: { status: 'ACTIVE' } },
          { type: 'POINTS', params: { min: 100 } },
        ],
      });

      // 교집합: [2, 3, 5]
      expect(result.sort()).toEqual([2, 3, 5]);
    });

    it('3개 조건의 AND 조합을 평가해야 함', async () => {
      // 조건1: [1, 2, 3, 4, 5]
      // 조건2: [2, 3, 4, 5, 6]
      // 조건3: [3, 4, 5, 6, 7]
      // 교집합: [3, 4, 5]

      let callCount = 0;
      mockPrismaService.userChallenge.findMany.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve([
            { userId: 1 },
            { userId: 2 },
            { userId: 3 },
            { userId: 4 },
            { userId: 5 },
          ]);
        }
        if (callCount === 2) {
          return Promise.resolve([
            { userId: 2 },
            { userId: 3 },
            { userId: 4 },
            { userId: 5 },
            { userId: 6 },
          ]);
        }
        return Promise.resolve([
          { userId: 3 },
          { userId: 4 },
          { userId: 5 },
          { userId: 6 },
          { userId: 7 },
        ]);
      });

      // 푸시 토큰 필터링 - 모든 유저가 토큰 있음
      mockPrismaService.user.findMany.mockImplementation((args: any) => {
        if (args?.where?.pushTokens) {
          const ids = args.where.id.in as number[];
          return Promise.resolve(ids.map((id) => ({ id })));
        }
        return Promise.resolve([]);
      });

      const result = await service.evaluateConditions({
        id: 1,
        conditions: [
          { type: 'CHALLENGE_STATUS', params: { status: 'ACTIVE' } },
          { type: 'CHALLENGE_STATUS', params: { status: 'PENDING' } },
          { type: 'CHALLENGE_STATUS', params: { status: 'COMPLETED' } },
        ],
      });

      expect(result.sort()).toEqual([3, 4, 5]);
    });

    it('교집합이 빈 경우 빈 배열을 반환해야 함', async () => {
      // 조건1: [1, 2]
      // 조건2: [3, 4]
      // 교집합: []

      let callCount = 0;
      mockPrismaService.userChallenge.findMany.mockImplementation(() => {
        callCount++;
        if (callCount === 1) {
          return Promise.resolve([{ userId: 1 }, { userId: 2 }]);
        }
        return Promise.resolve([{ userId: 3 }, { userId: 4 }]);
      });

      mockPrismaService.user.findMany.mockImplementation((args: any) => {
        if (args?.where?.pushTokens) {
          const ids = args.where.id.in as number[];
          return Promise.resolve(ids.map((id) => ({ id })));
        }
        return Promise.resolve([]);
      });

      const result = await service.evaluateConditions({
        id: 1,
        conditions: [
          { type: 'CHALLENGE_STATUS', params: { status: 'ACTIVE' } },
          { type: 'CHALLENGE_STATUS', params: { status: 'COMPLETED' } },
        ],
      });

      expect(result).toEqual([]);
    });

    it('conditions가 null이면 빈 배열을 반환해야 함', async () => {
      const result = await service.evaluateConditions({
        id: 1,
        conditions: null,
      });

      expect(result).toEqual([]);
    });

    it('conditions가 빈 배열이면 빈 배열을 반환해야 함', async () => {
      const result = await service.evaluateConditions({
        id: 1,
        conditions: [],
      });

      expect(result).toEqual([]);
    });

    it('대량 유저에서도 교집합이 정상 동작해야 함', async () => {
      // 1000명 유저 테스트
      const users1 = Array.from({ length: 1000 }, (_, i) => ({ userId: i + 1 }));
      const users2 = Array.from({ length: 1000 }, (_, i) => ({ userId: i + 501 })); // 501~1500

      let callCount = 0;
      mockPrismaService.userChallenge.findMany.mockImplementation(() => {
        callCount++;
        if (callCount === 1) return Promise.resolve(users1);
        return Promise.resolve(users2);
      });

      mockPrismaService.user.findMany.mockImplementation((args: any) => {
        if (args?.where?.pushTokens) {
          const ids = args.where.id.in as number[];
          return Promise.resolve(ids.map((id) => ({ id })));
        }
        return Promise.resolve([]);
      });

      const result = await service.evaluateConditions({
        id: 1,
        conditions: [
          { type: 'CHALLENGE_STATUS', params: { status: 'ACTIVE' } },
          { type: 'CHALLENGE_STATUS', params: { status: 'PENDING' } },
        ],
      });

      // 교집합: 501~1000 (500명)
      expect(result.length).toBe(500);
      expect(result.every((id) => id >= 501 && id <= 1000)).toBe(true);
    });
  });
});
