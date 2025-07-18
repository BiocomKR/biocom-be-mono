import { CorsOptions } from '@nestjs/common/interfaces/external/cors-options.interface';
import { ConfigService } from '../services/config.service';
import { LoggerService } from '../services/logger.service';

/**
 * CORS 설정 팩토리
 * 환경별로 다른 CORS 정책을 적용
 * 
 * 보안 고려사항:
 * - Production: 명시적인 도메인만 허용
 * - Development: localhost 허용
 * - 민감한 헤더 노출 제한
 */
export const createCorsOptions = (
  configService: ConfigService,
  logger?: LoggerService,
): CorsOptions => {
  const corsOrigin = configService.cors.origin;
  const isProduction = configService.app.isProduction;
  
  // 허용된 도메인 목록
  const allowedOrigins = corsOrigin.split(',').map(origin => origin.trim());
  
  const corsOptions: CorsOptions = {
    // Origin 검증 함수
    origin: (origin, callback) => {
      // origin이 없는 경우 (같은 도메인 요청)
      if (!origin) {
        if (isProduction) {
          // 프로덕션에서는 같은 도메인 요청만 허용
          callback(null, true);
        } else {
          // 개발 환경에서는 허용
          callback(null, true);
        }
        return;
      }

      // 와일드카드 처리
      if (allowedOrigins.includes('*')) {
        if (isProduction) {
          logger?.warn('프로덕션 환경에서 CORS 와일드카드(*) 사용 중 - 보안 위험!');
        }
        callback(null, true);
        return;
      }

      // 정규식 패턴 지원 (예: /^https:\/\/.*\.example\.com$/)
      const isAllowed = allowedOrigins.some(allowed => {
        if (allowed.startsWith('/') && allowed.endsWith('/')) {
          // 정규식 패턴
          const regex = new RegExp(allowed.slice(1, -1));
          return regex.test(origin);
        }
        // 정확한 매치
        return allowed === origin;
      });

      if (isAllowed) {
        callback(null, true);
      } else {
        logger?.warn(`CORS 거부: ${origin} - 허용된 origin이 아닙니다.`);
        callback(new Error('CORS policy violation'));
      }
    },

    // 자격 증명 포함 여부
    credentials: configService.cors.credentials,

    // 허용할 HTTP 메서드
    methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],

    // 허용할 헤더
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-Requested-With',
      'X-User-Email', // 레거시 지원
      'X-API-Key',
    ],

    // 클라이언트에 노출할 헤더
    exposedHeaders: [
      'X-Request-Id',
      'X-RateLimit-Limit',
      'X-RateLimit-Remaining',
      'X-RateLimit-Reset',
    ],

    // Preflight 요청 캐시 시간 (초)
    maxAge: isProduction ? 86400 : 3600, // 프로덕션: 24시간, 개발: 1시간

    // OPTIONS 요청에 대한 성공 상태 코드
    optionsSuccessStatus: 204,
  };

  return corsOptions;
};

/**
 * 환경별 CORS 설정 예시
 */
export const corsConfigExamples = {
  // 개발 환경 설정
  development: {
    CORS_ORIGIN: 'http://localhost:3000,http://localhost:3001,http://127.0.0.1:3000',
    CORS_CREDENTIALS: 'true',
  },

  // 스테이징 환경 설정
  staging: {
    CORS_ORIGIN: 'https://staging.example.com,https://staging-admin.example.com',
    CORS_CREDENTIALS: 'true',
  },

  // 프로덕션 환경 설정
  production: {
    CORS_ORIGIN: 'https://example.com,https://www.example.com,https://admin.example.com',
    CORS_CREDENTIALS: 'true',
  },

  // 서브도메인 와일드카드 (정규식)
  subdomainWildcard: {
    CORS_ORIGIN: '/^https:\\/\\/.*\\.example\\.com$/',
    CORS_CREDENTIALS: 'true',
  },

  // 여러 도메인 허용
  multiDomain: {
    CORS_ORIGIN: 'https://app1.com,https://app2.com,https://app3.com',
    CORS_CREDENTIALS: 'true',
  },
};

/**
 * CORS 에러 메시지
 */
export const corsErrorMessages = {
  originNotAllowed: 'The CORS policy for this site does not allow access from the specified Origin.',
  credentialsNotSupported: 'CORS policy: Credentials are not supported for wildcard origin.',
  methodNotAllowed: 'The specified HTTP method is not allowed.',
  headerNotAllowed: 'The specified header is not allowed.',
};