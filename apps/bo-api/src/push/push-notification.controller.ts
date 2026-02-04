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
import { ConditionEvaluatorService } from './services/condition-evaluator.service';
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
    private readonly conditionEvaluator: ConditionEvaluatorService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * 특정 유저에게 푸시 전송 (관리자 전용)
   * 템플릿 변수 {{userName}}, {{mobile}} 등 사용 가능
   * MQ에 발송 요청을 추가하고 jobId를 반환 (비동기 처리)
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
      message: '푸시 발송 요청이 접수되었습니다',
      data: {
        jobId: result.jobId,
      },
    };
  }

  /**
   * 여러 유저에게 푸시 전송 (관리자 전용)
   * 템플릿 변수 {{userName}}, {{mobile}} 등 사용 가능
   * MQ에 발송 요청을 추가하고 jobIds를 반환 (비동기 처리)
   */
  @Post('send-to-users')
  async sendToUsers(@Body() dto: SendPushToUsersDto) {
    // conditionType이 있으면 해당 스케줄에서 pushCode, type 조회
    // 테스트 발송은 비활성화된 스케줄도 테스트할 수 있어야 하므로 isActive 조건 제거
    let schedule: { pushCode: string | null; type: string } | null = null;
    if (dto.conditionType) {
      schedule = await this.prisma.pushNotificationSchedule.findFirst({
        where: {
          conditionType: dto.conditionType,
        },
        select: {
          pushCode: true,
          type: true,
        },
      });
    }

    // 템플릿 치환
    const titles = await this.templateService.substituteForUsers(dto.title, dto.userIds);
    const bodies = await this.templateService.substituteForUsers(dto.body, dto.userIds);

    // 개별 발송 (치환된 메시지 사용)
    const jobIds: string[] = [];

    for (const userId of dto.userIds) {
      const title = titles.get(userId) || dto.title;
      const body = bodies.get(userId) || dto.body;

      const result = await this.pushNotificationService.sendToUser(
        userId,
        {
          title,
          body,
          imageUrl: dto.imageUrl,
          data: {
            ...dto.data,
            ...(schedule && { pushCode: schedule.pushCode, type: schedule.type }),
          },
        },
        dto.isTest ?? false,
      );

      if (result.jobId) {
        jobIds.push(result.jobId);
      }
    }

    return {
      success: true,
      message: `${dto.userIds.length}명에게 푸시 발송 요청이 접수되었습니다`,
      data: {
        targetCount: dto.userIds.length,
        jobIds,
      },
    };
  }

  /**
   * 전체 유저에게 푸시 전송 (관리자 전용)
   * 템플릿 변수 {{userName}}, {{mobile}} 등 사용 가능
   * MQ에 발송 요청을 추가하고 jobId를 반환 (비동기 처리)
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
        message: '전체 푸시 발송 요청이 접수되었습니다',
        data: {
          jobId: result.jobId,
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

    const userIds = pushTokens.map((t: { userId: number | null }) => t.userId).filter((id): id is number => id !== null);

    if (userIds.length === 0) {
      return {
        success: false,
        message: '전송 대상이 없습니다',
        data: { targetCount: 0 },
      };
    }

    // 2. 템플릿 치환
    const titles = await this.templateService.substituteForUsers(dto.title, userIds);
    const bodies = await this.templateService.substituteForUsers(dto.body, userIds);

    // 3. 개별 발송 (MQ에 요청 추가)
    const jobIds: string[] = [];

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

      if (result.jobId) {
        jobIds.push(result.jobId);
      }
    }

    return {
      success: true,
      message: `${userIds.length}명에게 푸시 발송 요청이 접수되었습니다`,
      data: {
        targetCount: userIds.length,
        jobIds,
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
    @Query('bundleId') bundleId?: string,
  ) {
    return await this.pushNotificationService.getPushStats(startDate, endDate, isTest, bundleId);
  }

  /**
   * 다중 조건 미리보기 (AND 조합) - 대상 유저 수 조회 (발송 없이)
   * 프론트엔드에서 conditions 배열로 전송
   */
  @Post('condition/preview')
  async previewConditions(
    @Body() dto: {
      conditions: Array<{ type: string; params: Record<string, any> }>;
    },
  ) {
    // 밸리데이션: conditions가 없거나 빈 배열인 경우
    if (!dto.conditions || dto.conditions.length === 0) {
      return {
        success: false,
        message: '최소 하나의 조건이 필요합니다',
        data: null,
      };
    }

    // 밸리데이션: 각 조건에 type이 있는지 확인
    for (let i = 0; i < dto.conditions.length; i++) {
      const condition = dto.conditions[i];
      if (!condition.type) {
        return {
          success: false,
          message: `조건 ${i + 1}: 조건 타입이 선택되지 않았습니다`,
          data: null,
        };
      }
    }

    try {
      const result = await this.conditionEvaluator.previewConditions(dto.conditions);

      return {
        success: true,
        data: result,
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '조건 평가 중 오류가 발생했습니다',
        data: null,
      };
    }
  }

  /**
   * 조건 기반 테스터 발송 - isTester=true인 유저에게만 푸시 발송 (다중 조건 AND 조합)
   * MQ에 발송 요청을 추가하고 jobIds를 반환 (비동기 처리)
   */
  @Post('condition/send-to-testers')
  async sendToTesters(
    @Body() dto: {
      conditions: Array<{ type: string; params: Record<string, any> }>;
      title: string;
      body: string;
      imageUrl?: string;
      data?: Record<string, any>;
      pushCode?: string;
      pushType?: string;
    },
  ) {
    // 밸리데이션: conditions가 없거나 빈 배열인 경우
    if (!dto.conditions || dto.conditions.length === 0) {
      return {
        success: false,
        message: '최소 하나의 조건이 필요합니다',
        data: { targetCount: 0, jobIds: [] },
      };
    }

    // 밸리데이션: 각 조건에 type이 있는지 확인
    for (let i = 0; i < dto.conditions.length; i++) {
      const condition = dto.conditions[i];
      if (!condition.type) {
        return {
          success: false,
          message: `조건 ${i + 1}: 조건 타입이 선택되지 않았습니다`,
          data: { targetCount: 0, jobIds: [] },
        };
      }
    }

    try {
      // 조건에 맞는 테스터만 조회 (AND 조합)
      const testerIds = await this.conditionEvaluator.evaluateConditionsTestersOnly(dto.conditions);

      if (testerIds.length === 0) {
        return {
          success: false,
          message: '조건에 맞는 테스터가 없습니다',
          data: { targetCount: 0, jobIds: [] },
        };
      }

      // 템플릿 치환
      const titles = await this.templateService.substituteForUsers(dto.title, testerIds);
      const bodies = await this.templateService.substituteForUsers(dto.body, testerIds);

      // 개별 발송 (MQ에 요청 추가)
      const jobIds: string[] = [];

      for (const userId of testerIds) {
        const title = titles.get(userId) || dto.title;
        const body = bodies.get(userId) || dto.body;

        const result = await this.pushNotificationService.sendToUser(
          userId,
          {
            title,
            body,
            imageUrl: dto.imageUrl,
            data: {
              ...dto.data,
              pushCode: dto.pushCode,
              type: dto.pushType,
            },
          },
          true, // isTest = true
        );

        if (result.jobId) {
          jobIds.push(result.jobId);
        }
      }

      return {
        success: true,
        message: `${testerIds.length}명의 테스터에게 푸시 발송 요청이 접수되었습니다`,
        data: {
          targetCount: testerIds.length,
          jobIds,
        },
      };
    } catch (error) {
      return {
        success: false,
        message: error.message || '테스터 발송 중 오류가 발생했습니다',
        data: { targetCount: 0, jobIds: [] },
      };
    }
  }
}
