import { Test, TestingModule } from '@nestjs/testing';
import {
  ConditionEvaluatorService,
  ConditionType,
} from './condition-evaluator.service';
import { PrismaService } from '../../common/services/prisma.service';

describe('ConditionEvaluatorService', () => {
  let service: ConditionEvaluatorService;

  const mockPrismaService = {
    user: { findMany: jest.fn() },
    userChallenge: { findMany: jest.fn() },
    dailyProgress: { findMany: jest.fn() },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        ConditionEvaluatorService,
        { provide: PrismaService, useValue: mockPrismaService },
      ],
    }).compile();

    service = module.get<ConditionEvaluatorService>(ConditionEvaluatorService);
    jest.clearAllMocks();
  });

  describe('evaluateConditions (AND 조합)', () => {
    it('conditions 배열로 AND 조합 평가', async () => {
      // Given: 조건별 유저
      // CHALLENGE_DAY=1: [1, 2, 3]
      // INCOMPLETE_TYPES: [1, 3, 5]
      // 교집합: [1, 3]
      jest
        .spyOn(service, 'evaluateCondition')
        .mockResolvedValueOnce([1, 2, 3])
        .mockResolvedValueOnce([1, 3, 5]);

      const schedule = {
        id: 1,
        conditions: [
          { type: ConditionType.CHALLENGE_DAY, params: { day: 1 } },
          {
            type: ConditionType.INCOMPLETE_TYPES,
            params: { types: ['DECLARATION'] },
          },
        ],
      };

      // When
      const result = await service.evaluateConditions(schedule);

      // Then: 교집합
      expect(result.sort()).toEqual([1, 3]);
    });

    it('3개 조건 AND 조합', async () => {
      jest
        .spyOn(service, 'evaluateCondition')
        .mockResolvedValueOnce([1, 2, 3, 4, 5])
        .mockResolvedValueOnce([1, 2, 3])
        .mockResolvedValueOnce([1, 3]);

      const schedule = {
        id: 1,
        conditions: [
          { type: ConditionType.CHALLENGE_DAY, params: { day: 1 } },
          {
            type: ConditionType.INCOMPLETE_TYPES,
            params: { types: ['DECLARATION'] },
          },
          { type: ConditionType.COMPLETION_RATE, params: { rateMax: 50 } },
        ],
      };

      const result = await service.evaluateConditions(schedule);
      expect(result.sort()).toEqual([1, 3]);
    });

    it('교집합이 빈 배열인 경우', async () => {
      jest
        .spyOn(service, 'evaluateCondition')
        .mockResolvedValueOnce([1, 2])
        .mockResolvedValueOnce([3, 4]);

      const schedule = {
        id: 1,
        conditions: [
          { type: ConditionType.CHALLENGE_DAY, params: { day: 1 } },
          { type: ConditionType.CHALLENGE_DAY, params: { day: 2 } },
        ],
      };

      const result = await service.evaluateConditions(schedule);
      expect(result).toEqual([]);
    });

    it('conditions가 없으면 빈 배열 반환', async () => {
      const schedule = { id: 1, conditions: null };
      const result = await service.evaluateConditions(schedule);
      expect(result).toEqual([]);
    });

    it('conditions가 빈 배열이면 빈 배열 반환', async () => {
      const schedule = { id: 1, conditions: [] };
      const result = await service.evaluateConditions(schedule);
      expect(result).toEqual([]);
    });
  });

  describe('교집합 성능 테스트', () => {
    it('대용량 유저 교집합 계산', async () => {
      const users1 = Array.from({ length: 1000 }, (_, i) => i + 1);
      const users2 = Array.from({ length: 1000 }, (_, i) => i + 901);

      jest
        .spyOn(service, 'evaluateCondition')
        .mockResolvedValueOnce(users1)
        .mockResolvedValueOnce(users2);

      const schedule = {
        id: 1,
        conditions: [
          { type: ConditionType.CHALLENGE_DAY, params: { day: 1 } },
          {
            type: ConditionType.INCOMPLETE_TYPES,
            params: { types: ['DECLARATION'] },
          },
        ],
      };

      const start = Date.now();
      const result = await service.evaluateConditions(schedule);
      const elapsed = Date.now() - start;

      expect(result.length).toBe(100);
      expect(result.sort((a: number, b: number) => a - b)[0]).toBe(901);
      expect(elapsed).toBeLessThan(100);
    });
  });
});
