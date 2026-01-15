import { Controller, Get, Post, Body, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery, ApiBody, ApiResponse } from '@nestjs/swagger';
import { PushSchedulerService } from '../services/push-scheduler.service';
import { ConditionEvaluatorService } from '../services/condition-evaluator.service';

/**
 * 푸시 테스트 컨트롤러 (개발/테스트 환경용)
 *
 * 실제 발송 없이 푸시 시스템을 테스트하기 위한 API
 * - 스케줄러 수동 트리거
 * - 조건 평가 미리보기
 */
@ApiTags('푸시-테스트')
@Controller('push/test')
export class PushTestController {
  constructor(
    private readonly pushSchedulerService: PushSchedulerService,
    private readonly conditionEvaluatorService: ConditionEvaluatorService,
  ) {}

  /**
   * 스케줄러 수동 트리거
   * K8s CronJob 대신 수동으로 스케줄 확인 실행
   */
  @Post('trigger-scheduler')
  @ApiOperation({
    summary: '스케줄러 수동 트리거',
    description: '매분 실행되는 푸시 스케줄러를 수동으로 즉시 실행합니다',
  })
  @ApiResponse({
    status: 200,
    description: '트리거 성공',
    schema: {
      example: { success: true, message: '스케줄 확인이 수동으로 트리거되었습니다' },
    },
  })
  async triggerScheduler() {
    return this.pushSchedulerService.triggerScheduleCheck();
  }

