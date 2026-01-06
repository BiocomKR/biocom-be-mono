import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { UserSubscriptionStatus } from '../../common/enums/user-subscription-status.enum';
import { UserChallengeStatus } from '../../common/enums/challenge-ticket-status.enum';

/**
 * GA4 Analytics용 사용자 속성 DTO
 */
export class UserAnalyticsDto {
  @ApiProperty({ description: '사용자 ID', example: 1 })
  userId: number;

  @ApiProperty({
    description: '사용자 타입 (NEWCOMER, CHALLENGER, SUBSCRIBER)',
    enum: UserSubscriptionStatus,
    example: UserSubscriptionStatus.CHALLENGER,
  })
  userType: UserSubscriptionStatus;

  @ApiPropertyOptional({
    description: '챌린지 상태 (PENDING, ACTIVE, COMPLETED, EXPIRED)',
    enum: UserChallengeStatus,
    example: UserChallengeStatus.ACTIVE,
    nullable: true,
  })
  challengeStatus: UserChallengeStatus | null;

  @ApiPropertyOptional({
    description: '챌린지 코드 (상품 SKU)',
    example: 'CHALLENGE_21',
    nullable: true,
  })
  challengeCode: string | null;

  @ApiPropertyOptional({
    description: '구독 상태 (ACTIVE, PAUSED, CANCELLED, BILLING_DELETED, PAYMENT_FAILED, EXPIRED)',
    example: 'ACTIVE',
    nullable: true,
  })
  subscriptionStatus: string | null;

  @ApiProperty({
    description: '가입일 (ISO 8601)',
    example: '2025-01-01T00:00:00.000Z',
  })
  createdAt: string;
}
