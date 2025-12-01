import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable, of } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request } from 'express';

/**
 * 캐시 키 생성 인터페이스
 */
export interface CacheKeyGenerator {
  (context: ExecutionContext): string;
}

/**
 * 캐시 인터셉터
 * 메모리 기반 간단한 캐싱 구현
 * 
 * 주의사항:
 * - 프로덕션에서는 Redis 등 외부 캐시 스토리지 사용 권장
 * - 메모리 캐시는 서버 재시작 시 초기화됨
 * - 멀티 인스턴스 환경에서는 각 인스턴스별로 독립적인 캐시
 * 
 * 사용 예:
 * @UseInterceptors(new CacheInterceptor(300)) // 5분 캐싱
 * @Get('expensive-operation')
 * getExpensiveData() { ... }
 */
@Injectable()
export class CacheInterceptor implements NestInterceptor {
  private cache = new Map<string, { data: any; timestamp: number }>();
  
  constructor(
    private readonly ttl: number = 300, // 기본 5분 (초 단위)
    private readonly keyGenerator?: CacheKeyGenerator,
  ) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    
    // GET 요청만 캐싱
    if (request.method !== 'GET') {
      return next.handle();
    }
    
    // 캐시 키 생성
    const cacheKey = this.generateCacheKey(context);
    
    // 캐시 확인
    const cached = this.cache.get(cacheKey);
    if (cached && this.isValid(cached)) {
      // 캐시 히트
      const response = ctx.getResponse();
      response.setHeader('X-Cache', 'HIT');
      response.setHeader('X-Cache-TTL', this.ttl.toString());
      return of(cached.data);
    }
    
    // 캐시 미스 - 실제 핸들러 실행
    return next.handle().pipe(
      tap((data) => {
        // 응답 캐싱
        this.cache.set(cacheKey, {
          data,
          timestamp: Date.now(),
        });
        
        const response = ctx.getResponse();
        response.setHeader('X-Cache', 'MISS');
        response.setHeader('X-Cache-TTL', this.ttl.toString());
        
        // 캐시 크기 제한 (메모리 보호)
        this.cleanupCache();
      }),
    );
  }

  /**
   * 캐시 키 생성
   */
  private generateCacheKey(context: ExecutionContext): string {
    if (this.keyGenerator) {
      return this.keyGenerator(context);
    }
    
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    
    // 기본 키: 메서드 + URL + 쿼리 파라미터
    const { method, url, query } = request;
    const userId = (request as any).user?.id || 'anonymous';
    
    return `${method}:${url}:${JSON.stringify(query)}:${userId}`;
  }

  /**
   * 캐시 유효성 검증
   */
  private isValid(cached: { data: any; timestamp: number }): boolean {
    const now = Date.now();
    const age = (now - cached.timestamp) / 1000; // 초 단위
    return age < this.ttl;
  }

  /**
   * 캐시 정리 (메모리 보호)
   * 만료된 항목 제거 및 최대 크기 제한
   */
  private cleanupCache(): void {
    const now = Date.now();
    const maxCacheSize = 1000; // 최대 1000개 항목
    
    // 만료된 항목 제거
    for (const [key, value] of this.cache.entries()) {
      if (!this.isValid(value)) {
        this.cache.delete(key);
      }
    }
    
    // 크기 제한 초과 시 오래된 항목부터 제거
    if (this.cache.size > maxCacheSize) {
      const entries = Array.from(this.cache.entries());
      entries.sort((a, b) => a[1].timestamp - b[1].timestamp);
      
      const toRemove = entries.slice(0, entries.length - maxCacheSize);
      toRemove.forEach(([key]) => this.cache.delete(key));
    }
  }

  /**
   * 캐시 수동 초기화
   */
  clearCache(): void {
    this.cache.clear();
  }

  /**
   * 특정 키 캐시 제거
   */
  invalidate(key: string): void {
    this.cache.delete(key);
  }

  /**
   * 패턴과 일치하는 캐시 제거
   */
  invalidatePattern(pattern: RegExp): void {
    for (const key of this.cache.keys()) {
      if (pattern.test(key)) {
        this.cache.delete(key);
      }
    }
  }
}