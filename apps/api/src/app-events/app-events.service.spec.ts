import { Test, TestingModule } from '@nestjs/testing';
import { AppEventsService } from './app-events.service';
import { QueueService } from '../queues/queue.service';

describe('AppEventsService', () => {
  let service: AppEventsService;
  let queueService: QueueService;

  const mockQueueService = {
    addAppEvent: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AppEventsService,
        {
          provide: QueueService,
          useValue: mockQueueService,
        },
      ],
    }).compile();

    service = module.get<AppEventsService>(AppEventsService);
    queueService = module.get<QueueService>(QueueService);

    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('create', () => {
    it('Queue에 앱 이벤트를 추가해야 한다', async () => {
      const dto = {
        eventName: 'view_item',
        platform: 'ios',
        userId: 1,
        sessionId: 'test-session',
        eventCategory: 'ecommerce',
        itemId: '123',
        itemType: 'product',
      };

      const mockJob = { id: 'job-123' };
      mockQueueService.addAppEvent.mockResolvedValue(mockJob);

      const result = await service.create(dto);

      expect(queueService.addAppEvent).toHaveBeenCalledWith({
        appId: undefined,
        eventName: 'view_item',
        eventCategory: 'ecommerce',
        userId: 1,
        sessionId: 'test-session',
        platform: 'ios',
        itemId: '123',
        itemType: 'product',
        amount: undefined,
        quantity: undefined,
        params: undefined,
      });
      expect(result).toEqual({ id: 'job-123' });
    });

    it('Queue 추가 실패 시 에러를 던져야 한다', async () => {
      const dto = {
        eventName: 'view_item',
        platform: 'ios',
      };

      mockQueueService.addAppEvent.mockRejectedValue(new Error('Redis connection failed'));

      await expect(service.create(dto)).rejects.toThrow('Redis connection failed');
    });
  });
});
