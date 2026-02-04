import { SetMetadata } from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';

/**
 * Rate Limit 커스텀 설정 데코레이터
 * 특정 엔드포인트에 대해 다른 rate limit 설정 적용
 * 
 * @param ttl 시간 창 (초)
 * @param limit 시간 창 내 최대 요청 수
 * 
 * 사용 예:
 * @RateLimit(300, 5) // 5분에 5번
 * login() { ... }
 */
export const RateLimit = (ttl: number, limit: number) => {
  return Throttle({ default: { ttl, limit } });
};

/**
 * 로그인 엔드포인트용 Rate Limit
 * 5분에 5번 시도 가능
 */
export const LoginRateLimit = () => RateLimit(300, 5);

/**
 * 회원가입 엔드포인트용 Rate Limit
 * 1시간에 3번 시도 가능
 */
export const SignupRateLimit = () => RateLimit(3600, 3);

/**
 * 파일 업로드용 Rate Limit
 * 1분에 5번 업로드 가능
 */
export const UploadRateLimit = () => RateLimit(60, 5);

/**
 * 비밀번호 재설정용 Rate Limit
 * 1시간에 3번 시도 가능
 */
export const PasswordResetRateLimit = () => RateLimit(3600, 3);

/**
 * API 호출용 일반 Rate Limit
 * 1분에 60번 호출 가능
 */
export const ApiRateLimit = () => RateLimit(60, 60);

/**
 * Premium 사용자용 Rate Limit
 * 1분에 300번 호출 가능
 */
export const PremiumRateLimit = () => RateLimit(60, 300);