import { Controller, Post, Body, UseGuards } from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiOperation, ApiBody } from '@nestjs/swagger';
import { SkipThrottle } from '@nestjs/throttler';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { DryRunService } from './services/dry-run.service';
import {
  DryRunRequestDto,
  DryRunMockResponseDto,
  DryRunRealUserResponseDto,
  DryRunRealScheduleResponseDto,
} from './dto/dry-run.dto';

/**
 * 푸시 dry-run 컨트롤러
 *
 * 실제 발송 없이 푸시 조건 평가 결과 시뮬레이션
 */
@ApiTags('푸시 테스트')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@SkipThrottle()
@Controller('push/dry-run')
export class PushDryRunController {
  constructor(private readonly dryRunService: DryRunService) {}

  /**
   * dry-run 실행
   *
   * Mock 모드: 가상 유저 상태로 시뮬레이션
   * Real 모드: 실제 DB 유저/스케줄로 시뮬레이션
   */
  @Post()
  @ApiOperation({
    summary: '푸시 dry-run 실행',
    description: `
실제 발송 없이 푸시 조건 평가 결과를 시뮬레이션합니다.

## Mock 모드
가상의 유저 상태를 입력하여 어떤 스케줄에 매칭되는지 확인합니다.
- \`mode: "mock"\`
- \`mockUserState\`: 가상 유저 상태 (challengeDay, lastSeenAt 등)

## Real 모드
실제 DB의 유저 또는 스케줄로 시뮬레이션합니다.
- \`mode: "real"\`
- \`userId\`: 특정 유저가 어떤 푸시를 받게 되는지 확인
- \`scheduleId\`: 특정 스케줄이 몇 명에게 발송되는지 확인
    `,
  })
  @ApiBody({
    type: DryRunRequestDto,
    examples: {
      mock: {
        summary: 'Mock 모드 - 가상 유저 상태',
        value: {
          mode: 'mock',
          mockUserState: {
            challengeDay: 7,
            challengeStatus: 'ACTIVE',
            lastSeenAt: '2026-01-12T17:00:00',
            incompleteCount: 3,
            incompleteTypes: ['BREAKFAST', 'LUNCH'],
            completionRate: 50,
          },
        },
      },
      realUser: {
        summary: 'Real 모드 - 특정 유저',
        value: {
          mode: 'real',
          userId: 40,
        },
      },
      realSchedule: {
        summary: 'Real 모드 - 특정 스케줄',
        value: {
          mode: 'real',
          scheduleId: 123,
          limit: 50,
        },
      },
    },
  })
  async dryRun(
    @Body() dto: DryRunRequestDto,
  ): Promise<DryRunMockResponseDto | DryRunRealUserResponseDto | DryRunRealScheduleResponseDto> {
    return this.dryRunService.execute(dto);
  }
}
