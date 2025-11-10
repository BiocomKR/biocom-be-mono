import {
  Controller,
  Post,
  Get,
  Patch,
  Delete,
  Body,
  Param,
  ParseIntPipe,
  UseGuards,
  Request,
  Logger,
  HttpCode,
  HttpStatus,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { SubscriptionService } from '../services/subscription.service';
import { RegisterBillingDto } from '../dto/subscription/register-billing.dto';
import { CreateSubscriptionDto } from '../dto/subscription/create-subscription.dto';

/**
 * 구독 관리 컨트롤러
 *
 * 역할:
 * - 빌링키 등록/삭제
 * - 구독 생성/조회/취소
 * - 자동결제 관리
 */
@ApiTags('Subscription')
@Controller('shop/subscription')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class SubscriptionController {
  private readonly logger = new Logger(SubscriptionController.name);

  constructor(private readonly subscriptionService: SubscriptionService) {}

  /**
   * 빌링키 등록
   *
   * @description
   * 토스페이먼츠에서 발급받은 빌링키를 백엔드에 등록
   * 이후 자동결제에 사용됨
   *
   * @param req - 사용자 정보
   * @param registerBillingDto - 빌링키 정보
   */
  @Post('billing')
  @ApiOperation({
    summary: '빌링키 등록',
    description: '토스페이먼츠 빌링키를 사용자 계정에 등록합니다',
  })
  @ApiResponse({ status: 201, description: '빌링키 등록 성공' })
  async registerBilling(
    @Request() req,
    @Body() registerBillingDto: RegisterBillingDto,
  ) {
    const userId = req.user.id;
    this.logger.log(
      `빌링키 등록 요청: userId=${userId}, billingKey=${registerBillingDto.billingKey}`,
    );

    return this.subscriptionService.registerBilling(userId, registerBillingDto);
  }

  /**
   * 빌링키 삭제
   *
   * @description
   * 사용자의 빌링키를 삭제하고 모든 활성 구독을 중지
   *
   * @param req - 사용자 정보
   */
  @Delete('billing')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '빌링키 삭제',
    description: '빌링키를 삭제하고 모든 구독을 중지합니다',
  })
  @ApiResponse({ status: 200, description: '빌링키 삭제 성공' })
  async deleteBilling(@Request() req) {
    const userId = req.user.id;
    this.logger.log(`빌링키 삭제 요청: userId=${userId}`);

    return this.subscriptionService.deleteBilling(userId);
  }

  /**
   * 구독 생성
   *
   * @description
   * 구독 상품을 구매하고 자동결제 등록
   * 빌링키가 미리 등록되어 있어야 함
   *
   * @param req - 사용자 정보
   * @param createSubscriptionDto - 구독 정보
   */
  @Post()
  @ApiOperation({
    summary: '구독 생성',
    description: '구독 상품을 구매하고 자동결제를 시작합니다',
  })
  @ApiResponse({ status: 201, description: '구독 생성 성공' })
  async createSubscription(
    @Request() req,
    @Body() createSubscriptionDto: CreateSubscriptionDto,
  ) {
    const userId = req.user.id;
    this.logger.log(
      `구독 생성 요청: userId=${userId}, productId=${createSubscriptionDto.productId}`,
    );

    return this.subscriptionService.createSubscription(
      userId,
      createSubscriptionDto,
    );
  }

  /**
   * 내 구독 목록 조회
   *
   * @description
   * 사용자의 모든 구독 내역 조회 (활성/중지/취소 모두 포함)
   *
   * @param req - 사용자 정보
   */
  @Get()
  @ApiOperation({
    summary: '내 구독 목록 조회',
    description: '사용자의 모든 구독 내역을 조회합니다',
  })
  @ApiResponse({ status: 200, description: '구독 목록 조회 성공' })
  async getMySubscriptions(@Request() req) {
    const userId = req.user.id;
    this.logger.log(`구독 목록 조회 요청: userId=${userId}`);

    return this.subscriptionService.getMySubscriptions(userId);
  }

  /**
   * 구독 상세 조회
   *
   * @param req - 사용자 정보
   * @param subscriptionId - 구독 ID
   */
  @Get(':subscriptionId')
  @ApiOperation({
    summary: '구독 상세 조회',
    description: '특정 구독의 상세 정보를 조회합니다',
  })
  @ApiResponse({ status: 200, description: '구독 상세 조회 성공' })
  async getSubscription(
    @Request() req,
    @Param('subscriptionId', ParseIntPipe) subscriptionId: number,
  ) {
    const userId = req.user.id;
    this.logger.log(
      `구독 상세 조회 요청: userId=${userId}, subscriptionId=${subscriptionId}`,
    );

    return this.subscriptionService.getSubscription(userId, subscriptionId);
  }

  /**
   * 구독 취소
   *
   * @description
   * 구독을 취소 상태로 변경 (환불 없음, expiresAt까지 유효)
   * CANCELED 상태가 되면 다음 자동결제는 진행되지 않음
   *
   * @param req - 사용자 정보
   * @param subscriptionId - 구독 ID
   */
  @Delete(':subscriptionId')
  @HttpCode(HttpStatus.OK)
  @ApiOperation({
    summary: '구독 취소',
    description: '구독을 취소합니다 (환불 없음, 만료일까지 유효)',
  })
  @ApiResponse({ status: 200, description: '구독 취소 성공' })
  async cancelSubscription(
    @Request() req,
    @Param('subscriptionId', ParseIntPipe) subscriptionId: number,
  ) {
    const userId = req.user.id;
    this.logger.log(
      `구독 취소 요청: userId=${userId}, subscriptionId=${subscriptionId}`,
    );

    return this.subscriptionService.cancelSubscription(userId, subscriptionId);
  }
}
