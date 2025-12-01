import { ApiProperty } from '@nestjs/swagger';

/**
 * 회원가입 응답 데이터 DTO
 */
export class SignUpResponseDataDto {
  @ApiProperty({
    description: '사용자 ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '이메일',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: '사용자 이름',
    example: '홍길동',
  })
  name: string;

  @ApiProperty({
    description: '휴대폰 번호',
    example: '010-1234-5678',
  })
  mobile: string;

  @ApiProperty({
    description: '가입일시',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;
}

/**
 * 로그인 사용자 정보 DTO
 */
export class SignInUserDto {
  @ApiProperty({
    description: '사용자 ID',
    example: 1,
  })
  id: number;

  @ApiProperty({
    description: '이메일',
    example: 'user@example.com',
  })
  email: string;

  @ApiProperty({
    description: '사용자 이름',
    example: '홍길동',
  })
  name: string;

  @ApiProperty({
    description: '휴대폰 번호',
    example: '010-1234-5678',
  })
  mobile: string;

  @ApiProperty({
    description: '닉네임',
    example: 'nickname123',
    required: false,
  })
  nickname?: string;

  @ApiProperty({
    description: '가입일시',
    example: '2024-01-01T00:00:00.000Z',
  })
  createdAt: Date;
}

/**
 * 로그인 응답 데이터 DTO
 */
export class SignInResponseDataDto {
  @ApiProperty({
    description: '사용자 정보',
    type: SignInUserDto,
  })
  user: SignInUserDto;

  @ApiProperty({
    description: 'JWT 액세스 토큰',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'Refresh Token',
    example: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6',
  })
  refreshToken: string;
}

/**
 * 회원가입 응답 DTO (accessToken, refreshToken 포함)
 */
export class SignUpAuthResponseDataDto {
  @ApiProperty({
    description: '사용자 정보',
    type: SignUpResponseDataDto,
  })
  user: SignUpResponseDataDto;

  @ApiProperty({
    description: 'JWT 액세스 토큰',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'Refresh Token',
    example: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6',
  })
  refreshToken: string;
}

/**
 * 회원가입 성공 응답 DTO
 */
export class SignUpResponseDto {
  @ApiProperty({
    description: '응답 성공 여부',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: '응답 메시지',
    example: '회원가입이 완료되었습니다.',
  })
  message: string;

  @ApiProperty({
    description: '응답 데이터',
    type: SignUpAuthResponseDataDto,
  })
  data: SignUpAuthResponseDataDto;

  @ApiProperty({
    description: '응답 생성 시각',
    example: '2024-01-01T00:00:00.000Z',
  })
  timestamp: Date;
}

/**
 * 로그인 성공 응답 DTO
 */
export class SignInResponseDto {
  @ApiProperty({
    description: '응답 성공 여부',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: '응답 메시지',
    example: '로그인되었습니다.',
  })
  message: string;

  @ApiProperty({
    description: '응답 데이터',
    type: SignInResponseDataDto,
  })
  data: SignInResponseDataDto;

  @ApiProperty({
    description: '응답 생성 시각',
    example: '2024-01-01T00:00:00.000Z',
  })
  timestamp: Date;
}

/**
 * 인증 실패 응답 DTO (401)
 */
export class UnauthorizedResponseDto {
  @ApiProperty({
    description: '응답 성공 여부',
    example: false,
  })
  success: boolean;

  @ApiProperty({
    description: 'HTTP 상태 코드',
    example: 401,
  })
  statusCode: number;

  @ApiProperty({
    description: '에러 메시지',
    example: '이메일 또는 비밀번호가 올바르지 않습니다.',
  })
  message: string;

  @ApiProperty({
    description: '에러 타입',
    example: 'Unauthorized',
  })
  error: string;

  @ApiProperty({
    description: '요청 경로',
    example: '/api/auth/signin',
  })
  path: string;

  @ApiProperty({
    description: '응답 생성 시각',
    example: '2024-01-01T00:00:00.000Z',
  })
  timestamp: string;
}

/**
 * 토큰 갱신 응답 데이터 DTO
 */
export class RefreshTokenDataDto {
  @ApiProperty({
    description: 'JWT 액세스 토큰',
    example: 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...',
  })
  accessToken: string;

  @ApiProperty({
    description: 'Refresh Token',
    example: 'a1b2c3d4e5f6g7h8i9j0k1l2m3n4o5p6q7r8s9t0u1v2w3x4y5z6',
  })
  refreshToken: string;
}

/**
 * 토큰 갱신 성공 응답 DTO
 */
export class RefreshTokenResponseDto {
  @ApiProperty({
    description: '응답 성공 여부',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: '응답 메시지',
    example: '토큰이 갱신되었습니다.',
  })
  message: string;

  @ApiProperty({
    description: '응답 데이터',
    type: RefreshTokenDataDto,
  })
  data: RefreshTokenDataDto;

  @ApiProperty({
    description: '응답 생성 시각',
    example: '2024-01-01T00:00:00.000Z',
  })
  timestamp: Date;
}

/**
 * 로그아웃 응답 데이터 DTO
 */
export class LogoutDataDto {
  @ApiProperty({
    description: '로그아웃 메시지',
    example: '로그아웃되었습니다.',
  })
  message: string;
}

/**
 * 로그아웃 성공 응답 DTO
 */
export class LogoutResponseDto {
  @ApiProperty({
    description: '응답 성공 여부',
    example: true,
  })
  success: boolean;

  @ApiProperty({
    description: '응답 메시지',
    example: '로그아웃되었습니다.',
  })
  message: string;

  @ApiProperty({
    description: '응답 데이터',
    type: LogoutDataDto,
  })
  data: LogoutDataDto;

  @ApiProperty({
    description: '응답 생성 시각',
    example: '2024-01-01T00:00:00.000Z',
  })
  timestamp: Date;
}

/**
 * 입력값 검증 실패 응답 DTO (400)
 */
export class ValidationErrorResponseDto {
  @ApiProperty({
    description: '응답 성공 여부',
    example: false,
  })
  success: boolean;

  @ApiProperty({
    description: 'HTTP 상태 코드',
    example: 400,
  })
  statusCode: number;

  @ApiProperty({
    description: '에러 메시지 (배열 형태)',
    example: [
      '올바른 이메일 형식이 아닙니다.',
      '비밀번호는 최소 8자 이상이어야 합니다.',
    ],
  })
  message: string[];

  @ApiProperty({
    description: '에러 타입',
    example: 'Bad Request',
  })
  error: string;

  @ApiProperty({
    description: '요청 경로',
    example: '/api/auth/signup',
  })
  path: string;

  @ApiProperty({
    description: '응답 생성 시각',
    example: '2024-01-01T00:00:00.000Z',
  })
  timestamp: string;
}

/**
 * 중복 데이터 에러 응답 DTO (409)
 */
export class ConflictErrorResponseDto {
  @ApiProperty({
    description: '응답 성공 여부',
    example: false,
  })
  success: boolean;

  @ApiProperty({
    description: 'HTTP 상태 코드',
    example: 409,
  })
  statusCode: number;

  @ApiProperty({
    description: '에러 메시지',
    example: '이미 사용 중인 이메일입니다.',
  })
  message: string;

  @ApiProperty({
    description: '에러 타입',
    example: 'Conflict',
  })
  error: string;

  @ApiProperty({
    description: '요청 경로',
    example: '/api/auth/signup',
  })
  path: string;

  @ApiProperty({
    description: '응답 생성 시각',
    example: '2024-01-01T00:00:00.000Z',
  })
  timestamp: string;
}