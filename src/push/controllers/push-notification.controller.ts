import {
  Controller,
  Post,
  Patch,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PushNotificationService } from '../services/push-notification.service';
import { SendPushDto } from '../dto/send-push.dto';
import { UpdatePushLogStatusDto } from '../dto/update-push-log-status.dto';
import { rateLimitConfig } from '../../common/config/throttler.config';

/**
 * 푸시 알림 유저 컨트롤러
 *
 * 일반 유저용 푸시 알림 API
 * - 테스트 푸시 전송
 * - 푸시 로그 상태 업데이트 (읽음/클릭)
 *
 * 관리자용 API는 PushNotificationAdminController 참고
 */
@ApiTags('푸시-유저')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('push/notifications')
export class PushNotificationController {
  constructor(
    private readonly pushNotificationService: PushNotificationService,
  ) {}

  /**
   * 자신에게 테스트 푸시 전송
   *
   * @param req - JWT 인증된 요청
   * @param dto - 푸시 메시지
   * @returns 전송 결과
   */
  @Post('test')
  @Throttle({ short: { ttl: rateLimitConfig.pushTest.ttl * 1000, limit: rateLimitConfig.pushTest.limit } })
  @ApiOperation({
    summary: '자신에게 테스트 푸시 전송',
    description: '현재 로그인한 유저의 모든 기기에 테스트 푸시를 전송합니다',
  })
  @ApiResponse({
    status: 201,
    description: '푸시 전송 성공',
  })
  async sendTestPush(@Req() req: any, @Body() dto: SendPushDto) {
    const userId = req.user.id;

    const result = await this.pushNotificationService.sendToUser(userId, {
      title: dto.title,
      body: dto.body,
      imageUrl: dto.imageUrl,
      data: dto.data,
    });

    return {
      success: result.success,
      message: result.message,
      data: {
        sentCount: result.sentCount,
        failureCount: result.failureCount,
      },
    };
  }

  /**
   * 푸시 로그 상태 업데이트 (readAt, clickedAt)
   *
   * @param req - JWT 인증된 요청
   * @param dto - 상태 업데이트 정보
   * @returns 업데이트 결과
   */
  @Patch('logs/status')
  @ApiOperation({
    summary: '푸시 로그 상태 업데이트 (사용자)',
    description: '푸시 알림을 읽거나 클릭했을 때 상태를 업데이트합니다',
  })
  @ApiResponse({
    status: 200,
    description: '상태 업데이트 성공',
  })
  async updatePushLogStatus(@Req() req: any, @Body() dto: UpdatePushLogStatusDto) {
    const userId = req.user.id;
    return await this.pushNotificationService.updatePushLogStatus(
      userId,
      dto.logId,
      dto.status,
    );
  }
}
