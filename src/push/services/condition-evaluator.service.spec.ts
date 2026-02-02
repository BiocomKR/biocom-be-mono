import { Test, TestingModule } from '@nestjs/testing';
import {
  ConditionEvaluatorService,
  ConditionType,
  ReportState,
} from './condition-evaluator.service';
import { PrismaService } from '../../common/services/prisma.service';
import { UserChallengeStatus } from '../../common/enums/challenge-ticket-status.enum';

// getNowKST mock
jest.mock('../../common/utils/kst-date.util', () => ({
  getNowKST: jest.fn(() => new Date('2025-01-15T12:00:00+09:00')),
}));

describe('ConditionEvaluatorService', () => {
  let service: ConditionEvaluatorService;
  let prisma: jest.Mocked<PrismaService>;

  // Mock Prisma
  const mockPrisma = {
    userChallenge: {
      findMany: jest.fn(),
    },
    user: {
      findMany: jest.fn(),
    },
    challengeMission: {
      findMany: jest.fn(),
    },
    userRecord: {
      findMany: jest.fn(),
    },
    userDeepReport: {
      findMany: jest.fn(),
      groupBy: jest.fn(),
    },
    userCoupon: {
      findMany: jest.fn(),
    },
    cart: {
      findMany: jest.fn(),
    },
  };

  beforeEach(async () => {
    jest.clearAllMocks();

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConditionEvaluatorService,
        {
          provide: PrismaService,
          useValue: mockPrisma,
        },
      ],
    }).compile();

    service = module.get<ConditionEvaluatorService>(ConditionEvaluatorService);
    prisma = module.get(PrismaService);
  });

  describe('evaluateChallengeDay', () => {
    it('정확한 일차(day=3) 유저 반환', async () => {
      // 2025-01-13에 시작한 챌린지 → 1/15 기준 3일차
      mockPrisma.userChallenge.findMany.mockResolvedValue([
        { userId: 1, activatedAt: new Date('2025-01-13T09:00:00+09:00') },
        { userId: 2, activatedAt: new Date('2025-01-14T09:00:00+09:00') }, // 2일차
        { userId: 3, activatedAt: new Date('2025-01-13T09:00:00+09:00') }, // 3일차
      ]);

      const result = await service.evaluateCondition(ConditionType.CHALLENGE_DAY, {
        day: 3,
      });

      expect(result).toEqual([1, 3]);
    });

    it('일차 범위(dayMin=1, dayMax=3) 유저 반환', async () => {
      mockPrisma.userChallenge.findMany.mockResolvedValue([
        { userId: 1, activatedAt: new Date('2025-01-15T09:00:00+09:00') }, // 1일차
        { userId: 2, activatedAt: new Date('2025-01-14T09:00:00+09:00') }, // 2일차
        { userId: 3, activatedAt: new Date('2025-01-10T09:00:00+09:00') }, // 6일차
      ]);

      const result = await service.evaluateCondition(ConditionType.CHALLENGE_DAY, {
        dayMin: 1,
        dayMax: 3,
      });

      expect(result).toEqual([1, 2]);
    });
  });

  describe('evaluateChallengeStatus', () => {
    it('ACTIVE 상태 유저 반환', async () => {
      mockPrisma.userChallenge.findMany.mockResolvedValue([
        { userId: 1 },
        { userId: 2 },
      ]);

      const result = await service.evaluateCondition(ConditionType.CHALLENGE_STATUS, {
        status: UserChallengeStatus.ACTIVE,
      });

      expect(mockPrisma.userChallenge.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { status: { in: [UserChallengeStatus.ACTIVE] } },
        }),
      );
      expect(result).toEqual([1, 2]);
    });

    it('복수 상태(ACTIVE, PENDING) 유저 반환', async () => {
      mockPrisma.userChallenge.findMany.mockResolvedValue([
        { userId: 1 },
        { userId: 2 },
        { userId: 3 },
      ]);

      const result = await service.evaluateCondition(ConditionType.CHALLENGE_STATUS, {
        statuses: [UserChallengeStatus.ACTIVE, UserChallengeStatus.PENDING],
      });

      expect(result).toEqual([1, 2, 3]);
    });

    it('상태 미지정 시 빈 배열 반환', async () => {
      const result = await service.evaluateCondition(ConditionType.CHALLENGE_STATUS, {});

      expect(result).toEqual([]);
    });
  });

  describe('evaluateNoAccessHours', () => {
    it('24시간 이상 미접속 유저 반환', async () => {
      const now = new Date('2025-01-15T12:00:00+09:00');

      mockPrisma.user.findMany.mockResolvedValue([
        { id: 1, lastSeenAt: new Date('2025-01-14T10:00:00+09:00') }, // 26시간 전
        { id: 2, lastSeenAt: new Date('2025-01-15T10:00:00+09:00') }, // 2시간 전
        { id: 3, lastSeenAt: new Date('2025-01-13T12:00:00+09:00') }, // 48시간 전
      ]);

      const result = await service.evaluateCondition(ConditionType.NO_ACCESS_HOURS, {
        hours: 24,
      });

      expect(result).toEqual([1, 3]);
    });

    it('24~48시간 미접속 유저 반환', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 1, lastSeenAt: new Date('2025-01-14T10:00:00+09:00') }, // 26시간 전
        { id: 2, lastSeenAt: new Date('2025-01-15T10:00:00+09:00') }, // 2시간 전
        { id: 3, lastSeenAt: new Date('2025-01-12T12:00:00+09:00') }, // 72시간 전
      ]);

      const result = await service.evaluateCondition(ConditionType.NO_ACCESS_HOURS, {
        hoursMin: 24,
        hoursMax: 48,
      });

      expect(result).toEqual([1]);
    });
  });

  describe('evaluateReportState', () => {
    it('UNREAD 상태 - 읽지 않은 리포트가 있는 유저 반환', async () => {
      mockPrisma.userDeepReport.findMany.mockResolvedValue([
        { userId: 1 },
        { userId: 2 },
      ]);

      const result = await service.evaluateCondition(ConditionType.REPORT_STATE, {
        state: ReportState.UNREAD,
      });

      expect(mockPrisma.userDeepReport.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { isRead: false },
        }),
      );
      expect(result).toEqual([1, 2]);
    });

    it('ALL_READ 상태 - 모든 리포트를 읽은 유저 반환', async () => {
      mockPrisma.userDeepReport.groupBy.mockResolvedValue([
        { userId: 1 },
        { userId: 2 },
        { userId: 3 },
      ]);
      mockPrisma.userDeepReport.findMany.mockResolvedValue([
        { userId: 2 }, // userId 2만 unread
      ]);

      const result = await service.evaluateCondition(ConditionType.REPORT_STATE, {
        state: ReportState.ALL_READ,
      });

      expect(result).toEqual([1, 3]);
    });

    it('상태 미지정 시 빈 배열 반환', async () => {
      const result = await service.evaluateCondition(ConditionType.REPORT_STATE, {});

      expect(result).toEqual([]);
    });
  });

  describe('evaluatePoints', () => {
    it('최소 포인트 이상 유저 반환', async () => {
      mockPrisma.user.findMany.mockResolvedValue([
        { id: 1 },
        { id: 2 },
      ]);

      const result = await service.evaluateCondition(ConditionType.POINTS, {
        pointsMin: 1000,
      });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            points: { gte: 1000 },
          }),
        }),
      );
      expect(result).toEqual([1, 2]);
    });

    it('포인트 범위 유저 반환', async () => {
      mockPrisma.user.findMany.mockResolvedValue([{ id: 1 }]);

      const result = await service.evaluateCondition(ConditionType.POINTS, {
        pointsMin: 500,
        pointsMax: 2000,
      });

      expect(mockPrisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            points: { gte: 500, lte: 2000 },
          }),
        }),
      );
      expect(result).toEqual([1]);
    });
  });

  describe('evaluateCartHasItems', () => {
    it('장바구니에 상품이 있는 유저 반환', async () => {
      mockPrisma.cart.findMany.mockResolvedValue([
        { userId: 1 },
        { userId: 3 },
      ]);

      const result = await service.evaluateCondition(ConditionType.CART_HAS_ITEMS, {});

      expect(mockPrisma.cart.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {
            items: {
              some: {
                quantity: { gt: 0 },
              },
            },
          },
        }),
      );
      expect(result).toEqual([1, 3]);
    });
  });

  describe('evaluateCouponExpiringHours', () => {
    it('24시간 내 만료 예정 쿠폰 보유 유저 반환', async () => {
      mockPrisma.userCoupon.findMany.mockResolvedValue([
        { userId: 1 },
        { userId: 2 },
      ]);

      const result = await service.evaluateCondition(ConditionType.COUPON_EXPIRING_HOURS, {
        expiringHours: 24,
      });

      expect(mockPrisma.userCoupon.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: 'ACTIVE',
          }),
        }),
      );
      expect(result).toEqual([1, 2]);
    });

    it('expiringHours 미지정 시 빈 배열 반환', async () => {
      const result = await service.evaluateCondition(
        ConditionType.COUPON_EXPIRING_HOURS,
        {},
      );

      expect(result).toEqual([]);
    });
  });

  describe('evaluateChallengeStartOffsetDays', () => {
    it('D-1 (내일 시작) 유저 반환', async () => {
      mockPrisma.userChallenge.findMany.mockResolvedValue([
        { userId: 1 },
        { userId: 2 },
      ]);

      const result = await service.evaluateCondition(
        ConditionType.CHALLENGE_START_OFFSET_DAYS,
        { offsetDays: -1 },
      );

      expect(mockPrisma.userChallenge.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            status: UserChallengeStatus.PENDING,
          }),
        }),
      );
      expect(result).toEqual([1, 2]);
    });

    it('D-Day (오늘 시작) 유저 반환', async () => {
      mockPrisma.userChallenge.findMany.mockResolvedValue([{ userId: 3 }]);

      const result = await service.evaluateCondition(
        ConditionType.CHALLENGE_START_OFFSET_DAYS,
        { offsetDays: 0 },
      );

      expect(result).toEqual([3]);
    });

    it('offsetDays 미지정 시 빈 배열 반환', async () => {
      const result = await service.evaluateCondition(
        ConditionType.CHALLENGE_START_OFFSET_DAYS,
        {},
      );

      expect(result).toEqual([]);
    });
  });

  describe('evaluateConditions (AND 조합)', () => {
    it('여러 조건의 교집합 반환', async () => {
      // CHALLENGE_STATUS → [1, 2, 3]
      mockPrisma.userChallenge.findMany
        .mockResolvedValueOnce([{ userId: 1 }, { userId: 2 }, { userId: 3 }])
        // CHALLENGE_DAY → [2, 3, 4]
        .mockResolvedValueOnce([
          { userId: 2, activatedAt: new Date('2025-01-13T09:00:00+09:00') },
          { userId: 3, activatedAt: new Date('2025-01-13T09:00:00+09:00') },
          { userId: 4, activatedAt: new Date('2025-01-13T09:00:00+09:00') },
        ]);

      const result = await service.evaluateConditions({
        id: 1,
        conditions: [
          { type: ConditionType.CHALLENGE_STATUS, params: { status: 'ACTIVE' } },
          { type: ConditionType.CHALLENGE_DAY, params: { day: 3 } },
        ],
      });

      // 교집합: [2, 3]
      expect(result).toEqual(expect.arrayContaining([2, 3]));
      expect(result.length).toBe(2);
    });

    it('conditions 없으면 빈 배열 반환', async () => {
      const result = await service.evaluateConditions({
        id: 1,
        conditions: null,
      });

      expect(result).toEqual([]);
    });
  });

  describe('evaluateForUser', () => {
    it('단일 유저 조건 충족 시 matched=true 반환', async () => {
      mockPrisma.userChallenge.findMany.mockResolvedValue([
        { userId: 1 },
        { userId: 2 },
      ]);

      const result = await service.evaluateForUser(1, ConditionType.CHALLENGE_STATUS, {
        status: UserChallengeStatus.ACTIVE,
      });

      expect(result).toEqual({
        matched: true,
        userId: 1,
        reason: '조건 충족',
      });
    });

    it('단일 유저 조건 미충족 시 matched=false 반환', async () => {
      mockPrisma.userChallenge.findMany.mockResolvedValue([{ userId: 2 }]);

      const result = await service.evaluateForUser(1, ConditionType.CHALLENGE_STATUS, {
        status: UserChallengeStatus.ACTIVE,
      });

      expect(result).toEqual({
        matched: false,
        userId: 1,
        reason: '조건 미충족',
      });
    });
  });

  describe('미구현 조건 타입', () => {
    it('알 수 없는 조건 타입은 빈 배열 반환', async () => {
      const result = await service.evaluateCondition('UNKNOWN_TYPE' as any, {});

      expect(result).toEqual([]);
    });
  });
});
