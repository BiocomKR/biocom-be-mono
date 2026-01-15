import { Test, TestingModule } from '@nestjs/testing';
import { ConditionEvaluatorService } from './condition-evaluator.service';
import { PrismaService } from '../../common/services/prisma.service';
import { UserChallengeStatus } from '../../common/enums';

// Mock getNowKST and calculateChallengeDay
jest.mock('../../common/utils/kst-date.util', () => ({
  getNowKST: jest.fn(() => new Date('2026-01-14T10:00:00+09:00')),
  calculateChallengeDay: jest.fn((activatedAt: Date) => {
    const now = new Date('2026-01-14T10:00:00+09:00');
    const diff = now.getTime() - activatedAt.getTime();
    return Math.floor(diff / (1000 * 60 * 60 * 24)) + 1;
  }),
}));

describe('ConditionEvaluatorService', () => {
  let service: ConditionEvaluatorService;
  let prismaService: any;

  const mockPrismaService = {
    userChallenge: {
      findMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
      count: jest.fn(),
    },
    dailyProgress: {
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    userDeepReport: {
      findMany: jest.fn(),
    },
    userCoupon: {
      findMany: jest.fn(),
    },
    cart: {
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
    prismaService = module.get(PrismaService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('evaluateCondition - CHALLENGE_DAY', () => {
    it('N일차 유저를 올바르게 조회해야 함', async () => {
      // activatedAt이 7일 전인 유저 = 7일차
      const sevenDaysAgo = new Date('2026-01-08T10:00:00+09:00');

      mockPrismaService.userChallenge.findMany.mockResolvedValue([
        { userId: 1, activatedAt: sevenDaysAgo },
        { userId: 2, activatedAt: new Date('2026-01-14T10:00:00+09:00') }, // 1일차
        { userId: 3, activatedAt: sevenDaysAgo },
      ]);

      // 토큰 필터링
      mockPrismaService.user.findMany.mockResolvedValue([
        { id: 1 },
        { id: 3 },
      ]);

      const result = await service.evaluateCondition('CHALLENGE_DAY', { day: 7 });

      expect(mockPrismaService.userChallenge.findMany).toHaveBeenCalledWith({
        where: {
          status: UserChallengeStatus.ACTIVE,
          activatedAt: { not: null },
        },
        select: { userId: true, activatedAt: true },
      });
      expect(result).toEqual([1, 3]);
    });

    it('day 파라미터가 없으면 빈 배열 반환', async () => {
      const result = await service.evaluateCondition('CHALLENGE_DAY', {});
      expect(result).toEqual([]);
    });
  });

  describe('evaluateCondition - CHALLENGE_STATUS', () => {
    it('특정 상태의 유저를 조회해야 함', async () => {
      mockPrismaService.userChallenge.findMany.mockResolvedValue([
        { userId: 1 },
        { userId: 2 },
      ]);
      mockPrismaService.user.findMany.mockResolvedValue([
        { id: 1 },
        { id: 2 },
      ]);

      const result = await service.evaluateCondition('CHALLENGE_STATUS', { status: 'ACTIVE' });

      expect(mockPrismaService.userChallenge.findMany).toHaveBeenCalledWith({
        where: { status: 'ACTIVE' },
        select: { userId: true },
      });
      expect(result).toEqual([1, 2]);
    });

    it('status 파라미터가 없으면 빈 배열 반환', async () => {
      const result = await service.evaluateCondition('CHALLENGE_STATUS', {});
      expect(result).toEqual([]);
    });
  });

  describe('evaluateCondition - NO_ACCESS_HOURS', () => {
    it('N시간 이상 미접속 유저를 조회해야 함', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([
        { id: 1 },
        { id: 2 },
      ]);

      const result = await service.evaluateCondition('NO_ACCESS_HOURS', { hours: 24 });

      expect(mockPrismaService.user.findMany).toHaveBeenCalled();
      expect(result).toEqual([1, 2]);
    });

    it('hours 파라미터가 없으면 빈 배열 반환', async () => {
      const result = await service.evaluateCondition('NO_ACCESS_HOURS', {});
      expect(result).toEqual([]);
    });
  });

  describe('evaluateCondition - POINTS', () => {
    it('포인트 N 이상 유저를 조회해야 함', async () => {
      mockPrismaService.user.findMany.mockResolvedValue([
        { id: 1 },
        { id: 3 },
      ]);

      const result = await service.evaluateCondition('POINTS', { min: 1000 });

      expect(mockPrismaService.user.findMany).toHaveBeenCalledWith({
        where: { points: { gte: 1000 } },
        select: { id: true },
      });
    });

    it('min 파라미터가 없으면 빈 배열 반환', async () => {
      const result = await service.evaluateCondition('POINTS', {});
      expect(result).toEqual([]);
    });
  });

  describe('evaluateCondition - CART_HAS_ITEMS', () => {
    it('장바구니에 상품이 있는 유저를 조회해야 함', async () => {
      mockPrismaService.cart.findMany.mockResolvedValue([
        { userId: 1 },
        { userId: 2 },
      ]);
      mockPrismaService.user.findMany.mockResolvedValue([
        { id: 1 },
        { id: 2 },
      ]);

      const result = await service.evaluateCondition('CART_HAS_ITEMS', {});

      expect(mockPrismaService.cart.findMany).toHaveBeenCalledWith({
        where: { items: { some: {} } },
        select: { userId: true },
      });
    });
  });

  describe('evaluateCondition - REPORT_STATE', () => {
    it('읽지 않은 리포트가 있는 유저를 조회해야 함 (UNREAD)', async () => {
      mockPrismaService.userDeepReport.findMany.mockResolvedValue([
        { userId: 1 },
        { userId: 2 },
      ]);
      mockPrismaService.user.findMany.mockResolvedValue([
        { id: 1 },
        { id: 2 },
      ]);

      const result = await service.evaluateCondition('REPORT_STATE', { state: 'UNREAD' });

      expect(mockPrismaService.userDeepReport.findMany).toHaveBeenCalledWith({
        where: { readAt: null },
        select: { userId: true },
        distinct: ['userId'],
      });
    });

    it('state 파라미터가 없으면 빈 배열 반환', async () => {
      const result = await service.evaluateCondition('REPORT_STATE', {});
      expect(result).toEqual([]);
    });
  });

  describe('evaluateCondition - unknown type', () => {
    it('알 수 없는 조건 타입이면 빈 배열 반환', async () => {
      const result = await service.evaluateCondition('UNKNOWN_TYPE', {});
      expect(result).toEqual([]);
    });
  });

  describe('previewCondition', () => {
    it('조건 미리보기 결과를 반환해야 함', async () => {
      mockPrismaService.userChallenge.findMany.mockResolvedValue([
        { userId: 1 },
        { userId: 2 },
        { userId: 3 },
      ]);
      mockPrismaService.user.findMany
        .mockResolvedValueOnce([{ id: 1 }, { id: 2 }]) // filterUsersWithActiveToken
        .mockResolvedValueOnce([ // sampleUsers
          { id: 1, name: '유저1', mobile: '010-1234-5678', isTester: true },
          { id: 2, name: '유저2', mobile: '010-2345-6789', isTester: false },
        ]);
      mockPrismaService.user.count.mockResolvedValue(1);

      const result = await service.previewCondition('CHALLENGE_STATUS', { status: 'ACTIVE' });

      expect(result.totalCount).toBe(3);
      expect(result.withTokenCount).toBe(2);
      expect(result.testerCount).toBe(1);
      expect(result.sampleUsers).toHaveLength(2);
    });

    it('결과가 없으면 0과 빈 배열 반환', async () => {
      mockPrismaService.userChallenge.findMany.mockResolvedValue([]);

      const result = await service.previewCondition('CHALLENGE_STATUS', { status: 'ACTIVE' });

      expect(result).toEqual({
        totalCount: 0,
        withTokenCount: 0,
        testerCount: 0,
        sampleUsers: [],
      });
    });
  });

  describe('evaluateConditionTestersOnly', () => {
    it('조건에 맞는 테스터만 반환해야 함', async () => {
      mockPrismaService.userChallenge.findMany.mockResolvedValue([
        { userId: 1 },
        { userId: 2 },
        { userId: 3 },
      ]);
      mockPrismaService.user.findMany
        .mockResolvedValueOnce([{ id: 1 }, { id: 2 }, { id: 3 }]) // filterUsersWithActiveToken
        .mockResolvedValueOnce([{ id: 1 }, { id: 3 }]); // testers only

      const result = await service.evaluateConditionTestersOnly('CHALLENGE_STATUS', { status: 'ACTIVE' });

      expect(result).toEqual([1, 3]);
    });
  });
});
