import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsEnum,
  IsOptional,
  IsInt,
  IsObject,
  ValidateNested,
  IsNumber,
  IsString,
  IsArray,
} from 'class-validator';
import { Type } from 'class-transformer';

/**
 * dry-run 모드
 */
export enum DryRunMode {
  MOCK = 'mock',
  REAL = 'real',
}

/**
 * Mock 유저 상태 DTO
 */
export class MockUserStateDto {
  @ApiPropertyOptional({ description: '챌린지 일차 (1~21)' })
  @IsOptional()
  @IsInt()
  challengeDay?: number;

  @ApiPropertyOptional({ description: '챌린지 상태', example: 'ACTIVE' })
  @IsOptional()
  @IsString()
  challengeStatus?: string;

  @ApiPropertyOptional({ description: '마지막 접속 시간 (ISO string)', example: '2026-01-12T17:00:00' })
  @IsOptional()
  @IsString()
  lastSeenAt?: string;

  @ApiPropertyOptional({ description: '미완료 미션 개수' })
  @IsOptional()
  @IsInt()
  incompleteCount?: number;

  @ApiPropertyOptional({ description: '미완료 미션 타입들', type: [String] })
  @IsOptional()
  @IsArray()
  incompleteTypes?: string[];

  @ApiPropertyOptional({ description: '오늘 완료율 (0~100)' })
  @IsOptional()
  @IsNumber()
  completionRate?: number;

  @ApiPropertyOptional({ description: '보유 포인트' })
  @IsOptional()
  @IsInt()
  points?: number;

  @ApiPropertyOptional({ description: '만료 임박 쿠폰 시간 (시간 단위)' })
  @IsOptional()
  @IsInt()
  couponExpiringHours?: number;

  @ApiPropertyOptional({ description: '장바구니 아이템 존재 여부' })
  @IsOptional()
  cartHasItems?: boolean;

  @ApiPropertyOptional({ description: '온보딩 상태', example: 'TYPE_SURVEY_INCOMPLETE' })
  @IsOptional()
  @IsString()
  onboardingState?: string;

  @ApiPropertyOptional({ description: '챌린지 시작까지 남은 일수 (음수: 과거)', example: -1 })
  @IsOptional()
  @IsInt()
  challengeStartOffsetDays?: number;

  @ApiPropertyOptional({ description: '리포트 상태', example: 'UNREAD' })
  @IsOptional()
  @IsString()
  reportState?: string;
}

/**
 * dry-run 요청 DTO
 */
export class DryRunRequestDto {
  @ApiProperty({ enum: DryRunMode, description: 'dry-run 모드 (mock: 가상 상태, real: 실제 DB)' })
  @IsEnum(DryRunMode)
  mode: DryRunMode;

  @ApiPropertyOptional({ description: 'Mock 모드 - 가상 유저 상태', type: MockUserStateDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => MockUserStateDto)
  mockUserState?: MockUserStateDto;

  @ApiPropertyOptional({ description: 'Real 모드 - 특정 유저 ID' })
  @IsOptional()
  @IsInt()
  userId?: number;

  @ApiPropertyOptional({ description: 'Real 모드 - 특정 스케줄 ID' })
  @IsOptional()
  @IsInt()
  scheduleId?: number;

  @ApiPropertyOptional({ description: 'Real 모드 - 결과 제한 수', default: 100 })
  @IsOptional()
  @IsInt()
  limit?: number;

  @ApiPropertyOptional({ description: '활성 스케줄만 조회 (기본: false = 전체)', default: false })
  @IsOptional()
  activeOnly?: boolean;
}

/**
 * 매칭된 스케줄 정보
 */
export class MatchedScheduleDto {
  @ApiProperty()
  id: number;

  @ApiProperty()
  name: string;

  @ApiPropertyOptional()
  pushCode?: string;

  @ApiProperty()
  pushGroup: string;

  @ApiProperty()
  priority: number;

  @ApiPropertyOptional({ description: 'AND 조건 배열' })
  conditions?: Array<{ type: string; params: Record<string, any> }>;

  @ApiProperty({ description: '스케줄 활성화 여부' })
  isActive: boolean;
}

/**
 * Mock 모드 응답 DTO
 */
export class DryRunMockResponseDto {
  @ApiProperty({ example: 'mock' })
  mode: 'mock';

  @ApiProperty({ type: MockUserStateDto })
  userState: MockUserStateDto;

  @ApiProperty({ type: [MatchedScheduleDto], description: '매칭된 모든 스케줄' })
  matchedSchedules: MatchedScheduleDto[];

  @ApiProperty({ type: [MatchedScheduleDto], description: '그룹별 최종 선정된 스케줄' })
  selectedSchedules: MatchedScheduleDto[];
}

/**
 * Real 모드 - 유저별 매칭 결과
 */
export class UserMatchResultDto {
  @ApiProperty()
  userId: number;

  @ApiPropertyOptional()
  userName?: string;

  @ApiProperty({ type: [MatchedScheduleDto] })
  matchedSchedules: MatchedScheduleDto[];

  @ApiProperty({ type: [MatchedScheduleDto] })
  selectedSchedules: MatchedScheduleDto[];
}

/**
 * Real 모드 응답 DTO (userId 지정)
 */
export class DryRunRealUserResponseDto {
  @ApiProperty({ example: 'real' })
  mode: 'real';

  @ApiProperty()
  userId: number;

  @ApiPropertyOptional()
  userName?: string;

  @ApiProperty({ description: '실제 DB에서 조회한 유저 상태' })
  userState: Record<string, any>;

  @ApiProperty({ type: [MatchedScheduleDto] })
  matchedSchedules: MatchedScheduleDto[];

  @ApiProperty({ type: [MatchedScheduleDto] })
  selectedSchedules: MatchedScheduleDto[];
}

/**
 * Real 모드 응답 DTO (scheduleId 지정)
 */
export class DryRunRealScheduleResponseDto {
  @ApiProperty({ example: 'real' })
  mode: 'real';

  @ApiProperty()
  scheduleId: number;

  @ApiProperty()
  scheduleName: string;

  @ApiProperty({ type: [UserMatchResultDto] })
  matchedUsers: UserMatchResultDto[];

  @ApiProperty()
  totalCount: number;
}
