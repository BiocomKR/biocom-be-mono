import { ApiProperty } from '@nestjs/swagger';

/**
 * 표준 성공 응답 DTO
 * 모든 API의 성공 응답 기본 형식
 */
export class StandardSuccessResponseDto<T = any> {
  @ApiProperty({ description: '응답 성공 여부', example: true })
  success: boolean;

  @ApiProperty({ description: '응답 메시지', example: '처리가 완료되었습니다.' })
  message: string;

  @ApiProperty({ description: '응답 데이터' })
  data: T;

  @ApiProperty({ description: '응답 생성 시각', example: '2024-01-01T00:00:00.000Z' })
  timestamp: Date;
}

/**
 * 표준 목록 응답 DTO
 */
export class StandardListResponseDto<T = any> {
  @ApiProperty({ description: '응답 성공 여부', example: true })
  success: boolean;

  @ApiProperty({ description: '응답 메시지', example: '조회가 완료되었습니다.' })
  message: string;

  @ApiProperty({ description: '데이터 목록', type: 'array' })
  data: T[];

  @ApiProperty({ 
    description: '페이지 정보',
    example: { page: 1, limit: 20, total: 100, totalPages: 5 }
  })
  pagination?: {
    page: number;
    limit: number;
    total: number;
    totalPages: number;
  };

  @ApiProperty({ description: '응답 생성 시각', example: '2024-01-01T00:00:00.000Z' })
  timestamp: Date;
}

/**
 * 400 Bad Request 응답 DTO
 */
export class BadRequestResponseDto {
  @ApiProperty({ description: '응답 성공 여부', example: false })
  success: boolean;

  @ApiProperty({ description: 'HTTP 상태 코드', example: 400 })
  statusCode: number;

  @ApiProperty({ 
    description: '에러 메시지',
    example: ['입력값이 올바르지 않습니다.']
  })
  message: string | string[];

  @ApiProperty({ description: '에러 타입', example: 'Bad Request' })
  error: string;

  @ApiProperty({ description: '요청 경로', example: '/api/mission' })
  path: string;

  @ApiProperty({ description: '응답 생성 시각', example: '2024-01-01T00:00:00.000Z' })
  timestamp: string;
}

/**
 * 401 Unauthorized 응답 DTO
 */
export class UnauthorizedResponseDto {
  @ApiProperty({ description: '응답 성공 여부', example: false })
  success: boolean;

  @ApiProperty({ description: 'HTTP 상태 코드', example: 401 })
  statusCode: number;

  @ApiProperty({ description: '에러 메시지', example: '인증이 필요합니다.' })
  message: string;

  @ApiProperty({ description: '에러 타입', example: 'Unauthorized' })
  error: string;

  @ApiProperty({ description: '요청 경로', example: '/api/mission' })
  path: string;

  @ApiProperty({ description: '응답 생성 시각', example: '2024-01-01T00:00:00.000Z' })
  timestamp: string;
}

/**
 * 403 Forbidden 응답 DTO
 */
export class ForbiddenResponseDto {
  @ApiProperty({ description: '응답 성공 여부', example: false })
  success: boolean;

  @ApiProperty({ description: 'HTTP 상태 코드', example: 403 })
  statusCode: number;

  @ApiProperty({ description: '에러 메시지', example: '권한이 없습니다.' })
  message: string;

  @ApiProperty({ description: '에러 타입', example: 'Forbidden' })
  error: string;

  @ApiProperty({ description: '요청 경로', example: '/api/management' })
  path: string;

  @ApiProperty({ description: '응답 생성 시각', example: '2024-01-01T00:00:00.000Z' })
  timestamp: string;
}

/**
 * 404 Not Found 응답 DTO
 */
export class NotFoundResponseDto {
  @ApiProperty({ description: '응답 성공 여부', example: false })
  success: boolean;

  @ApiProperty({ description: 'HTTP 상태 코드', example: 404 })
  statusCode: number;

  @ApiProperty({ description: '에러 메시지', example: '리소스를 찾을 수 없습니다.' })
  message: string;

  @ApiProperty({ description: '에러 타입', example: 'Not Found' })
  error: string;

  @ApiProperty({ description: '요청 경로', example: '/api/mission/999' })
  path: string;

  @ApiProperty({ description: '응답 생성 시각', example: '2024-01-01T00:00:00.000Z' })
  timestamp: string;
}

/**
 * 409 Conflict 응답 DTO
 */
export class ConflictResponseDto {
  @ApiProperty({ description: '응답 성공 여부', example: false })
  success: boolean;

  @ApiProperty({ description: 'HTTP 상태 코드', example: 409 })
  statusCode: number;

  @ApiProperty({ description: '에러 메시지', example: '이미 존재하는 데이터입니다.' })
  message: string;

  @ApiProperty({ description: '에러 타입', example: 'Conflict' })
  error: string;

  @ApiProperty({ description: '요청 경로', example: '/api/auth/signup' })
  path: string;

  @ApiProperty({ description: '응답 생성 시각', example: '2024-01-01T00:00:00.000Z' })
  timestamp: string;
}

/**
 * 500 Internal Server Error 응답 DTO
 */
export class InternalServerErrorResponseDto {
  @ApiProperty({ description: '응답 성공 여부', example: false })
  success: boolean;

  @ApiProperty({ description: 'HTTP 상태 코드', example: 500 })
  statusCode: number;

  @ApiProperty({ description: '에러 메시지', example: '서버 오류가 발생했습니다.' })
  message: string;

  @ApiProperty({ description: '에러 타입', example: 'Internal Server Error' })
  error: string;

  @ApiProperty({ description: '요청 경로', example: '/api/mission' })
  path: string;

  @ApiProperty({ description: '응답 생성 시각', example: '2024-01-01T00:00:00.000Z' })
  timestamp: string;
}