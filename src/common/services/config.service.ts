import { Injectable } from '@nestjs/common';
import { ConfigService as NestConfigService } from '@nestjs/config';
import { EnvironmentVariables } from '../config/env.validation';

/**
 * 타입 안전한 설정 서비스
 * @nestjs/config의 ConfigService를 래핑하여 타입 안전성 제공
 * 
 * 사용 예:
 * constructor(private readonly configService: ConfigService) {}
 * const jwtSecret = this.configService.jwt.secret;
 */
@Injectable()
export class ConfigService {
  constructor(
    private readonly nestConfigService: NestConfigService<EnvironmentVariables>,
  ) {}

  /**
   * 애플리케이션 설정
   */
  get app() {
    return {
      env: this.nestConfigService.get('NODE_ENV', { infer: true }),
      port: this.nestConfigService.get('PORT', { infer: true }),
      isProduction: this.nestConfigService.get('NODE_ENV') === 'production',
      isDevelopment: this.nestConfigService.get('NODE_ENV') === 'development',
      isTest: this.nestConfigService.get('NODE_ENV') === 'local',
    };
  }

  /**
   * 데이터베이스 설정
   */
  get database() {
    return {
      url: this.nestConfigService.get('DATABASE_URL', { infer: true }),
    };
  }

  /**
   * JWT 설정
   */
  get jwt() {
    return {
      secret: this.nestConfigService.get('JWT_SECRET', { infer: true }),
      accessTokenExpiresIn: this.nestConfigService.get('JWT_ACCESS_TOKEN_EXPIRES_IN', { infer: true }),
      refreshTokenExpiresIn: this.nestConfigService.get('JWT_REFRESH_TOKEN_EXPIRES_IN', { infer: true }),
      refreshTokenSecret: this.nestConfigService.get('JWT_REFRESH_TOKEN_SECRET', { infer: true }),
      // 기존 expiresIn 유지 (하위 호환성)
      expiresIn: this.nestConfigService.get('JWT_ACCESS_TOKEN_EXPIRES_IN', { infer: true }),
    };
  }

  /**
   * 로깅 설정
   */
  get logging() {
    return {
      path: this.nestConfigService.get('LOG_PATH', { infer: true }),
      level: this.nestConfigService.get('LOG_LEVEL', { infer: true }),
      maxDays: this.nestConfigService.get('LOG_MAX_DAYS', { infer: true }),
    };
  }

  /**
   * Rate Limiting 설정
   */
  get rateLimit() {
    return {
      ttl: this.nestConfigService.get('RATE_LIMIT_TTL', { infer: true }),
      limit: this.nestConfigService.get('RATE_LIMIT_LIMIT', { infer: true }),
      whitelistIPs: this.nestConfigService.get('RATE_LIMIT_WHITELIST_IPS', { infer: true })?.split(',').filter(ip => ip) || [],
    };
  }

  /**
   * 파일 업로드 설정
   */
  get upload() {
    return {
      path: this.nestConfigService.get('UPLOAD_PATH', { infer: true }),
      maxFileSize: this.nestConfigService.get('MAX_FILE_SIZE', { infer: true }),
      allowedFileTypes: this.nestConfigService.get('ALLOWED_FILE_TYPES', { infer: true })?.split(',') || [],
    };
  }

  /**
   * CORS 설정
   */
  get cors() {
    return {
      origin: this.nestConfigService.get('CORS_ORIGIN', { infer: true }),
      credentials: this.nestConfigService.get('CORS_CREDENTIALS', { infer: true }),
    };
  }

  /**
   * 보안 설정
   */
  get security() {
    return {
      bcryptRounds: this.nestConfigService.get('BCRYPT_ROUNDS', { infer: true }),
      sessionSecret: this.nestConfigService.get('SESSION_SECRET', { infer: true }),
    };
  }

  /**
   * 전체 설정 객체 반환
   * 디버깅이나 설정 확인용
   */
  get all() {
    return {
      app: this.app,
      database: this.database,
      jwt: this.jwt,
      logging: this.logging,
      rateLimit: this.rateLimit,
      upload: this.upload,
      cors: this.cors,
      security: this.security,
    };
  }

  /**
   * 원본 ConfigService 접근
   * 직접 환경변수에 접근이 필요한 경우 사용
   */
  get raw() {
    return this.nestConfigService;
  }
}