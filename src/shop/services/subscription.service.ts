import {
  Injectable,
  Logger,
  BadRequestException,
  NotFoundException,
  ForbiddenException,
} from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { TossPaymentsService } from './toss-payments.service';
import { RegisterBillingDto } from '../dto/subscription/register-billing.dto';
import { CreateSubscriptionDto } from '../dto/subscription/create-subscription.dto';
import { SubscriptionStatus } from '../../common/enums';
import { getNowKST } from '../../common/utils/kst-date.util';

/**
 * 구독 관리 서비스
 *
 * 역할:
 * - 빌링키 등록/삭제
 * - 구독 생성/조회/취소/일시정지/재개
 * - 자동결제 처리
 */
@Injectable()
export class SubscriptionService {
  private readonly logger = new Logger(SubscriptionService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly tossPaymentsService: TossPaymentsService,
  ) {}

  /**
   * 빌링키 등록
   *
   * @param userId - 사용자 ID
   * @param registerBillingDto - authKey와 customerKey
   */
  async registerBilling(userId: number, registerBillingDto: RegisterBillingDto) {
    const { authKey, customerKey } = registerBillingDto;

    this.logger.log(
      `빌링키 등록: userId=${userId}, authKey=${authKey}`,
    );

    // 사용자 조회
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다');
    }

    // 이미 빌링키가 등록되어 있으면 에러
    if (user.billingKey) {
      this.logger.warn(
        `빌링키 중복 등록 시도: userId=${userId}, existingBillingKey=${user.billingKey}`,
      );
      throw new BadRequestException('이미 등록된 카드가 있습니다. 카드를 변경하려면 먼저 삭제해주세요.');
    }

    // 토스 API를 호출하여 billingKey 발급
    const billingKey = await this.tossPaymentsService.issueBillingKey(
      authKey,
      customerKey,
    );

    this.logger.log(`토스로부터 빌링키 발급 성공: billingKey=${billingKey}`);

