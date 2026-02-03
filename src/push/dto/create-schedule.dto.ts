import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, IsOptional, IsBoolean, IsDateString, IsObject, IsEnum, MaxLength, MinLength, IsArray, IsInt } from 'class-validator';
import { PushScheduleType, PushCategory } from '../enums';
import { AppBundleId } from '../../common/enums';

/**
 * 스케줄 생성 DTO
 */
export class CreateScheduleDto {
  @ApiPropertyOptional({
    description: '푸시 식별 코드 (이벤트 수집용, 고유해야 함)',
    example: 'CHALLENGE_DAY7_REMIND',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  pushCode?: string;

  @ApiProperty({ description: '스케줄 이름', example: '매일 오전 9시 챌린지 알림' })
  @IsString()
  @MinLength(1)
  @MaxLength(100)
  name: string;

  @ApiPropertyOptional({ description: '스케줄 설명', example: '매일 오전 9시에 전체 유저에게 오늘의 챌린지 알림 발송' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @ApiProperty({
    description: '스케줄 타입 (ONCE: 단발성, RECURRING: 반복)',
    enum: PushScheduleType,
    example: PushScheduleType.RECURRING
  })
  @IsEnum(PushScheduleType)
  scheduleType: PushScheduleType;

  @ApiProperty({ description: '푸시 타입', example: 'REMIND' })
  @IsString()
  @MaxLength(50)
  type: string;

  @ApiProperty({
    description: '카테고리',
    enum: PushCategory,
    example: PushCategory.AUTO
  })
  @IsEnum(PushCategory)
  category: PushCategory;

  @ApiPropertyOptional({
    description: '크론 표현식 (RECURRING 타입일 때 필수, 예: 0 9 * * *)',
    example: '0 9 * * *'
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  cronExpression?: string;

  @ApiPropertyOptional({
    description: '단발성 예약 시간 (ONCE 타입일 때 필수, KST 기준 YYYY-MM-DD HH:mm:ss)',
    example: '2025-01-25 09:00:00'
  })
  @IsOptional()
  @IsString()
  oneTimeScheduledAt?: string;

  @ApiProperty({ description: '제목', example: '오늘의 챌린지를 확인하세요!' })
  @IsString()
  @MaxLength(100)
  title: string;

  @ApiProperty({
    description: '본문 템플릿',
    example: '새로운 챌린지가 등록되었습니다. 지금 바로 도전해보세요!'
  })
  @IsString()
  bodyTemplate: string;

  @ApiPropertyOptional({ description: '이미지 URL', example: 'https://example.com/image.png' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  imageUrl?: string;

  @ApiPropertyOptional({
    description: '추가 데이터 (JSON)',
    example: { screen: 'challenge', challengeId: 123 }
  })
  @IsOptional()
  @IsObject()
  data?: Record<string, any>;

  @ApiPropertyOptional({
    description: '타겟팅 쿼리 조건 (JSON)',
    example: { marketingEnabled: true }
  })
  @IsOptional()
  @IsObject()
  targetQuery?: Record<string, any>;

  @ApiPropertyOptional({
    description: '반복 발송 시작일 (YYYY-MM-DD)',
    example: '2025-01-20'
  })
  @IsOptional()
  @IsDateString()
  startDate?: string;

  @ApiPropertyOptional({
    description: '반복 발송 종료일 (YYYY-MM-DD)',
    example: '2025-12-31'
  })
  @IsOptional()
  @IsDateString()
  endDate?: string;

  @ApiPropertyOptional({ description: '활성화 여부', default: true })
  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({
    description: '테스트 모드 여부 (true면 User.isTester=true인 유저에게만 발송)',
    default: true,
  })
  @IsOptional()
  @IsBoolean()
  isTest?: boolean;

  // =====================================================
  // 조건 기반 발송 필드 (AND 조합)
  // =====================================================

  @ApiPropertyOptional({
    description: 'AND 조건 배열 (모든 조건을 만족하는 유저에게 발송)',
    example: [
      { type: 'CHALLENGE_DAY', params: { day: 7 } },
      { type: 'INCOMPLETE_TYPES', params: { types: ['DECLARATION'] } },
    ],
  })
  @IsOptional()
  @IsArray()
  conditions?: Array<{ type: string; params: Record<string, any> }>;

  @ApiPropertyOptional({
    description: '랜딩 타입 (HOME, LECTURE, MISSION_RECORD 등)',
    example: 'LECTURE',
  })
  @IsOptional()
  @IsString()
  @MaxLength(50)
  landingType?: string;

  @ApiPropertyOptional({
    description: '랜딩 파라미터 (JSON)',
    example: { day: 7 },
  })
  @IsOptional()
  @IsObject()
  landingParams?: Record<string, any>;

  @ApiPropertyOptional({
    description: '페르소나별 메시지 (JSON)',
    example: {
      default: { title: '알림', body: '메시지 본문' },
      STELLA: { title: '스텔라 알림', body: '스텔라 본문' },
    },
  })
  @IsOptional()
  @IsObject()
  personaMessages?: Record<string, { title: string; body: string }>;

  @ApiPropertyOptional({
    description: '발신자 타입 (BIOCOM | PERSONA)',
    example: 'PERSONA',
  })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  senderType?: string;

  @ApiPropertyOptional({
    description: '상품(챌린지) ID (null이면 공용 푸시)',
    example: 1,
  })
  @IsOptional()
  @IsInt()
  productId?: number;

  @ApiProperty({
    description: '대상 앱 번들ID',
    enum: AppBundleId,
    example: AppBundleId.CHALLENGE_PROD,
  })
  @IsEnum(AppBundleId)
  bundleId: AppBundleId;
}
