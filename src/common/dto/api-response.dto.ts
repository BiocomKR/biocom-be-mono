import { ApiProperty } from '@nestjs/swagger';

/**
 * 기본 API 응답 DTO
 * 모든 API 응답의 표준 형식을 정의
 */
export class ApiResponseDto<T = any> {
  /**
   * 응답 성공 여부
   */
  @ApiProperty({
    description: '응답 성공 여부',
    example: true,
  })
  success: boolean;

  /**
   * 응답 메시지
   */
  @ApiProperty({
    description: '응답 메시지',
    example: '요청이 성공적으로 처리되었습니다.',
  })
  message: string;

  /**
   * 응답 데이터
   */
  @ApiProperty({
    description: '응답 데이터',
    required: false,
  })
  data?: T;

  /**
   * 메타 정보 (V2 방식에서 사용)
   */
  @ApiProperty({
    description: '메타 정보 (버전, 타임스탬프 등)',
    required: false,
  })
  meta?: {
    version?: string;
    timestamp?: Date;
    message?: string;
    [key: string]: any;
  };

  /**
   * 에러 정보 (실패 시에만)
   */
  @ApiProperty({
    description: '에러 정보',
    required: false,
  })
  error?: {
    code?: string;
    details?: any;
  };

  /**
   * 응답 생성 시각
   */
  @ApiProperty({
    description: '응답 생성 시각',
    example: '2024-01-01T00:00:00.000Z',
  })
  timestamp: Date;
}

/**
 * 페이지네이션 정보 DTO
 * 목록 조회 시 페이지네이션 정보를 포함
 */
export class PaginationDto {
  /**
   * 현재 페이지 번호
   */
  @ApiProperty({
    description: '현재 페이지 번호',
    example: 1,
  })
  page: number;

  /**
   * 페이지당 항목 수
   */
  @ApiProperty({
    description: '페이지당 항목 수',
    example: 10,
  })
  limit: number;

  /**
   * 전체 항목 수
   */
  @ApiProperty({
    description: '전체 항목 수',
    example: 100,
  })
  total: number;

  /**
   * 전체 페이지 수
   */
  @ApiProperty({
    description: '전체 페이지 수',
    example: 10,
  })
  totalPages: number;
}

/**
 * 페이지네이션된 응답 DTO
 * 목록 조회 응답에 페이지네이션 정보를 포함
 */
export class PaginatedResponseDto<T = any> extends ApiResponseDto<T[]> {
  /**
   * 페이지네이션 정보
   */
  @ApiProperty({
    description: '페이지네이션 정보',
    type: PaginationDto,
  })
  pagination: PaginationDto;
}

/**
 * 표준 API 성공 응답 DTO (ApiResponseDto의 별칭)
 */
export class ApiSuccessResponse<T = any> extends ApiResponseDto<T> {}