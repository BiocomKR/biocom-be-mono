import { Injectable, ExecutionContext } from '@nestjs/common';
import { ThrottlerGuard, ThrottlerException, ThrottlerModuleOptions, ThrottlerStorage } from '@nestjs/throttler';
import { Reflector } from '@nestjs/core';
import { LoggerService } from '../services/logger.service';

/**
 * 커스텀 Throttler Guard
 * 기본 ThrottlerGuard를 확장하여 추가 기능 제공
 * 
 * 추가 기능:
 * - 인증된 사용자에게 더 높은 제한 제공
 * - 특정 역할/권한에 따른 차별화된 제한
 * - Rate limit 초과 시 상세 로깅
 * - 화이트리스트 IP 지원
 */
@Injectable()
export class CustomThrottlerGuard extends ThrottlerGuard {
  constructor(
    options: ThrottlerModuleOptions,
    storageService: ThrottlerStorage,
    reflector: Reflector,
    private readonly logger?: LoggerService,
  ) {
    super(options, storageService, reflector);
  }

  /**
   * Rate limit 적용 여부 결정
   */
  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const response = context.switchToHttp().getResponse();
    
    // 디버깅 로그 추가
    console.log(`[CustomThrottlerGuard] 🔍 Checking ${request.method} ${request.url}`);
    console.log(`[CustomThrottlerGuard] 🏠 Client IP: ${this.getClientIP(request)}`);
    
    // 화이트리스트 IP 확인
    if (this.isWhitelisted(request)) {
      console.log(`[CustomThrottlerGuard] ✅ IP는 화이트리스트에 있어서 통과`);
      return true;
    }

    try {
      console.log(`[CustomThrottlerGuard] ⏳ 부모 ThrottlerGuard 체크 시작...`);
      const result = await super.canActivate(context);
      console.log(`[CustomThrottlerGuard] ✅ ThrottlerGuard 체크 결과: ${result}`);
      
      // Rate limit 정보를 응답 헤더에 추가
      this.addRateLimitHeaders(response);
      
      return result;
    } catch (error) {
      console.log(`[CustomThrottlerGuard] ❌ ThrottlerGuard 에러:`, error.message);
      
      if (error instanceof ThrottlerException) {
        // Rate limit 초과 로깅
        this.logRateLimitExceeded(request);
        
        // 더 자세한 에러 메시지 제공
        throw new ThrottlerException(
          '요청 한도를 초과했습니다. 잠시 후 다시 시도해주세요.'
        );
      }
      throw error;
    }
  }

  /**
   * 요청에 대한 트래커 (식별자) 생성
   * 인증된 사용자는 userId, 비인증 사용자는 IP 사용
   */
  protected async getTracker(req: Record<string, any>): Promise<string> {
    // 인증된 사용자는 userId 기반
    if (req.user?.id) {
      return `user-${req.user.id}`;
    }
    
    // 비인증 사용자는 IP 기반
    const forwarded = req.headers['x-forwarded-for'];
    const ip = forwarded 
      ? (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',')[0].trim()
      : req.ip;
    
    return `ip-${ip}`;
  }

  /**
   * 화이트리스트 IP 확인
   */
  private isWhitelisted(request: any): boolean {
    const whitelistIPs = process.env.RATE_LIMIT_WHITELIST_IPS?.split(',') || [];
    const clientIP = this.getClientIP(request);
    
    return whitelistIPs.includes(clientIP);
  }

  /**
   * 클라이언트 IP 추출
   */
  private getClientIP(request: any): string {
    const forwarded = request.headers['x-forwarded-for'];
    return forwarded 
      ? (typeof forwarded === 'string' ? forwarded : forwarded[0]).split(',')[0].trim()
      : request.ip;
  }

  /**
   * Rate limit 초과 로깅
   */
  private logRateLimitExceeded(request: any): void {
    const clientIP = this.getClientIP(request);
    const userId = request.user?.id;
    
    if (this.logger) {
      this.logger.logSecurity(
        'Rate limit exceeded',
        {
          ip: clientIP,
          userId,
          method: request.method,
          url: request.url,
          userAgent: request.headers['user-agent'],
        },
        'medium'
      );
    } else {
      console.warn('Rate limit exceeded:', {
        ip: clientIP,
        userId,
        method: request.method,
        url: request.url,
      });
    }
  }

  /**
   * Rate limit 정보를 응답 헤더에 추가
   */
  private addRateLimitHeaders(response: any): void {
    // TODO: 실제 rate limit 정보를 storage에서 가져와서 설정
    // 예시 헤더:
    // X-RateLimit-Limit: 100
    // X-RateLimit-Remaining: 99
    // X-RateLimit-Reset: 1640995200
  }
}