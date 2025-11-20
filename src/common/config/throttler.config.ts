import { ThrottlerModuleOptions } from '@nestjs/throttler';

/**
 * Rate Limiting 설정
 * API 남용을 방지하기 위한 요청 제한 설정
 * 
 * 기본 정책:
 * - 60초 동안 10개의 요청 허용 (환경변수로 설정 가능)
 * - IP 기반으로 제한
 * - 특정 엔드포인트는 별도 설정 가능
 */
export const throttlerConfig: ThrottlerModuleOptions = {
  throttlers: [
    {
      name: 'short',
      ttl: parseInt(process.env.RATE_LIMIT_TTL || '60', 10) * 1000,
      limit: parseInt(process.env.RATE_LIMIT_LIMIT || '10', 10),
    },
  ],
};

/**
 * 엔드포인트별 Rate Limit 설정 예시
 */
export const rateLimitConfig = {
  // 로그인 엔드포인트: 5분에 5번
  login: {
    ttl: 300,
    limit: 5,
  },
  
  // 회원가입 엔드포인트: 1시간에 3번
  signup: {
    ttl: 3600,
    limit: 3,
  },
  
  // 파일 업로드: 1분에 5번
  upload: {
    ttl: 60,
    limit: 5,
  },
  
  // 비밀번호 재설정: 1시간에 3번
  passwordReset: {
    ttl: 3600,
    limit: 3,
  },
  
  // API 키 생성: 하루에 5번
  apiKeyGeneration: {
    ttl: 86400,
    limit: 5,
  },

  // 푸시 알림 전송: 1분에 10번 (개인 테스트용)
  pushTest: {
    ttl: 60,
    limit: 10,
  },

  // 푸시 알림 다중 전송: 1분에 10번 (관리자용 - 테스트 환경)
  pushBatch: {
    ttl: 60,
    limit: 10,
  },

  // 푸시 전체 발송: 5분에 5번 (관리자용 - 테스트 환경)
  pushBroadcast: {
    ttl: 300,
    limit: 5,
  },

  // 푸시 토큰 등록: 1분에 20번 (자동 로그인 고려)
  pushTokenRegister: {
    ttl: 60,
    limit: 20,
  },
};