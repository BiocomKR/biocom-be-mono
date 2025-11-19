import {
  Controller,
  Post,
  Body,
  UseGuards,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../../auth/guards/jwt-auth.guard';
import { PushNotificationService } from '../services/push-notification.service';
import { SendPushDto } from '../dto/send-push.dto';
import { SendPushToUserDto } from '../dto/send-push-to-user.dto';
import { SendPushToUsersDto } from '../dto/send-push-to-users.dto';
import { SendPushToAllDto } from '../dto/send-push-to-all.dto';

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
}
