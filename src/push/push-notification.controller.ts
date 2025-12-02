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
import { PushTemplateService } from './services/push-template.service';
import { PrismaService } from '../common/services/prisma.service';
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
    private readonly templateService: PushTemplateService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 특정 유저에게 푸시 전송 (관리자 전용)
   * 템플릿 변수 {{userName}}, {{mobile}} 등 사용 가능
   */
  @Post('send-to-user')
  async sendToUser(@Body() dto: SendPushToUserDto) {
    // 템플릿 치환
    const titles = await this.templateService.substituteForUsers(dto.title, [dto.userId]);
    const bodies = await this.templateService.substituteForUsers(dto.body, [dto.userId]);
    const title = titles.get(dto.userId) || dto.title;
    const body = bodies.get(dto.userId) || dto.body;

    const result = await this.pushNotificationService.sendToUser(
      dto.userId,
      {
        title,
        body,
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
   * 템플릿 변수 {{userName}}, {{mobile}} 등 사용 가능
   */
  @Post('send-to-users')
  async sendToUsers(@Body() dto: SendPushToUsersDto) {
    // 템플릿 치환
    const titles = await this.templateService.substituteForUsers(dto.title, dto.userIds);
    const bodies = await this.templateService.substituteForUsers(dto.body, dto.userIds);

    // 개별 발송 (치환된 메시지 사용)
    let sentCount = 0;
    let failureCount = 0;

    for (const userId of dto.userIds) {
      const title = titles.get(userId) || dto.title;
      const body = bodies.get(userId) || dto.body;

      const result = await this.pushNotificationService.sendToUser(
        userId,
        {
          title,
          body,
          imageUrl: dto.imageUrl,
          data: dto.data,
        },
        dto.isTest ?? false,
      );

      if (result.success) {
        sentCount += result.sentCount;
      } else {
        failureCount++;
      }
    }

    return {
      success: sentCount > 0,
      message: `${sentCount}개 기기에 전송 성공`,
      data: {
        sentCount,
        failureCount,
      },
    };
  }

  /**
   * 전체 유저에게 푸시 전송 (관리자 전용)
   * 템플릿 변수 {{userName}}, {{mobile}} 등 사용 가능
   */
  @Post('send-to-all')
  async sendToAll(@Body() dto: SendPushToAllDto) {
    // 템플릿 변수 사용 여부 확인
    const hasTemplateVars = /\{\{[a-zA-Z_][a-zA-Z0-9_]*\}\}/.test(dto.title + dto.body);

    if (!hasTemplateVars) {
      // 템플릿 변수가 없으면 기존 방식 (일괄 발송)
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

    // 템플릿 변수가 있으면 개별 치환 후 발송
    // 1. 대상 유저 조회
    const pushTokens = await this.prisma.pushToken.findMany({
      where: {
        isActive: true,
        ...(dto.marketingOnly && { isMarketingAllowed: true }),
      },
      select: { userId: true },
      distinct: ['userId'],
    });

    const userIds = pushTokens.map((t) => t.userId).filter((id): id is number => id !== null);

    if (userIds.length === 0) {
      return {
        success: false,
        message: '전송 대상이 없습니다',
        data: { sentCount: 0, failureCount: 0 },
      };
    }

    // 2. 템플릿 치환
    const titles = await this.templateService.substituteForUsers(dto.title, userIds);
    const bodies = await this.templateService.substituteForUsers(dto.body, userIds);

    // 3. 개별 발송
    let sentCount = 0;
    let failureCount = 0;

    for (const userId of userIds) {
      const title = titles.get(userId) || dto.title;
      const body = bodies.get(userId) || dto.body;

      const result = await this.pushNotificationService.sendToUser(
        userId,
        {
          title,
          body,
          imageUrl: dto.imageUrl,
          data: dto.data,
        },
        dto.isTest ?? false,
      );

      if (result.success) {
        sentCount += result.sentCount;
      } else {
        failureCount++;
      }
    }

    return {
      success: sentCount > 0,
      message: `${sentCount}개 기기에 전송 성공`,
      data: {
        sentCount,
        failureCount,
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
