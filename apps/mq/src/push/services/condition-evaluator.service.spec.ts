import { Test, TestingModule } from '@nestjs/testing';
import { ConditionEvaluatorService, ConditionType } from './condition-evaluator.service';
import { PrismaService } from '../../common/services/prisma.service';
import {
  User,
  UserChallenge,
  ChallengeMission,
  UserRecord,
  Cart,
  CartItem,
  UserCoupon,
} from '@prisma/client';

/**
 * Mock 데이터 팩토리
 * Prisma 타입을 사용하여 컴파일 타임에 필드 오류 감지
 */
const createMockUserChallenge = (
  overrides: Partial<UserChallenge> = {},
): Pick<UserChallenge, 'id' | 'userId' | 'productId' | 'status' | 'activatedAt'> => ({
  id: 1,
  userId: 1,
  productId: 1,
  status: 'ACTIVE',
  activatedAt: new Date(),
  ...overrides,
});

const createMockUser = (
  overrides: Partial<User> = {},
): Pick<User, 'id' | 'isActive' | 'pushEnabled' | 'lastSeenAt' | 'points'> => ({
  id: 1,
  isActive: true,
  pushEnabled: true,
  lastSeenAt: new Date(),
  points: 100,
  ...overrides,
});

const createMockChallengeMission = (
  overrides: Partial<ChallengeMission> = {},
): Pick<ChallengeMission, 'id' | 'productId' | 'day' | 'isActive'> => ({
  id: 1,
  productId: 1,
  day: 1,
  isActive: true,
  ...overrides,
});

const createMockUserRecord = (
  overrides: Partial<UserRecord> = {},
): Pick<UserRecord, 'id' | 'userId' | 'userChallengeId' | 'metadata'> => ({
  id: 1,
  userId: 1,
  userChallengeId: 1,
  metadata: { isCompleted: true, challengeMissionId: 1 },
  ...overrides,
});

const createMockCart = (
  overrides: Partial<Cart> = {},
): Pick<Cart, 'id' | 'userId'> => ({
  id: 1,
  userId: 1,
  ...overrides,
});

