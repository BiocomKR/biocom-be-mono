import {
  Controller,
  Post,
  Get,
  Body,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PushNotificationService } from './services/push-notification.service';
import { SendPushToUserDto } from './dto/send-push-to-user.dto';
import { SendPushToUsersDto } from './dto/send-push-to-users.dto';
import { SendPushToAllDto } from './dto/send-push-to-all.dto';
import { PushLogQueryDto } from './dto/push-log-query.dto';
import { PushLogListResponseDto } from './dto/push-log-response.dto';

/**
 * 푸시 알림 관리 컨트롤러
 * 백오피스 전용 푸시 알림 전송 및 조회 API
 */
@ApiTags('푸시 알림')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@SkipThrottle()
@Controller('push')
export class PushNotificationController {
  constructor(
    private readonly pushNotificationService: PushNotificationService,
  ) {}

  /**
   * 특정 유저에게 푸시 전송 (관리자 전용)
   */
  @Post('send-to-user')
  async sendToUser(@Body() dto: SendPushToUserDto) {
    const result = await this.pushNotificationService.sendToUser(
      dto.userId,
      {
        title: dto.title,
        body: dto.body,
        imageUrl: dto.imageUrl,
        data: dto.data,
      },
      dto.isTest ?? false,
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
   * 여러 유저에게 푸시 전송 (관리자 전용)
   */
  @Post('send-to-users')
  async sendToUsers(@Body() dto: SendPushToUsersDto) {
    const result = await this.pushNotificationService.sendToUsers(
      dto.userIds,
      {
        title: dto.title,
        body: dto.body,
        imageUrl: dto.imageUrl,
        data: dto.data,
      },
      dto.isTest ?? false,
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
   */
  @Post('send-to-all')
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
      dto.isTest ?? false,
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
   */
  @Get('logs')
  async getPushLogs(@Query() query: PushLogQueryDto): Promise<PushLogListResponseDto> {
    return await this.pushNotificationService.getPushLogs(query);
  }

  /**
   * 푸시 통계 조회 (관리자 전용)
   */
  @Get('stats')
  async getPushStats(
    @Query('startDate') startDate?: string,
    @Query('endDate') endDate?: string,
    @Query('isTest') isTest?: boolean,
  ) {
    return await this.pushNotificationService.getPushStats(startDate, endDate, isTest);
  }
}