  /**
   * 조건 평가 미리보기
   * 특정 조건에 매칭되는 유저 수와 샘플 조회
   */
  @Post('evaluate-condition')
  @ApiOperation({
    summary: '조건 평가 미리보기',
    description: '특정 조건에 매칭되는 유저 수와 샘플을 조회합니다 (실제 발송 없음)',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['conditionType'],
      properties: {
        conditionType: {
          type: 'string',
          description: '조건 타입',
          enum: [
            'CHALLENGE_DAY',
            'CHALLENGE_STATUS',
            'NO_ACCESS_HOURS',
            'INCOMPLETE_COUNT',
            'INCOMPLETE_TYPES',
            'COMPLETION_RATE',
            'ONBOARDING_STATE',
            'CHALLENGE_START_OFFSET_DAYS',
            'REPORT_STATE',
            'POINTS',
            'COUPON_EXPIRING_HOURS',
            'CART_HAS_ITEMS',
          ],
        },
        conditionParams: {
          type: 'object',
          description: '조건 파라미터',
          example: { day: 7 },
        },
      },
    },
    examples: {
      challengeDay: {
        summary: 'CHALLENGE_DAY - N일차 유저',
        value: { conditionType: 'CHALLENGE_DAY', conditionParams: { day: 7 } },
      },
      challengeStatus: {
        summary: 'CHALLENGE_STATUS - 특정 상태 유저',
        value: { conditionType: 'CHALLENGE_STATUS', conditionParams: { status: 'ACTIVE' } },
      },
      noAccessHours: {
        summary: 'NO_ACCESS_HOURS - N시간 미접속',
        value: { conditionType: 'NO_ACCESS_HOURS', conditionParams: { hours: 24 } },
      },
      incompleteCount: {
        summary: 'INCOMPLETE_COUNT - 미완료 N개 이상',
        value: { conditionType: 'INCOMPLETE_COUNT', conditionParams: { count: 3 } },
      },
      completionRate: {
        summary: 'COMPLETION_RATE - 완료율 N% 미만',
        value: { conditionType: 'COMPLETION_RATE', conditionParams: { rate: 50 } },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: '조건 평가 결과',
    schema: {
      example: {
        totalCount: 150,
        withTokenCount: 120,
        testerCount: 5,
        sampleUsers: [
          { id: 40, name: '테스트유저', mobile: '010-1234-5678', isTester: true },
        ],
      },
    },
  })
  async evaluateCondition(
    @Body('conditionType') conditionType: string,
    @Body('conditionParams') conditionParams: Record<string, any> = {},
  ) {
    return this.conditionEvaluatorService.previewCondition(conditionType, conditionParams);
  }

  /**
   * 조건에 매칭되는 테스터만 조회
   */
  @Post('evaluate-condition/testers')
  @ApiOperation({
    summary: '조건 평가 - 테스터만',
    description: '특정 조건에 매칭되는 테스터 유저만 조회합니다',
  })
  @ApiBody({
    schema: {
      type: 'object',
      required: ['conditionType'],
      properties: {
        conditionType: { type: 'string' },
        conditionParams: { type: 'object' },
      },
    },
  })
  @ApiResponse({
    status: 200,
    description: '테스터 유저 ID 목록',
    schema: {
      example: { testerIds: [40, 41, 42], count: 3 },
    },
  })
  async evaluateConditionTesters(
    @Body('conditionType') conditionType: string,
    @Body('conditionParams') conditionParams: Record<string, any> = {},
  ) {
    const testerIds = await this.conditionEvaluatorService.evaluateConditionTestersOnly(
      conditionType,
      conditionParams,
    );
    return { testerIds, count: testerIds.length };
  }

  /**
   * 지원되는 조건 타입 목록
   */
  @Get('condition-types')
  @ApiOperation({
    summary: '지원되는 조건 타입 목록',
    description: '사용 가능한 조건 타입과 필요한 파라미터 정보를 반환합니다',
  })
  getConditionTypes() {
    return {
      conditionTypes: [
        {
          type: 'CHALLENGE_DAY',
          description: '챌린지 N일차 유저',
          params: { day: 'number (1-28)' },
          example: { day: 7 },
        },
        {
          type: 'CHALLENGE_STATUS',
          description: '특정 챌린지 상태 유저',
          params: { status: 'PENDING | ACTIVE | COMPLETED | FAILED' },
          example: { status: 'ACTIVE' },
        },
        {
          type: 'NO_ACCESS_HOURS',
          description: 'N시간 이상 미접속 유저',
          params: { hours: 'number' },
          example: { hours: 24 },
        },
        {
          type: 'INCOMPLETE_COUNT',
          description: '오늘 미완료 미션 N개 이상 유저',
          params: { count: 'number' },
          example: { count: 3 },
        },
        {
          type: 'INCOMPLETE_TYPES',
          description: '특정 미션 타입 미완료 유저',
          params: { types: 'string[]' },
          example: { types: ['BREAKFAST', 'LUNCH'] },
        },
        {
          type: 'COMPLETION_RATE',
          description: '오늘 완료율 N% 미만 유저',
          params: { rate: 'number (0-100)' },
          example: { rate: 50 },
        },
        {
          type: 'ONBOARDING_STATE',
          description: '특정 온보딩 상태 유저',
          params: { state: 'NOT_STARTED | IN_PROGRESS | COMPLETED | TYPE_SURVEY_INCOMPLETE | SOLUTION_VIEWED_START_NOT_SET' },
          example: { state: 'TYPE_SURVEY_INCOMPLETE' },
        },
        {
          type: 'CHALLENGE_START_OFFSET_DAYS',
          description: '챌린지 시작 D-N 유저',
          params: { offsetDays: 'number (-1 = 내일 시작)' },
          example: { offsetDays: -1 },
        },
        {
          type: 'REPORT_STATE',
          description: '리포트 상태 유저',
          params: { state: 'UNREAD | ALL_READ' },
          example: { state: 'UNREAD' },
        },
        {
          type: 'POINTS',
          description: '포인트 N 이상 유저',
          params: { min: 'number' },
          example: { min: 1000 },
        },
        {
          type: 'COUPON_EXPIRING_HOURS',
          description: '쿠폰 만료 N시간 전 유저',
          params: { hours: 'number' },
          example: { hours: 24 },
        },
        {
          type: 'CART_HAS_ITEMS',
          description: '장바구니에 상품이 있는 유저',
          params: {},
          example: {},
        },
      ],
    };
  }
}
