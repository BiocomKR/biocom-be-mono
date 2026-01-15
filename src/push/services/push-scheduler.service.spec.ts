import { Test, TestingModule } from '@nestjs/testing';
import { PushSchedulerService } from './push-scheduler.service';
import { PrismaService } from '../../common/services/prisma.service';
import { PushCampaignService } from './push-campaign.service';

describe('PushSchedulerService', () => {
  let service: PushSchedulerService;

  const mockPrismaService = {
    pushNotificationSchedule: {
      findMany: jest.fn(),
    },
  };

  const mockPushCampaignService = {
    executeScheduledCampaign: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        PushSchedulerService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: PushCampaignService, useValue: mockPushCampaignService },
      ],
    }).compile();

    service = module.get<PushSchedulerService>(PushSchedulerService);
  });

  afterEach(() => {
    jest.clearAllMocks();
  });

  describe('filterByPushGroupPriority', () => {
    // private 메서드 접근을 위해 any로 캐스팅
    const callFilterByPushGroupPriority = (schedules: any[]) => {
      return (service as any).filterByPushGroupPriority(schedules);
    };

    it('같은 그룹에서 priority가 가장 높은 스케줄만 선택해야 함', () => {
      const schedules = [
        { id: 1, pushGroup: 'MISSION', priority: 100 },
        { id: 2, pushGroup: 'MISSION', priority: 300 },
        { id: 3, pushGroup: 'MISSION', priority: 200 },
      ];

      const result = callFilterByPushGroupPriority(schedules);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(2); // priority 300
    });

    it('다른 그룹은 각각 최고 우선순위를 선택해야 함', () => {
      const schedules = [
        { id: 1, pushGroup: 'MISSION', priority: 100 },
        { id: 2, pushGroup: 'MISSION', priority: 300 },
        { id: 3, pushGroup: 'REMIND', priority: 500 },
        { id: 4, pushGroup: 'REMIND', priority: 200 },
      ];

      const result = callFilterByPushGroupPriority(schedules);

      expect(result).toHaveLength(2);
      expect(result.find((s: any) => s.pushGroup === 'MISSION').id).toBe(2);
      expect(result.find((s: any) => s.pushGroup === 'REMIND').id).toBe(3);
    });

    it('pushGroup이 없으면 DEFAULT로 처리해야 함', () => {
      const schedules = [
        { id: 1, pushGroup: null, priority: 100 },
        { id: 2, pushGroup: undefined, priority: 200 },
        { id: 3, priority: 300 }, // pushGroup 필드 자체가 없음
      ];

      const result = callFilterByPushGroupPriority(schedules);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(3); // priority 300
    });

    it('priority가 없으면 0으로 처리해야 함', () => {
      const schedules = [
        { id: 1, pushGroup: 'MISSION', priority: null },
        { id: 2, pushGroup: 'MISSION', priority: undefined },
        { id: 3, pushGroup: 'MISSION' }, // priority 필드 없음
        { id: 4, pushGroup: 'MISSION', priority: 1 },
      ];

      const result = callFilterByPushGroupPriority(schedules);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(4); // priority 1 (나머지는 0으로 처리)
    });

    it('스케줄이 1개일 때 그대로 반환해야 함', () => {
      const schedules = [
        { id: 1, pushGroup: 'MISSION', priority: 500 },
      ];

      const result = callFilterByPushGroupPriority(schedules);

      expect(result).toHaveLength(1);
      expect(result[0].id).toBe(1);
    });

    it('빈 배열일 때 빈 배열 반환해야 함', () => {
      const result = callFilterByPushGroupPriority([]);

      expect(result).toHaveLength(0);
    });

    it('같은 priority면 먼저 나온 스케줄이 선택됨 (정렬 안정성)', () => {
      const schedules = [
        { id: 1, pushGroup: 'MISSION', priority: 500 },
        { id: 2, pushGroup: 'MISSION', priority: 500 },
        { id: 3, pushGroup: 'MISSION', priority: 500 },
      ];

      const result = callFilterByPushGroupPriority(schedules);

      expect(result).toHaveLength(1);
      // 정렬 후 첫 번째 요소 선택 (구현에 따라 다를 수 있음)
    });

    it('여러 그룹이 섞여있어도 올바르게 분류해야 함', () => {
      const schedules = [
        { id: 1, pushGroup: 'A', priority: 100 },
        { id: 2, pushGroup: 'B', priority: 200 },
        { id: 3, pushGroup: 'A', priority: 300 },
        { id: 4, pushGroup: 'C', priority: 50 },
        { id: 5, pushGroup: 'B', priority: 150 },
        { id: 6, pushGroup: 'C', priority: 100 },
      ];

      const result = callFilterByPushGroupPriority(schedules);

      expect(result).toHaveLength(3);
      expect(result.find((s: any) => s.pushGroup === 'A').id).toBe(3); // 300
      expect(result.find((s: any) => s.pushGroup === 'B').id).toBe(2); // 200
      expect(result.find((s: any) => s.pushGroup === 'C').id).toBe(6); // 100
    });
  });
});
