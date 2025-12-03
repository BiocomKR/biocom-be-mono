import * as Joi from 'joi';

/**
 * 환경변수 검증 스키마
 * 애플리케이션 시작 시 필수 환경변수를 검증
 * 
 * 검증 실패 시 애플리케이션이 시작되지 않음
 */
export const validationSchema = Joi.object({
  // 애플리케이션 설정
  NODE_ENV: Joi.string()
    .valid('development', 'production', 'local')
    .default('development')
    .description('애플리케이션 실행 환경'),
    
  PORT: Joi.number()
    .port()
    .default(3000)
    .description('서버 포트 번호'),

  // 데이터베이스 설정
  DATABASE_URL: Joi.string()
    .required()
    .pattern(/^postgresql:\/\//)
    .description('PostgreSQL 연결 문자열'),

  // JWT 설정
  JWT_SECRET: Joi.string()
    .required()
    .min(32)
    .description('JWT 서명 키 (최소 32자)'),
    
  JWT_ACCESS_TOKEN_EXPIRES_IN: Joi.string()
    .default('20m')
    .pattern(/^\d+[hdm]$/)
    .description('Access Token 만료 시간'),
    
  JWT_REFRESH_TOKEN_EXPIRES_IN: Joi.string()
    .default('180d')
    .pattern(/^\d+[hdm]$/)
    .description('Refresh Token 만료 시간'),
    
  JWT_REFRESH_TOKEN_SECRET: Joi.string()
    .required()
    .min(32)
    .description('Refresh Token 서명 키'),

  // 로깅 설정
  LOG_PATH: Joi.string()
    .default('/var/log/nestjs-app')
    .description('로그 파일 저장 경로'),
    
  LOG_LEVEL: Joi.string()
    .valid('error', 'warn', 'info', 'debug', 'verbose')
    .default('info')
    .description('로그 레벨'),
    
  LOG_MAX_DAYS: Joi.number()
    .integer()
    .min(1)
    .max(365)
    .default(30)
    .description('로그 파일 보관 기간 (일)'),

  // Rate Limiting 설정
  RATE_LIMIT_TTL: Joi.number()
    .integer()
    .min(1)
    .default(60)
    .description('Rate Limiting 시간 창 (초)'),
    
  RATE_LIMIT_LIMIT: Joi.number()
    .integer()
    .min(1)
    .default(10)
    .description('시간 창 내 최대 요청 수'),
    
  RATE_LIMIT_WHITELIST_IPS: Joi.string()
    .allow('')
    .pattern(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3},?)*$/)
    .description('Rate Limiting 제외 IP 목록 (콤마 구분)'),

  // 파일 업로드 설정
  UPLOAD_PATH: Joi.string()
    .default('./uploads')
    .description('파일 업로드 경로'),
    
  MAX_FILE_SIZE: Joi.number()
    .integer()
    .min(1)
    .default(10 * 1024 * 1024) // 10MB
    .description('최대 파일 크기 (바이트)'),
    
  ALLOWED_FILE_TYPES: Joi.string()
    .default('jpg,jpeg,png,gif,pdf,doc,docx')
    .description('허용된 파일 확장자 (콤마 구분)'),

  // CORS 설정
  CORS_ORIGIN: Joi.string()
    .default('*')
    .custom((value, helpers) => {
      // 프로덕션에서 와일드카드 사용 경고
      if (process.env.NODE_ENV === 'production' && value === '*') {
        console.warn('⚠️  경고: 프로덕션 환경에서 CORS 와일드카드(*) 사용 중입니다. 보안 위험이 있습니다!');
      }
      return value;
    })
    .description('CORS 허용 도메인 (콤마 구분 또는 정규식)'),
    
  CORS_CREDENTIALS: Joi.boolean()
    .default(true)
    .description('CORS 자격증명 포함 여부'),

  // 추가 보안 설정
  BCRYPT_ROUNDS: Joi.number()
    .integer()
    .min(10)
    .max(20)
    .default(10)
    .description('Bcrypt 해시 라운드'),
    
  SESSION_SECRET: Joi.string()
    .when('NODE_ENV', {
      is: 'production',
      then: Joi.required(),
      otherwise: Joi.optional().default('dev-session-secret'),
    })
    .description('세션 시크릿 키'),
});

/**
 * 환경변수 타입 정의
 * TypeScript에서 타입 안전성을 위해 사용
 */
export interface EnvironmentVariables {
  // 애플리케이션
  NODE_ENV: 'development' | 'production' | 'local';
  PORT: number;
  
  // 데이터베이스
  DATABASE_URL: string;
  
  // JWT
  JWT_SECRET: string;
  JWT_ACCESS_TOKEN_EXPIRES_IN: string;
  JWT_REFRESH_TOKEN_EXPIRES_IN: string;
  JWT_REFRESH_TOKEN_SECRET: string;
  
  // 로깅
  LOG_PATH: string;
  LOG_LEVEL: 'error' | 'warn' | 'info' | 'debug' | 'verbose';
  LOG_MAX_DAYS: number;
  
  // Rate Limiting
  RATE_LIMIT_TTL: number;
  RATE_LIMIT_LIMIT: number;
  RATE_LIMIT_WHITELIST_IPS?: string;
  
  // 파일 업로드
  UPLOAD_PATH: string;
  MAX_FILE_SIZE: number;
  ALLOWED_FILE_TYPES: string;
  
  // CORS
  CORS_ORIGIN: string;
  CORS_CREDENTIALS: boolean;
  
  // 보안
  BCRYPT_ROUNDS: number;
  SESSION_SECRET?: string;

  // Apple IAP
  APPLE_IAP_PRIVATE_KEY?: string;
  APPLE_IAP_KEY_ID?: string;
  APPLE_IAP_ISSUER_ID?: string;
  APPLE_BUNDLE_ID?: string;

  // Google IAP
  GOOGLE_PACKAGE_NAME?: string;
  GOOGLE_SERVICE_ACCOUNT_EMAIL?: string;
  GOOGLE_SERVICE_ACCOUNT_PRIVATE_KEY?: string;
}

/**
 * 환경변수 설정 팩토리
 * ConfigModule에서 사용
 */
export const configuration = () => ({
  app: {
    env: process.env.NODE_ENV,
    port: parseInt(process.env.PORT, 10) || 3000,
  },
  database: {
    url: process.env.DATABASE_URL,
  },
  jwt: {
    secret: process.env.JWT_SECRET,
    accessTokenExpiresIn: process.env.JWT_ACCESS_TOKEN_EXPIRES_IN,
    refreshTokenExpiresIn: process.env.JWT_REFRESH_TOKEN_EXPIRES_IN,
    refreshTokenSecret: process.env.JWT_REFRESH_TOKEN_SECRET,
  },
  logging: {
    path: process.env.LOG_PATH,
    level: process.env.LOG_LEVEL,
    maxDays: parseInt(process.env.LOG_MAX_DAYS, 10),
  },
  rateLimit: {
    ttl: parseInt(process.env.RATE_LIMIT_TTL, 10),
    limit: parseInt(process.env.RATE_LIMIT_LIMIT, 10),
    whitelistIPs: process.env.RATE_LIMIT_WHITELIST_IPS?.split(',').filter(ip => ip),
  },
  upload: {
    path: process.env.UPLOAD_PATH,
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE, 10),
    allowedFileTypes: process.env.ALLOWED_FILE_TYPES?.split(','),
  },
  cors: {
    origin: process.env.CORS_ORIGIN,
    credentials: process.env.CORS_CREDENTIALS === 'true',
  },
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS, 10),
    sessionSecret: process.env.SESSION_SECRET,
  },
});