describe('ConditionEvaluatorService', () => {
  let service: ConditionEvaluatorService;
  let prisma: jest.Mocked<PrismaService>;

  beforeEach(async () => {
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
      cart: {
        findMany: jest.fn(),
      },
      userCoupon: {
        findMany: jest.fn(),
      },
      userDeepReport: {
        findMany: jest.fn(),
        groupBy: jest.fn(),
      },
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConditionEvaluatorService,
        { provide: PrismaService, useValue: mockPrisma },
      ],
    }).compile();

    service = module.get<ConditionEvaluatorService>(ConditionEvaluatorService);
    prisma = module.get(PrismaService);
  });

  describe('CHALLENGE_DAY', () => {
    it('정확한 일차에 해당하는 유저를 반환한다', async () => {
      // 7일 전에 시작한 챌린지 = 오늘 7일차
      const sevenDaysAgo = new Date();
      sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 6); // 7일차 = 시작일 포함 7일
      sevenDaysAgo.setHours(0, 0, 0, 0);

      const mockUserChallenges = [
        createMockUserChallenge({ userId: 1, activatedAt: sevenDaysAgo }),
        createMockUserChallenge({ userId: 2, activatedAt: new Date() }), // 오늘 시작 = 1일차
      ];

      (prisma.userChallenge.findMany as jest.Mock).mockResolvedValue(mockUserChallenges);

      const result = await service.evaluateCondition(ConditionType.CHALLENGE_DAY, { day: 7 });

      expect(result).toContain(1);
      expect(result).not.toContain(2);
    });

    it('일차 범위에 해당하는 유저를 반환한다', async () => {
      const threeDaysAgo = new Date();
      threeDaysAgo.setDate(threeDaysAgo.getDate() - 2);
      threeDaysAgo.setHours(0, 0, 0, 0);

      const mockUserChallenges = [
        createMockUserChallenge({ userId: 1, activatedAt: threeDaysAgo }), // 3일차
        createMockUserChallenge({ userId: 2, activatedAt: new Date() }), // 1일차
      ];

      (prisma.userChallenge.findMany as jest.Mock).mockResolvedValue(mockUserChallenges);

      const result = await service.evaluateCondition(ConditionType.CHALLENGE_DAY, {
        dayMin: 1,
        dayMax: 3,
      });

      expect(result).toContain(1);
      expect(result).toContain(2);
    });
  });

  describe('CHALLENGE_STATUS', () => {
    it('특정 상태의 챌린지를 가진 유저를 반환한다', async () => {
      const mockUserChallenges = [
        createMockUserChallenge({ userId: 1, status: 'ACTIVE' }),
        createMockUserChallenge({ userId: 2, status: 'COMPLETED' }),
      ];

      (prisma.userChallenge.findMany as jest.Mock).mockResolvedValue(
        mockUserChallenges.filter((uc) => uc.status === 'ACTIVE'),
      );

      const result = await service.evaluateCondition(ConditionType.CHALLENGE_STATUS, {
        status: 'ACTIVE',
      });

      expect(result).toContain(1);
      expect(result).not.toContain(2);
    });
  });

  describe('NO_ACCESS_HOURS', () => {
    it('N시간 이상 미접속 유저를 반환한다', async () => {
      const twentyFiveHoursAgo = new Date();
      twentyFiveHoursAgo.setHours(twentyFiveHoursAgo.getHours() - 25);

      const oneHourAgo = new Date();
      oneHourAgo.setHours(oneHourAgo.getHours() - 1);

      const mockUsers = [
        createMockUser({ id: 1, lastSeenAt: twentyFiveHoursAgo }), // 25시간 전
        createMockUser({ id: 2, lastSeenAt: oneHourAgo }), // 1시간 전
      ];

      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);

      const result = await service.evaluateCondition(ConditionType.NO_ACCESS_HOURS, {
        hours: 24,
      });

      expect(result).toContain(1);
      expect(result).not.toContain(2);
    });

    it('시간 범위에 해당하는 유저를 반환한다', async () => {
      const thirtyHoursAgo = new Date();
      thirtyHoursAgo.setHours(thirtyHoursAgo.getHours() - 30);

      const fiftyHoursAgo = new Date();
      fiftyHoursAgo.setHours(fiftyHoursAgo.getHours() - 50);

      const mockUsers = [
        createMockUser({ id: 1, lastSeenAt: thirtyHoursAgo }), // 30시간 전 (24~48 범위 내)
        createMockUser({ id: 2, lastSeenAt: fiftyHoursAgo }), // 50시간 전 (범위 초과)
      ];

      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsers);

      const result = await service.evaluateCondition(ConditionType.NO_ACCESS_HOURS, {
        hoursMin: 24,
        hoursMax: 48,
      });

      expect(result).toContain(1);
      expect(result).not.toContain(2);
    });
  });

  describe('INCOMPLETE_COUNT', () => {
    it('오늘 미완료 미션 수가 일치하는 유저를 반환한다', async () => {
      const today = new Date();
      today.setHours(0, 0, 0, 0);

      const mockUserChallenges = [
        createMockUserChallenge({ id: 1, userId: 1, productId: 1, activatedAt: today }),
      ];

      // 오늘의 미션 3개
      const mockMissions = [
        createMockChallengeMission({ id: 1, productId: 1, day: 1 }),
        createMockChallengeMission({ id: 2, productId: 1, day: 1 }),
        createMockChallengeMission({ id: 3, productId: 1, day: 1 }),
      ];

      // 완료된 미션 1개 (미션 ID 1)
      const mockRecords = [
        createMockUserRecord({
          userId: 1,
          userChallengeId: 1,
          metadata: { isCompleted: true, challengeMissionId: 1 },
        }),
      ];

      (prisma.userChallenge.findMany as jest.Mock).mockResolvedValue(mockUserChallenges);
      (prisma.challengeMission.findMany as jest.Mock).mockResolvedValue(mockMissions);
      (prisma.userRecord.findMany as jest.Mock).mockResolvedValue(mockRecords);

      // 미완료 미션 수 = 3 - 1 = 2
      const result = await service.evaluateCondition(ConditionType.INCOMPLETE_COUNT, {
        count: 2,
      });

      expect(result).toContain(1);
    });
  });

  describe('POINTS', () => {
    it('포인트 범위에 해당하는 유저를 반환한다', async () => {
      const mockUsers = [
        createMockUser({ id: 1, points: 500 }),
        createMockUser({ id: 2, points: 1500 }),
        createMockUser({ id: 3, points: 100 }),
      ];

      (prisma.user.findMany as jest.Mock).mockResolvedValue(
        mockUsers.filter((u) => u.points >= 200 && u.points <= 1000),
      );

      const result = await service.evaluateCondition(ConditionType.POINTS, {
        pointsMin: 200,
        pointsMax: 1000,
      });

      expect(result).toContain(1);
      expect(result).not.toContain(2);
      expect(result).not.toContain(3);
    });
  });

  describe('CART_HAS_ITEMS', () => {
    it('장바구니에 상품이 있는 유저를 반환한다', async () => {
      const mockCarts = [
        createMockCart({ id: 1, userId: 1 }),
        createMockCart({ id: 2, userId: 2 }),
      ];

      (prisma.cart.findMany as jest.Mock).mockResolvedValue(mockCarts);

      const result = await service.evaluateCondition(ConditionType.CART_HAS_ITEMS, {});

      expect(result).toContain(1);
      expect(result).toContain(2);
    });
  });

  describe('evaluateConditions (AND 조합)', () => {
    it('여러 조건을 AND로 조합하여 교집합을 반환한다', async () => {
      // 첫 번째 조건: CHALLENGE_STATUS = ACTIVE
      const mockActiveUserChallenges = [
        createMockUserChallenge({ userId: 1, status: 'ACTIVE' }),
        createMockUserChallenge({ userId: 2, status: 'ACTIVE' }),
        createMockUserChallenge({ userId: 3, status: 'ACTIVE' }),
      ];

      // 두 번째 조건: POINTS >= 100
      const mockUsersWithPoints = [
        createMockUser({ id: 1, points: 200 }),
        createMockUser({ id: 3, points: 150 }),
        // userId 2는 포인트 부족으로 제외
      ];

      (prisma.userChallenge.findMany as jest.Mock).mockResolvedValue(mockActiveUserChallenges);
      (prisma.user.findMany as jest.Mock).mockResolvedValue(mockUsersWithPoints);

      const result = await service.evaluateConditions({
        id: 1,
        conditions: [
          { type: 'CHALLENGE_STATUS', params: { status: 'ACTIVE' } },
          { type: 'POINTS', params: { pointsMin: 100 } },
        ],
      });

      // ACTIVE인 유저: 1, 2, 3
      // POINTS >= 100인 유저: 1, 3
      // 교집합: 1, 3
      expect(result).toContain(1);
      expect(result).toContain(3);
      expect(result).not.toContain(2);
    });
  });

  describe('evaluateForUser', () => {
    it('단일 유저에 대해 조건 충족 여부를 반환한다', async () => {
      const mockUserChallenges = [
        createMockUserChallenge({ userId: 1, status: 'ACTIVE' }),
      ];

      (prisma.userChallenge.findMany as jest.Mock).mockResolvedValue(mockUserChallenges);

      const result = await service.evaluateForUser(1, ConditionType.CHALLENGE_STATUS, {
        status: 'ACTIVE',
      });

      expect(result.matched).toBe(true);
      expect(result.userId).toBe(1);
    });

    it('조건을 충족하지 않는 유저는 matched=false를 반환한다', async () => {
      (prisma.userChallenge.findMany as jest.Mock).mockResolvedValue([]);

      const result = await service.evaluateForUser(999, ConditionType.CHALLENGE_STATUS, {
        status: 'ACTIVE',
      });

      expect(result.matched).toBe(false);
      expect(result.userId).toBe(999);
    });
  });
});
