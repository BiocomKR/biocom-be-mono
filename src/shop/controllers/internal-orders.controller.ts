import {
  Controller,
  Post,
  Param,
  ParseIntPipe,
  UseGuards,
  Logger,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiHeader, ApiParam } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { InternalApiGuard } from '../../common/guards/internal-api.guard';
import { OrderSyncService, OrderSyncResult } from '../services/order-sync.service';
import { ShippingSyncSchedulerService } from '../../playauto/services/shipping-sync-scheduler.service';

/**
 * 내부 API - 주문 관리
 *
 * biocom-bo-api 등 내부 서버에서 호출하는 API
 * x-internal-api-key 헤더로 인증
 */
@Controller('internal/orders')
@UseGuards(InternalApiGuard)
@SkipThrottle()
@ApiTags('내부 API - 주문')
@ApiHeader({ name: 'x-internal-api-key', required: true, description: '내부 API 키' })
export class InternalOrdersController {
  private readonly logger = new Logger(InternalOrdersController.name);

  constructor(
    private readonly orderSyncService: OrderSyncService,
    private readonly shippingSyncSchedulerService: ShippingSyncSchedulerService,
  ) {}

  /**
   * 플레이오토 주문 상태 동기화
   *
   * 플레이오토에서 주문 정보를 조회하여 DB에 동기화
   */
  @Post(':orderId/sync-playauto')
  @ApiOperation({
    summary: '플레이오토 주문 상태 동기화',
    description: '플레이오토에서 주문 상태/송장 정보를 조회하여 DB에 동기화합니다.',
  })
  @ApiParam({ name: 'orderId', description: '주문 ID', type: Number })
  @ApiResponse({
    status: 200,
    description: '동기화 결과',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        data: {
          type: 'object',
          properties: {
            result: { type: 'string', enum: ['updated', 'skipped', 'failed', 'not_registered'] },
            trackingNumber: { type: 'string', nullable: true },
            carrier: { type: 'string', nullable: true },
            playautoStatus: { type: 'string', nullable: true },
          },
        },
        message: { type: 'string' },
      },
    },
  })
  async syncFromPlayauto(
    @Param('orderId', ParseIntPipe) orderId: number,
  ): Promise<{ success: boolean; data: OrderSyncResult; message: string }> {
    this.logger.log(`플레이오토 동기화 요청: orderId=${orderId}`);

    const result = await this.orderSyncService.syncFromPlayauto(orderId);

    const messages: Record<string, string> = {
      updated: '동기화 완료',
      skipped: '변경사항 없음',
      failed: '동기화 실패',
      not_registered: '플레이오토 미등록 주문',
    };

    return {
      success: result.result !== 'failed',
      data: result,
      message: messages[result.result] || '알 수 없는 결과',
    };
  }

  /**
   * 플레이오토 전체 주문 동기화 (배치 트리거)
   *
   * 플레이오토에서 전체 주문 정보를 조회하여 DB에 동기화
   * 배치와 동일한 로직 사용
   */
  @Post('sync-all')
  @ApiOperation({
    summary: '플레이오토 전체 주문 동기화',
    description: '플레이오토에서 모든 주문의 상태/송장 정보를 조회하여 DB에 동기화합니다. 배치 작업을 수동으로 트리거합니다.',
  })
  @ApiResponse({
    status: 200,
    description: '동기화 트리거 결과',
    schema: {
      type: 'object',
      properties: {
        success: { type: 'boolean' },
        message: { type: 'string' },
        data: {
          type: 'object',
          properties: {
            triggered: { type: 'boolean' },
          },
        },
      },
    },
  })
  async syncAllFromPlayauto(): Promise<{ success: boolean; message: string; data: { triggered: boolean } }> {
    this.logger.log('플레이오토 전체 동기화 배치 트리거 요청');

    try {
      // 배치 로직 실행 (비동기로 처리하고 즉시 응답)
      this.shippingSyncSchedulerService.handleShippingSync().catch((error) => {
        this.logger.error(`플레이오토 전체 동기화 실패: ${error.message}`);
      });

      return {
        success: true,
        message: '플레이오토 동기화 배치가 시작되었습니다.',
        data: { triggered: true },
      };
    } catch (error: any) {
      this.logger.error(`플레이오토 전체 동기화 트리거 실패: ${error.message}`);
      return {
        success: false,
        message: `동기화 트리거 실패: ${error.message}`,
        data: { triggered: false },
      };
    }
  }
}
