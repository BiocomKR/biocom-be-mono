import { IsOptional, IsInt, IsString, IsBoolean, IsEnum, Min, Max } from 'class-validator';
import { Type, Transform } from 'class-transformer';
import { ApiPropertyOptional } from '@nestjs/swagger';
import { UserSubscriptionStatus } from '../../common/enums';

export enum UserSortBy {
  ID = 'id',
  NAME = 'name',
  EMAIL = 'email',
  POINTS = 'points',
  CREATED_AT = 'createdAt',
  UPDATED_AT = 'updatedAt',
  BIRTH_DATE = 'birthDate',
  ORDER_COUNT = 'orderCount',
  CHALLENGE_COUNT = 'challengeCount',
}

export enum UserSex {
  MALE = '01',    // 남성
  FEMALE = '02',  // 여성
}

export enum UserAgeGroup {
  TEEN = '10',
  TWENTY = '20',
  THIRTY = '30',
  FORTY = '40',
  FIFTY = '50',
  SIXTY_PLUS = '60',
}

export class UserQueryDto {
  @ApiPropertyOptional({ description: '페이지 번호', default: 1 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  page?: number = 1;

  @ApiPropertyOptional({ description: '페이지 당 항목 수', default: 20 })
  @IsOptional()
  @Type(() => Number)
  @IsInt()
  @Min(1)
  @Max(100)
  limit?: number = 20;

  @ApiPropertyOptional({ description: '검색어 (이름, 이메일, 전화번호)' })
  @IsOptional()
  @IsString()
  search?: string;

  @ApiPropertyOptional({ description: '회원 상태', enum: UserSubscriptionStatus })
  @IsOptional()
  @IsEnum(UserSubscriptionStatus)
  status?: UserSubscriptionStatus;

  @ApiPropertyOptional({ description: '활성화 여부' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  isActive?: boolean;

  @ApiPropertyOptional({ description: '마케팅 수신 동의 여부' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  marketingEnabled?: boolean;

  @ApiPropertyOptional({ description: '가입일 시작' })
  @IsOptional()
  @IsString()
  startDate?: string;

  @ApiPropertyOptional({ description: '가입일 종료' })
  @IsOptional()
  @IsString()
  endDate?: string;

  @ApiPropertyOptional({ description: '정렬 기준', enum: UserSortBy, default: UserSortBy.CREATED_AT })
  @IsOptional()
  @IsEnum(UserSortBy)
  sortBy?: UserSortBy = UserSortBy.CREATED_AT;

  @ApiPropertyOptional({ description: '정렬 순서', enum: ['asc', 'desc'], default: 'desc' })
  @IsOptional()
  @IsString()
  sortOrder?: 'asc' | 'desc' = 'desc';

  @ApiPropertyOptional({ description: '삭제된 회원 포함 여부' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  includeDeleted?: boolean = false;

  @ApiPropertyOptional({ description: '성별', enum: UserSex })
  @IsOptional()
  @IsEnum(UserSex)
  sex?: UserSex;

  @ApiPropertyOptional({ description: '연령대', enum: UserAgeGroup })
  @IsOptional()
  @IsEnum(UserAgeGroup)
  ageGroup?: UserAgeGroup;

  @ApiPropertyOptional({ description: '빌링키 등록 여부' })
  @IsOptional()
  @Transform(({ value }) => value === 'true' || value === true)
  @IsBoolean()
  hasBillingKey?: boolean;
}
