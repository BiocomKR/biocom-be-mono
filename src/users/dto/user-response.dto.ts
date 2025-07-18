import { ApiProperty } from '@nestjs/swagger';
import { FileUpload } from '@prisma/client';

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
   * 닉네임
   */
  @ApiProperty({
    description: '사용자 닉네임',
    example: 'cooluser123',
    nullable: true,
  })
  nickname: string | null;

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
   * 업로드한 파일 목록 (include=fileUploads 시에만 포함)
   */
  @ApiProperty({
    description: '사용자가 업로드한 파일 목록',
    type: [Object],
    required: false,
  })
  fileUploads?: Partial<FileUpload>[];
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