    // 빌링키 저장
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        billingKey: billingKey,
        customerKey: customerKey,
        updatedAt: getNowKST(),
      },
    });

    this.logger.log(`✅ 빌링키 등록 완료: userId=${userId}`);

    return {
      success: true,
      message: '빌링키가 등록되었습니다',
    };
  }

  /**
   * 빌링키 삭제
   *
   * @param userId - 사용자 ID
   */
  async deleteBilling(userId: number) {
    this.logger.log(`빌링키 삭제: userId=${userId}`);

    await this.prisma.$transaction(async (tx) => {
      // 사용자 조회
      const user = await tx.user.findUnique({
        where: { id: userId },
      });

      if (!user || !user.billingKey) {
        throw new BadRequestException('등록된 빌링키가 없습니다');
      }

      // 활성 구독 중지
      const updateResult = await tx.subscription.updateMany({
        where: {
          userId: userId,
          status: SubscriptionStatus.ACTIVE,
        },
        data: {
          status: SubscriptionStatus.CANCELLED,
          endDate: getNowKST(),
          updatedAt: getNowKST(),
        },
      });

      this.logger.log(`${updateResult.count}건의 구독이 취소되었습니다`);

      // 빌링키 삭제
      await tx.user.update({
        where: { id: userId },
        data: {
          billingKey: null,
          customerKey: null,
          updatedAt: getNowKST(),
        },
      });
    });

    this.logger.log(`✅ 빌링키 삭제 완료: userId=${userId}`);

    return {
      success: true,
      message: '빌링키가 삭제되고 모든 구독이 취소되었습니다',
    };
  }

  /**
   * 구독 생성
   *
   * @param userId - 사용자 ID
   * @param createSubscriptionDto - 구독 정보
   */
  async createSubscription(
    userId: number,
    createSubscriptionDto: CreateSubscriptionDto,
  ) {
    const { productId, billingCycle = 30 } = createSubscriptionDto;

    this.logger.log(
      `구독 생성: userId=${userId}, productId=${productId}, billingCycle=${billingCycle}일`,
    );

    // 사용자 조회 (빌링키 확인)
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user) {
      throw new NotFoundException('사용자를 찾을 수 없습니다');
    }

    if (!user.billingKey) {
      throw new BadRequestException(
        '빌링키가 등록되지 않았습니다. 먼저 결제 수단을 등록해주세요',
      );
    }

    // 상품 조회
    const product = await this.prisma.product.findUnique({
      where: { id: productId },
    });

    if (!product) {
      throw new NotFoundException('상품을 찾을 수 없습니다');
    }

    if (!product.price) {
      throw new BadRequestException('상품 가격이 설정되지 않았습니다');
    }

    const price = Number(product.price);

    // 중복 구독 확인
    const existingSubscription = await this.prisma.subscription.findFirst({
      where: {
        userId: userId,
        productId: productId,
        status: SubscriptionStatus.ACTIVE,
      },
    });

    if (existingSubscription) {
      throw new BadRequestException('이미 구독 중인 상품입니다');
    }

    // 첫 결제 실행 (토스페이먼츠 빌링키 자동결제)
    this.logger.log(`첫 결제 실행: amount=${price}원`);

    const paymentResult = await this.tossPaymentsService.chargeWithBillingKey(
      user.billingKey,
      user.customerKey,
      price,
      `${product.name} 구독 - 첫 결제`,
    );

    this.logger.log(`첫 결제 성공: paymentKey=${paymentResult.paymentKey}`);

    // 구독 생성
    const startDate = getNowKST();
    const nextBillingDate = new Date(startDate.getTime());
    nextBillingDate.setDate(nextBillingDate.getDate() + billingCycle);

    const subscription = await this.prisma.subscription.create({
      data: {
        userId: userId,
        productId: productId,
        billingKey: user.billingKey,
        customerKey: user.customerKey,
        status: SubscriptionStatus.ACTIVE,
        startDate: startDate,
        nextBillingDate: nextBillingDate,
        billingCycle: billingCycle,
        price: price,
      },
      include: {
        product: true,
      },
    });

    this.logger.log(`✅ 구독 생성 완료: subscriptionId=${subscription.id}`);

    return {
      success: true,
      data: subscription,
    };
  }

  /**
   * 내 구독 목록 조회
   *
   * @param userId - 사용자 ID
   * @returns 구독 목록 + 빌링키 등록 여부
   */
  async getMySubscriptions(userId: number) {
    // 빌링키 등록 여부 확인
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { billingKey: true },
    });

    // 구독 목록 조회
    const subscriptions = await this.prisma.subscription.findMany({
      where: { userId: userId },
      include: {
        product: {
          select: {
            id: true,
            name: true,
            description: true,
            price: true,
            images: true,
          },
        },
      },
      orderBy: {
        createdAt: 'desc',
      },
    });

    return {
      success: true,
      hasBillingKey: !!user?.billingKey,
      data: subscriptions,
    };
  }

  /**
   * 구독 상세 조회
   *
   * @param userId - 사용자 ID
   * @param subscriptionId - 구독 ID
   */
  async getSubscription(userId: number, subscriptionId: number) {
    const subscription = await this.prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        userId: userId,
      },
      include: {
        product: true,
      },
    });

    if (!subscription) {
      throw new NotFoundException('구독을 찾을 수 없습니다');
    }

    return {
      success: true,
      data: subscription,
    };
  }

  /**
   * 구독 취소
   *
   * @description
   * - 환불 없음
   * - expiresAt(nextBillingDate)까지 유효
   * - CANCELED 상태로 변경하여 다음 자동결제 방지
   *
   * @param userId - 사용자 ID
   * @param subscriptionId - 구독 ID
   */
  async cancelSubscription(userId: number, subscriptionId: number) {
    this.logger.log(
      `구독 취소: userId=${userId}, subscriptionId=${subscriptionId}`,
    );

    const subscription = await this.prisma.subscription.findFirst({
      where: {
        id: subscriptionId,
        userId: userId,
      },
    });

    if (!subscription) {
      throw new NotFoundException('구독을 찾을 수 없습니다');
    }

    if (subscription.status === SubscriptionStatus.CANCELED) {
      throw new BadRequestException('이미 취소된 구독입니다');
    }

    // 구독 취소 (환불 없음, nextBillingDate까지 유효)
    await this.prisma.subscription.update({
      where: { id: subscriptionId },
      data: {
        status: SubscriptionStatus.CANCELED,
        updatedAt: getNowKST(),
      },
    });

    this.logger.log(`✅ 구독 취소 완료: subscriptionId=${subscriptionId}, nextBillingDate까지 유효`);

    return {
      success: true,
      message: '구독이 취소되었습니다. 현재 결제 기간 종료일까지 이용 가능합니다.',
    };
  }

  /**
   * 자동결제 실행 (Cron Job에서 호출)
   *
   * @param subscriptionId - 구독 ID
   */
  async processAutoBilling(subscriptionId: number) {
    this.logger.log(`자동결제 처리 시작: subscriptionId=${subscriptionId}`);

    const subscription = await this.prisma.subscription.findUnique({
      where: { id: subscriptionId },
      include: {
        user: true,
        product: true,
      },
    });

    if (!subscription) {
      this.logger.error(`구독을 찾을 수 없음: subscriptionId=${subscriptionId}`);
      return;
    }

    try {
      // 토스페이먼츠 빌링키로 자동결제
      const paymentResult =
        await this.tossPaymentsService.chargeWithBillingKey(
          subscription.billingKey,
          subscription.customerKey,
          subscription.price,
          `${subscription.product.name} 구독 - ${getNowKST().toISOString().split('T')[0]} 결제`,
        );

      this.logger.log(
        `자동결제 성공: paymentKey=${paymentResult.paymentKey}`,
      );

      // 다음 결제일 업데이트
      const nextBillingDate = new Date(subscription.nextBillingDate);
      nextBillingDate.setDate(
        nextBillingDate.getDate() + subscription.billingCycle,
      );

      await this.prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          nextBillingDate: nextBillingDate,
          updatedAt: getNowKST(),
        },
      });

      this.logger.log(
        `✅ 자동결제 완료: subscriptionId=${subscriptionId}, 다음결제일=${nextBillingDate.toISOString()}`,
      );
    } catch (error: any) {
      this.logger.error(
        `자동결제 실패: subscriptionId=${subscriptionId}, error=${error.message}`,
      );

      // 구독 상태를 PAYMENT_FAILED로 변경
      await this.prisma.subscription.update({
        where: { id: subscriptionId },
        data: {
          status: SubscriptionStatus.PAYMENT_FAILED,
          updatedAt: getNowKST(),
        },
      });

      // TODO: 사용자에게 결제 실패 알림 발송
      this.logger.warn(
        `📧 TODO: 사용자에게 자동결제 실패 알림 발송 - ${subscription.user.email}`,
      );
    }
  }
}
