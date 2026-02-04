import { Test, TestingModule } from '@nestjs/testing';
import { AppEventProcessor, AppEventJobData } from './app-event.processor';
import { PrismaService } from '../common/services/prisma.service';
import { Job } from 'bullmq';

describe('AppEventProcessor', () => {
  let processor: AppEventProcessor;
  let prismaService: PrismaService;

  const mockPrismaService = {
    appEvent: {
      create: jest.fn(),
    },
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppEventProcessor,
        {
          provide: PrismaService,
          useValue: mockPrismaService,
        },
      ],
    }).compile();

    processor = module.get<AppEventProcessor>(AppEventProcessor);
    prismaService = module.get<PrismaService>(PrismaService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(processor).toBeDefined();
  });

  describe('process', () => {
    it('Job 데이터로 앱 이벤트를 DB에 저장해야 한다', async () => {
      const jobData: AppEventJobData = {
        eventName: 'view_item',
        platform: 'ios',
        userId: 1,
        sessionId: 'test-session',
        eventCategory: 'ecommerce',
        itemId: '123',
        itemType: 'product',
        amount: 50000,
        quantity: 1,
        params: { source: 'home' },
      };

      const mockJob = {
        id: 'job-123',
        data: jobData,
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as unknown as Job<AppEventJobData>;

      const mockCreatedEvent = { id: 1, ...jobData };
      mockPrismaService.appEvent.create.mockResolvedValue(mockCreatedEvent);

      await processor.process(mockJob);

      expect(prismaService.appEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          eventName: 'view_item',
          platform: 'ios',
          userId: 1,
          sessionId: 'test-session',
          eventCategory: 'ecommerce',
          itemId: '123',
          itemType: 'product',
          quantity: 1,
          params: { source: 'home' },
        }),
      });
    });

    it('appId 없으면 기본값 challenge 사용', async () => {
      const jobData: AppEventJobData = {
        eventName: 'app_open',
        platform: 'android',
      };

      const mockJob = {
        id: 'job-456',
        data: jobData,
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as unknown as Job<AppEventJobData>;

      mockPrismaService.appEvent.create.mockResolvedValue({ id: 2 });

      await processor.process(mockJob);

      expect(prismaService.appEvent.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          appId: 'challenge',
          eventName: 'app_open',
          platform: 'android',
        }),
      });
    });

    it('DB 저장 실패 시 에러를 던져야 한다', async () => {
      const jobData: AppEventJobData = {
        eventName: 'test_event',
        platform: 'ios',
      };

      const mockJob = {
        id: 'job-789',
        data: jobData,
        attemptsMade: 0,
        opts: { attempts: 3 },
      } as unknown as Job<AppEventJobData>;

      mockPrismaService.appEvent.create.mockRejectedValue(new Error('DB connection failed'));

      await expect(processor.process(mockJob)).rejects.toThrow('DB connection failed');
    });
  });
});
