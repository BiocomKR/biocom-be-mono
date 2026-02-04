import { ApiProperty } from '@nestjs/swagger';
import { UserFile } from '@prisma/client';

/**
 * 사용자 응답 DTO
 * API 응답에서 반환되는 사용자 정보 형식
 */
export class UserResponseDto {
  /**
   * 사용자 ID
   */
  @ApiProperty({
    description: '사용자 고유 ID',
    example: 1,
  })
  id: number;

  /**
   * 이메일 주소
   */
  @ApiProperty({
    description: '사용자 이메일 주소',
    example: 'user@example.com',
  })
  email: string;

  /**
   * 이름
   */
  @ApiProperty({
    description: '사용자 이름',
    example: '홍길동',
  })
  name: string;

  /**
   * 휴대폰 번호
   */
  @ApiProperty({
    description: '휴대폰 번호',
    example: '01012345678',
  })
  mobile: string;

  /**
   * 포인트
   */
  @ApiProperty({
    description: '보유 포인트',
    example: 1000,
  })
  points: number;

  /**
   * 생성일시
   */
  @ApiProperty({
    description: '계정 생성일시',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;

  /**
   * 수정일시
   */
  @ApiProperty({
    description: '계정 정보 최종 수정일시',
    example: '2024-01-01T00:00:00.000Z',
    nullable: true,
  })
  updatedAt: Date | null;

  /**
   * 업로드한 파일 목록 (include=userFiles 시에만 포함)
   */
  @ApiProperty({
    description: '사용자가 업로드한 파일 목록',
    type: [Object],
    required: false,
  })
  userFiles?: Partial<UserFile>[];
}

/**
 * 사용자 목록 응답 DTO (V2 방식)
 */
export class UserListResponseDto {
  /**
   * 사용자 목록
   */
  @ApiProperty({
    description: '사용자 목록',
    type: [UserResponseDto],
  })
  items: UserResponseDto[];

  /**
   * 페이지네이션 정보
   */
  @ApiProperty({
    description: '페이지네이션 정보',
    example: {
      offset: 0,
      limit: 10,
      total: 25,
      hasNext: true,
      hasPrev: false,
    },
  })
  pagination: {
    offset: number;
    limit: number;
    total: number;
    hasNext: boolean;
    hasPrev: boolean;
  };

  /**
   * 필터 정보
   */
  @ApiProperty({
    description: '적용된 필터 정보',
    example: {
      search: 'user@example.com',
    },
  })
  filters: {
    search: string | null;
  };

  /**
   * 정렬 정보
   */
  @ApiProperty({
    description: '적용된 정렬 정보',
    example: 'createdAt:desc',
  })
  sort: string;
}

/**
 * 아임웹 회원 정보 DTO
 */
export class ImwebMemberDto {
  @ApiProperty({ description: '회원 UID', example: 'example@email.com' })
  memberUid: string;

  @ApiProperty({ description: '회원 이름', example: '홍길동' })
  name: string;

  @ApiProperty({ description: '전화번호', example: '01056060746' })
  phone: string;

  @ApiProperty({ description: '이메일', example: 'example@email.com', required: false })
  email?: string;

  @ApiProperty({ description: '회원 코드', example: 'S20190715619285c855898' })
  memberCode: string;

  @ApiProperty({ description: '회원 그룹', example: 'default' })
  memberGroup: string;

  @ApiProperty({ description: '가입일시', example: '2024-01-01T00:00:00.000Z' })
  regdate: string;
}

/**
 * 아임웹 회원 검색 응답 DTO
 */
export class SearchImwebMembersResponseDto {
  @ApiProperty({ description: '응답 성공 여부', example: true })
  success: boolean;

  @ApiProperty({ description: '응답 메시지', example: '아임웹 회원 검색이 완료되었습니다.' })
  message: string;

  @ApiProperty({ 
    description: '검색된 회원 목록',
    type: [ImwebMemberDto],
  })
  data: ImwebMemberDto[];

  @ApiProperty({ 
    description: '메타 정보',
    example: {
      version: 'v2',
      timestamp: '2024-01-01T00:00:00.000Z',
      count: 1
    }
  })
  meta: {
    version: string;
    timestamp: Date;
    count: number;
  };

  @ApiProperty({ description: '응답 생성 시각', example: '2024-01-01T00:00:00.000Z' })
  timestamp: Date;
}

/**
 * 내 정보 조회 응답 DTO
 */
export class GetMyProfileResponseDto {
  @ApiProperty({ description: '응답 성공 여부', example: true })
  success: boolean;

  @ApiProperty({ description: '응답 메시지', example: '프로필 조회가 완료되었습니다.' })
  message: string;

  @ApiProperty({ 
    description: '사용자 정보',
    type: UserResponseDto,
  })
  data: UserResponseDto;

  @ApiProperty({ description: '응답 생성 시각', example: '2024-01-01T00:00:00.000Z' })
  timestamp: Date;
}

/**
 * 사용자 정보 업데이트 응답 DTO
 */
export class UpdateUserResponseDto {
  @ApiProperty({ description: '응답 성공 여부', example: true })
  success: boolean;

  @ApiProperty({ description: '응답 메시지', example: '프로필이 업데이트되었습니다.' })
  message: string;

  @ApiProperty({ 
    description: '업데이트된 사용자 정보',
    type: UserResponseDto,
  })
  data: UserResponseDto;

  @ApiProperty({ description: '응답 생성 시각', example: '2024-01-01T00:00:00.000Z' })
  timestamp: Date;
}

/**
 * 포인트 정보 DTO
 */
export class UserPointDto {
  @ApiProperty({ description: '사용자 ID', example: 1 })
  userId: number;

  @ApiProperty({ description: '현재 포인트', example: 1500 })
  currentPoints: number;

  @ApiProperty({ description: '누적 획득 포인트', example: 5000 })
  totalEarned: number;

  @ApiProperty({ description: '누적 사용 포인트', example: 3500 })
  totalUsed: number;
}

/**
 * 내 포인트 조회 응답 DTO
 */
export class GetMyPointsResponseDto {
  @ApiProperty({ description: '응답 성공 여부', example: true })
  success: boolean;

  @ApiProperty({ description: '응답 메시지', example: '포인트 조회가 완료되었습니다.' })
  message: string;

  @ApiProperty({ 
    description: '포인트 정보',
    type: UserPointDto,
  })
  data: UserPointDto;

  @ApiProperty({ description: '응답 생성 시각', example: '2024-01-01T00:00:00.000Z' })
  timestamp: Date;
}