import {
  Controller,
  Post,
  Get,
  Patch,
  Body,
  Query,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PushNotificationService } from '../services/push-notification.service';
import { SendPushDto } from '../dto/send-push.dto';
import { SendPushToUserDto } from '../dto/send-push-to-user.dto';
import { SendPushToUsersDto } from '../dto/send-push-to-users.dto';
import { SendPushToAllDto } from '../dto/send-push-to-all.dto';
import { PushLogQueryDto } from '../dto/push-log-query.dto';
import { PushLogListResponseDto } from '../dto/push-log-response.dto';
import { UpdatePushLogStatusDto } from '../dto/update-push-log-status.dto';
import { rateLimitConfig } from '../../common/config/throttler.config';

/**
 * 푸시 알림 전송 컨트롤러
 *
 * 푸시 알림 전송 API
 *
 * TODO: 푸시 알림 전송 UI 구현 필요
 * TODO: 관리자 권한 체크 추가 필요 (RolesGuard)
 */
@ApiTags('푸시-알림전송')
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
   * 특정 유저에게 푸시 전송 (관리자 전용)
   *
   * @param req - JWT 인증된 요청
   * @param dto - 푸시 메시지 + 대상 유저 ID
   * @returns 전송 결과
   */
  @Post('send-to-user')
  @Throttle({ short: { ttl: rateLimitConfig.pushBatch.ttl * 1000, limit: rateLimitConfig.pushBatch.limit } })
  @ApiOperation({
    summary: '특정 유저에게 푸시 전송 (관리자)',
    description: '지정한 유저의 모든 기기에 푸시를 전송합니다',
  })
  @ApiResponse({
    status: 201,
    description: '푸시 전송 성공',
  })
  async sendToUser(@Body() dto: SendPushToUserDto) {
    const result = await this.pushNotificationService.sendToUser(dto.userId, {
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
   * 여러 유저에게 푸시 전송 (관리자 전용)
   *
   * @param req - JWT 인증된 요청
   * @param dto - 푸시 메시지 + 대상 유저 ID 배열
   * @returns 전송 결과
   */
  @Post('send-to-users')
  @Throttle({ short: { ttl: rateLimitConfig.pushBatch.ttl * 1000, limit: rateLimitConfig.pushBatch.limit } })
  @ApiOperation({
    summary: '여러 유저에게 푸시 전송 (관리자)',
    description: '지정한 여러 유저에게 푸시를 전송합니다',
  })
  @ApiResponse({
    status: 201,
    description: '푸시 전송 성공',
  })
  async sendToUsers(@Body() dto: SendPushToUsersDto) {
    const result = await this.pushNotificationService.sendToUsers(
      dto.userIds,
      {
        title: dto.title,
        body: dto.body,
        imageUrl: dto.imageUrl,
        data: dto.data,
      },
    );

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
   * 전체 유저에게 푸시 전송 (관리자 전용)
   *
   * @param req - JWT 인증된 요청
   * @param dto - 푸시 메시지 + 필터
   * @returns 전송 결과
   */
  @Post('send-to-all')
  @Throttle({ short: { ttl: rateLimitConfig.pushBroadcast.ttl * 1000, limit: rateLimitConfig.pushBroadcast.limit } })
  @ApiOperation({
    summary: '전체 유저에게 푸시 전송 (관리자)',
    description: '모든 유저에게 푸시를 전송합니다 (공지사항 등)',
  })
  @ApiResponse({
    status: 201,
    description: '푸시 전송 성공',
  })
  async sendToAll(@Body() dto: SendPushToAllDto) {
    const result = await this.pushNotificationService.sendToAll(
      {
        title: dto.title,
        body: dto.body,
        imageUrl: dto.imageUrl,
        data: dto.data,
      },
      {
        marketingEnabled: dto.marketingOnly,
      },
    );

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
   * 푸시 로그 조회 (관리자 전용)
   *
   * @param query - 조회 조건 (페이지네이션, 필터)
   * @returns 푸시 로그 목록
   */
  @Get('logs')
  @ApiOperation({
    summary: '푸시 로그 조회 (관리자)',
    description: '푸시 알림 발송 로그를 조회합니다 (페이지네이션 지원)',
  })
  @ApiResponse({
    status: 200,
    description: '로그 조회 성공',
    type: PushLogListResponseDto,
  })
  async getPushLogs(@Query() query: PushLogQueryDto): Promise<PushLogListResponseDto> {
    return await this.pushNotificationService.getPushLogs(query);
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
