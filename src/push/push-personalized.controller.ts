import { Controller, Get, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { PushSegmentService } from './services/push-segment.service';
import { PushTemplateService } from './services/push-template.service';
import { PushNotificationService } from './services/push-notification.service';
import {
  SegmentPreviewDto,
  TemplatePreviewDto,
  SendPersonalizedPushDto,
} from './dto/personalized-push.dto';
import { OPERATORS } from './enums';

/**
 * 개인화 푸시 컨트롤러
 *
 * 세그먼트 + 템플릿 기반 개인화 푸시 발송 API
 */
@ApiTags('개인화 푸시')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@SkipThrottle()
@Controller('push/personalized')
export class PushPersonalizedController {
  constructor(
    private readonly segmentService: PushSegmentService,
    private readonly templateService: PushTemplateService,
    private readonly notificationService: PushNotificationService,
  ) {}

  /**
   * 사용 가능한 템플릿 변수 목록 조회
   */
  @Get('template-variables')
  @ApiOperation({ summary: '템플릿 변수 목록 조회' })
  @ApiResponse({ status: 200, description: '변수 목록' })
  async getTemplateVariables() {
    const variables = await this.templateService.getVariables();
    return {
      success: true,
      data: variables,
    };
  }

  /**
   * 사용 가능한 세그먼트 조건 목록 조회
   */
  @Get('segment-conditions')
  @ApiOperation({ summary: '세그먼트 조건 목록 조회' })
  @ApiResponse({ status: 200, description: '조건 목록 (연산자 정보 포함)' })
  async getSegmentConditions() {
    const conditions = await this.segmentService.getConditions();
    return {
      success: true,
      data: conditions,
    };
  }

  /**
   * 연산자 목록 조회
   */
  @Get('operators')
  @ApiOperation({ summary: '연산자 목록 조회' })
  @ApiResponse({ status: 200, description: '연산자 목록' })
  getOperators() {
    const operators = Object.entries(OPERATORS).map(([code, def]) => ({
      code,
      label: def.label,
      types: def.types,
      valueCount: def.valueCount,
    }));
    return {
      success: true,
      data: operators,
    };
  }

  /**
   * 세그먼트 대상 수 미리보기
   */
  @Post('segment/preview')
  @ApiOperation({ summary: '세그먼트 대상 수 미리보기' })
  @ApiResponse({ status: 200, description: '대상 사용자 수' })
  async previewSegment(@Body() dto: SegmentPreviewDto) {
    const userIds = await this.segmentService.getTargetUserIds(dto.segmentRule);
    return {
      success: true,
      data: {
        count: userIds.length,
        sampleUserIds: userIds.slice(0, 10),
      },
    };
  }

  /**
   * 템플릿 치환 미리보기
   */
  @Post('template/preview')
  @ApiOperation({ summary: '템플릿 치환 미리보기' })
  @ApiResponse({ status: 200, description: '치환 결과' })
  async previewTemplate(@Body() dto: TemplatePreviewDto) {
    const titleResult = await this.templateService.previewTemplate(
      dto.title,
      dto.sampleUserId,
    );
    const bodyResult = await this.templateService.previewTemplate(
      dto.body,
      dto.sampleUserId,
    );

    return {
      success: true,
      data: {
        originalTitle: dto.title,
        substitutedTitle: titleResult.substituted,
        originalBody: dto.body,
        substitutedBody: bodyResult.substituted,
        user: titleResult.user,
      },
    };
  }

  /**
   * 개인화 푸시 발송
   * MQ에 발송 요청을 추가하고 jobIds를 반환 (비동기 처리)
   */
  @Post('send')
  @ApiOperation({ summary: '개인화 푸시 발송' })
  @ApiResponse({ status: 200, description: '발송 결과' })
  async sendPersonalizedPush(@Body() dto: SendPersonalizedPushDto) {
    // 1. 템플릿 유효성 검증
    await this.templateService.validateTemplate(dto.title);
    await this.templateService.validateTemplate(dto.body);

    // 2. 세그먼트 대상 조회
    const userIds = await this.segmentService.getTargetUserIds(dto.segmentRule);

    if (userIds.length === 0) {
      return {
        success: false,
        message: '세그먼트 조건에 해당하는 사용자가 없습니다',
        data: { targetCount: 0 },
      };
    }

    // 3. 사용자별 메시지 치환
    const titles = await this.templateService.substituteForUsers(dto.title, userIds);
    const bodies = await this.templateService.substituteForUsers(dto.body, userIds);

    // 4. 개별 발송 (MQ에 요청 추가)
    const jobIds: string[] = [];

    for (const userId of userIds) {
      const title = titles.get(userId) || dto.title;
      const body = bodies.get(userId) || dto.body;

      try {
        const result = await this.notificationService.sendToUser(
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
      } catch (error) {
        // MQ 추가 실패 시 로그만 남김
      }
    }

    return {
      success: true,
      message: `${userIds.length}명에게 개인화 푸시 발송 요청이 접수되었습니다`,
      data: {
        targetCount: userIds.length,
        jobIds,
      },
    };
  }
}
