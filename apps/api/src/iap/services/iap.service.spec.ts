import { Test, TestingModule } from '@nestjs/testing';
import { IapService } from './iap.service';
import { AppleIapService } from './apple-iap.service';
import { GoogleIapService } from './google-iap.service';
import { PrismaService } from '../../common/services/prisma.service';
import { ConflictException, BadRequestException } from '@nestjs/common';
import { IAPPlatformType } from '../dto/verify-receipt.dto';

describe('IapService', () => {
  let service: IapService;
  let prismaService: any;
  let appleIapService: any;
  let googleIapService: any;

  // 트랜잭션 내부에서 사용할 Mock
  const mockTxClient = {
    iAPReceipt: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      update: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
    },
    challengeTicket: {
      create: jest.fn(),
    },
  };

  const mockPrismaService = {
    iAPReceipt: {
      findUnique: jest.fn(),
      upsert: jest.fn(),
      findMany: jest.fn(),
      update: jest.fn(),
    },
    iAPProduct: {
      findUnique: jest.fn(),
      findMany: jest.fn(),
    },
    product: {
      findUnique: jest.fn(),
    },
    challengeTicket: {
      create: jest.fn(),
    },
    // $transaction Mock: 콜백 함수를 받아서 mockTxClient로 실행
    $transaction: jest.fn((callback) => callback(mockTxClient)),
  };

  const mockAppleIapService = {
    verifyReceipt: jest.fn(),
  };

  const mockGoogleIapService = {
    verifyReceipt: jest.fn(),
    acknowledgePurchase: jest.fn(),
  };

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        IapService,
        { provide: PrismaService, useValue: mockPrismaService },
        { provide: AppleIapService, useValue: mockAppleIapService },
        { provide: GoogleIapService, useValue: mockGoogleIapService },
      ],
    }).compile();

    service = module.get<IapService>(IapService);
    prismaService = module.get(PrismaService);
    appleIapService = module.get(AppleIapService);
    googleIapService = module.get(GoogleIapService);
  });

  afterEach(() => {
    jest.clearAllMocks();
    // 트랜잭션 Mock도 초기화
    mockTxClient.iAPReceipt.findUnique.mockReset();
    mockTxClient.iAPReceipt.upsert.mockReset();
    mockTxClient.iAPReceipt.update.mockReset();
    mockTxClient.product.findUnique.mockReset();
    mockTxClient.challengeTicket.create.mockReset();
  });

  describe('verifyAndProcessPurchase', () => {
    const mockUserId = 1;
    const mockDto = {
      platform: IAPPlatformType.APPLE,
      receiptData: 'mock-receipt-data',
      productId: 'com.BiocomChallenge.consumable.ticket1',
      transactionId: 'test-transaction-123',
    };

    const mockIapProduct = {
      id: 1,
      appleProductId: 'com.BiocomChallenge.consumable.ticket1',
      googleProductId: 'challenge_ticket_1',
      productId: 10,
      name: '챌린지 티켓 1개',
      isActive: true,
      product: { id: 10, price: 9900 },
    };

    const mockReceipt = {
      id: 1,
      userId: mockUserId,
      iapProductId: 1,
      platform: 'APPLE',
      transactionId: 'test-transaction-123',
      status: 'VERIFIED',
    };

    const mockTicket = {
      id: 100,
      userId: mockUserId,
      productId: 10,
      ticketType: 'IAP',
      status: 'PURCHASED',
    };

    describe('중복 구매 검증', () => {
      it('이미 검증된 트랜잭션이면 ConflictException 발생', async () => {
        // 상품 조회 성공 (트랜잭션 외부)
        mockPrismaService.iAPProduct.findUnique.mockResolvedValue(mockIapProduct);
        // Apple 검증 성공
        mockAppleIapService.verifyReceipt.mockResolvedValue({
          isValid: true,
          transactionId: mockDto.transactionId,
          purchaseDate: new Date(),
          rawResponse: {},
        });
        // 트랜잭션 내부에서 중복 체크 - 이미 VERIFIED 상태
        mockTxClient.iAPReceipt.findUnique.mockResolvedValue({
          ...mockReceipt,
          status: 'VERIFIED',
        });

        await expect(
          service.verifyAndProcessPurchase(mockUserId, mockDto),
        ).rejects.toThrow(ConflictException);
      });

      it('실패한 검증은 재시도 허용', async () => {
        // 상품 조회 성공 (트랜잭션 외부)
        mockPrismaService.iAPProduct.findUnique.mockResolvedValue(mockIapProduct);
        // Apple 검증 성공
        mockAppleIapService.verifyReceipt.mockResolvedValue({
          isValid: true,
          transactionId: mockDto.transactionId,
          purchaseDate: new Date(),
          rawResponse: {},
        });
        // 트랜잭션 내부 - 기존 FAILED 상태 (재시도 허용)
        mockTxClient.iAPReceipt.findUnique.mockResolvedValue({
          ...mockReceipt,
          status: 'FAILED',
        });
        mockTxClient.iAPReceipt.upsert.mockResolvedValue(mockReceipt);
        mockTxClient.product.findUnique.mockResolvedValue({ id: 10, price: 9900 });
        mockTxClient.challengeTicket.create.mockResolvedValue(mockTicket);
        mockTxClient.iAPReceipt.update.mockResolvedValue(mockReceipt);

        const result = await service.verifyAndProcessPurchase(mockUserId, mockDto);

        expect(result.success).toBe(true);
      });
    });

    describe('IAP 상품 검증', () => {
      it('등록되지 않은 상품이면 BadRequestException 발생', async () => {
        mockPrismaService.iAPReceipt.findUnique.mockResolvedValue(null);
        mockPrismaService.iAPProduct.findUnique.mockResolvedValue(null);

        await expect(
          service.verifyAndProcessPurchase(mockUserId, mockDto),
        ).rejects.toThrow(BadRequestException);
      });
    });

    describe('Apple 영수증 검증', () => {
      beforeEach(() => {
        mockPrismaService.iAPProduct.findUnique.mockResolvedValue(mockIapProduct);
      });

      it('Apple 영수증 검증 성공 시 티켓 발급', async () => {
        // Apple 검증 성공
        mockAppleIapService.verifyReceipt.mockResolvedValue({
          isValid: true,
          transactionId: mockDto.transactionId,
          originalTransactionId: 'original-123',
          purchaseDate: new Date(),
          rawResponse: { status: 0 },
        });
        // 트랜잭션 내부 Mock
        mockTxClient.iAPReceipt.findUnique.mockResolvedValue(null); // 중복 없음
        mockTxClient.iAPReceipt.upsert.mockResolvedValue(mockReceipt);
        mockTxClient.product.findUnique.mockResolvedValue({ id: 10, price: 9900 });
        mockTxClient.challengeTicket.create.mockResolvedValue(mockTicket);
        mockTxClient.iAPReceipt.update.mockResolvedValue(mockReceipt);

        const result = await service.verifyAndProcessPurchase(mockUserId, mockDto);

        expect(result.success).toBe(true);
        expect(result.ticketId).toBe(100);
        expect(mockAppleIapService.verifyReceipt).toHaveBeenCalledWith(
          mockDto.receiptData,
          mockDto.transactionId,
        );
      });

      it('Apple 영수증 검증 실패 시 실패 반환', async () => {
        mockAppleIapService.verifyReceipt.mockResolvedValue({
          isValid: false,
          error: 'INVALID_RECEIPT',
          message: '영수증이 유효하지 않습니다.',
        });
        // 검증 실패 시 트랜잭션 없이 저장 (prisma 직접 사용)
        mockPrismaService.iAPReceipt.upsert.mockResolvedValue({
          ...mockReceipt,
          status: 'FAILED',
        });

        const result = await service.verifyAndProcessPurchase(mockUserId, mockDto);

        expect(result.success).toBe(false);
        expect(result.message).toContain('유효하지 않습니다');
      });
    });

    describe('Google 영수증 검증', () => {
      const googleDto = {
        ...mockDto,
        platform: IAPPlatformType.GOOGLE,
        productId: 'challenge_ticket_1',
        transactionId: 'order-123',
      };

      beforeEach(() => {
        mockPrismaService.iAPProduct.findUnique.mockResolvedValue({
          ...mockIapProduct,
          googleProductId: 'challenge_ticket_1',
        });
      });

      it('Google 영수증 검증 성공 시 Acknowledge 호출', async () => {
        // Google 검증 성공
        mockGoogleIapService.verifyReceipt.mockResolvedValue({
          isValid: true,
          orderId: 'order-123',
          purchaseTime: new Date(),
          rawResponse: { purchaseState: 0 },
        });
        mockGoogleIapService.acknowledgePurchase.mockResolvedValue(true);
        // 트랜잭션 내부 Mock
        mockTxClient.iAPReceipt.findUnique.mockResolvedValue(null); // 중복 없음
        mockTxClient.iAPReceipt.upsert.mockResolvedValue(mockReceipt);
        mockTxClient.product.findUnique.mockResolvedValue({ id: 10, price: 9900 });
        mockTxClient.challengeTicket.create.mockResolvedValue(mockTicket);
        mockTxClient.iAPReceipt.update.mockResolvedValue(mockReceipt);
        // Acknowledge 성공 후 업데이트 (트랜잭션 외부)
        mockPrismaService.iAPReceipt.update.mockResolvedValue(mockReceipt);

        const result = await service.verifyAndProcessPurchase(mockUserId, googleDto);

        expect(result.success).toBe(true);
        expect(mockGoogleIapService.acknowledgePurchase).toHaveBeenCalledWith(
          googleDto.productId,
          googleDto.receiptData,
        );
      });

      it('Google 영수증 검증 실패 시 Acknowledge 호출 안함', async () => {
        mockGoogleIapService.verifyReceipt.mockResolvedValue({
          isValid: false,
          error: 'INVALID_PURCHASE_STATE',
          message: '구매 상태가 유효하지 않습니다.',
        });
        // 검증 실패 시 트랜잭션 없이 저장
        mockPrismaService.iAPReceipt.upsert.mockResolvedValue({
          ...mockReceipt,
          status: 'FAILED',
        });

        const result = await service.verifyAndProcessPurchase(mockUserId, googleDto);

        expect(result.success).toBe(false);
        expect(mockGoogleIapService.acknowledgePurchase).not.toHaveBeenCalled();
      });
    });
  });

  describe('getUserPurchases', () => {
    it('사용자의 구매 내역 조회', async () => {
      const mockPurchases = [
        { id: 1, userId: 1, transactionId: 'tx-1' },
        { id: 2, userId: 1, transactionId: 'tx-2' },
      ];
      mockPrismaService.iAPReceipt.findMany.mockResolvedValue(mockPurchases);

      const result = await service.getUserPurchases(1);

      expect(result).toEqual(mockPurchases);
      expect(mockPrismaService.iAPReceipt.findMany).toHaveBeenCalledWith({
        where: { userId: 1 },
        include: {
          iapProduct: { include: { product: true } },
          challengeTicket: true,
        },
        orderBy: { createdAt: 'desc' },
      });
    });
  });

  describe('getIapProducts', () => {
    it('활성화된 IAP 상품 목록 조회', async () => {
      const mockProducts = [
        { id: 1, name: '티켓 1개', isActive: true },
        { id: 2, name: '티켓 5개', isActive: true },
      ];
      mockPrismaService.iAPProduct.findMany.mockResolvedValue(mockProducts);

      const result = await service.getIapProducts();

      expect(result).toEqual(mockProducts);
      expect(mockPrismaService.iAPProduct.findMany).toHaveBeenCalledWith({
        where: { isActive: true },
        include: { product: true },
        orderBy: { createdAt: 'desc' },
      });
    });
  });
});
