import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * 회원 목록 아이템 DTO
 */
export class UserListItemDto {
  @ApiProperty({ description: '회원 ID' })
  id: number;

  @ApiPropertyOptional({ description: '이메일' })
  email?: string;

  @ApiProperty({ description: '이름' })
  name: string;

  @ApiProperty({ description: '휴대폰 번호' })
  mobile: string;

  @ApiProperty({ description: '포인트' })
  points: number;

  @ApiProperty({ description: '회원 상태' })
  status: string;

  @ApiProperty({ description: '역할' })
  role: string;

  @ApiProperty({ description: '활성화 여부' })
  isActive: boolean;

  @ApiPropertyOptional({ description: '생년월일 (YYYYMMDD)' })
  birthDate?: string;

  @ApiPropertyOptional({ description: '성별' })
  sex?: string;

  @ApiPropertyOptional({ description: '통신사' })
  telecom?: string;

  @ApiPropertyOptional({ description: '건강유형 동물 ID' })
  healthTypeAnimalId?: number;

  @ApiPropertyOptional({ description: '건강유형 동물명' })
  healthTypeAnimalName?: string;

  @ApiProperty({ description: '가입일' })
  createdAt: Date;

  @ApiPropertyOptional({ description: '수정일' })
  updatedAt?: Date;

  @ApiPropertyOptional({ description: '탈퇴일' })
  deletedAt?: Date;

  // 통계 정보
  @ApiPropertyOptional({ description: '주문 수' })
  orderCount?: number;

  @ApiPropertyOptional({ description: '챌린지 참여 수' })
  challengeCount?: number;

  @ApiPropertyOptional({ description: '쿠폰 수' })
  couponCount?: number;
}

/**
 * 회원 목록 응답 DTO
 */
export class UserListResponseDto {
  @ApiProperty({ description: '성공 여부' })
  success: boolean;

  @ApiProperty({ description: '메시지' })
  message: string;

  @ApiProperty({ description: '회원 목록', type: [UserListItemDto] })
  data: {
    users: UserListItemDto[];
    pagination: {
      page: number;
      limit: number;
      total: number;
      totalPages: number;
    };
  };

  @ApiProperty({ description: '응답 시간' })
  timestamp: Date;
}

/**
 * 회원 상세 정보 DTO
 */
export class UserDetailDto {
  @ApiProperty({ description: '회원 ID' })
  id: number;

  @ApiPropertyOptional({ description: '이메일' })
  email?: string;

  @ApiProperty({ description: '이름' })
  name: string;

  @ApiProperty({ description: '휴대폰 번호' })
  mobile: string;

  @ApiProperty({ description: '포인트' })
  points: number;

  @ApiProperty({ description: '회원 상태' })
  status: string;

  @ApiProperty({ description: '역할' })
  role: string;

  @ApiProperty({ description: '활성화 여부' })
  isActive: boolean;

  @ApiPropertyOptional({ description: '생년월일 (YYYYMMDD)' })
  birthDate?: string;

  @ApiPropertyOptional({ description: '성별' })
  sex?: string;

  @ApiPropertyOptional({ description: '통신사' })
  telecom?: string;

  @ApiPropertyOptional({ description: '지역 코드' })
  localCode?: string;

  @ApiPropertyOptional({ description: '빌링키 유무' })
  hasBillingKey?: boolean;

  @ApiProperty({ description: '가입일' })
  createdAt: Date;

  @ApiPropertyOptional({ description: '수정일' })
  updatedAt?: Date;

  @ApiPropertyOptional({ description: '탈퇴일' })
  deletedAt?: Date;

  // AI 페르소나 정보
  @ApiPropertyOptional({ description: 'AI 페르소나 정보' })
  aiPersona?: {
    id: number;
    name: string;
  };

  // 건강유형 동물 정보
  @ApiPropertyOptional({ description: '건강유형 동물 정보' })
  healthTypeAnimal?: {
    id: number;
    name: string;
    healthType: string;
  };

  // 푸시 토큰 정보
  @ApiPropertyOptional({ description: '푸시 토큰 목록' })
  pushTokens?: {
    id: number;
    token: string;
    deviceType: string;
    isActive: boolean;
    createdAt: Date;
  }[];

  // 통계 정보
  @ApiProperty({ description: '통계 정보' })
  stats: {
    orderCount: number;
    totalOrderAmount: number;
    challengeCount: number;
    activeChallengeCount: number;
    couponCount: number;
    unusedCouponCount: number;
    pointHistoryCount: number;
  };

  // 최근 주문 목록
  @ApiPropertyOptional({ description: '최근 주문 목록' })
  recentOrders?: {
    id: number;
    orderNumber: string;
    status: string;
    totalAmount: number;
    createdAt: Date;
  }[];

  // 챌린지 참여 목록
  @ApiPropertyOptional({ description: '챌린지 참여 목록' })
  userChallenges?: {
    id: number;
    productName: string;
    status: string;
    startDate?: Date;
    endDate?: Date;
    totalPoints: number;
  }[];
}

/**
 * 회원 상세 응답 DTO
 */
export class UserDetailResponseDto {
  @ApiProperty({ description: '성공 여부' })
  success: boolean;

  @ApiProperty({ description: '메시지' })
  message: string;

  @ApiProperty({ description: '회원 상세 정보', type: UserDetailDto })
  data: UserDetailDto;

  @ApiProperty({ description: '응답 시간' })
  timestamp: Date;
}

/**
 * 회원 통계 응답 DTO
 */
export class UserStatsResponseDto {
  @ApiProperty({ description: '성공 여부' })
  success: boolean;

  @ApiProperty({ description: '메시지' })
  message: string;

  @ApiProperty({ description: '통계 데이터' })
  data: {
    totalUsers: number;
    activeUsers: number;
    inactiveUsers: number;
    deletedUsers: number;
    newUsersToday: number;
    newUsersThisWeek: number;
    newUsersThisMonth: number;
    usersByStatus: {
      status: string;
      count: number;
    }[];
  };

  @ApiProperty({ description: '응답 시간' })
  timestamp: Date;
}
