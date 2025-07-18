import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { LoggerService } from '../services/logger.service';
import { Request, Response } from 'express';

/**
 * 로깅 인터셉터
 * 모든 HTTP 요청/응답을 자동으로 로깅
 * 
 * 로깅 정보:
 * - HTTP 메서드, URL, 상태 코드
 * - 응답 시간
 * - 클라이언트 IP, User-Agent
 * - 인증된 사용자 ID
 */
@Injectable()
export class LoggingInterceptor implements NestInterceptor {
  constructor(private readonly logger: LoggerService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    
    // 요청 시작 시간
    const startTime = Date.now();
    
    // 요청 정보
    const { method, url, ip, headers } = request;
    const userAgent = headers['user-agent'] || '';
    const userId = (request as any).user?.id;

    // 요청 로깅
    this.logger.debug(`Incoming request`, 'HTTP', {
      method,
      url,
      ip,
      userAgent: userAgent.substring(0, 100), // User-Agent 길이 제한
      userId,
    });

    return next.handle().pipe(
      tap({
        next: () => {
          // 성공 응답 로깅
          const responseTime = Date.now() - startTime;
          const { statusCode } = response;
          
          this.logger.logRequest(
            method,
            url,
            statusCode,
            responseTime,
            ip,
            userAgent.substring(0, 100),
            userId,
          );
        },
        error: (error) => {
          // 에러 응답 로깅
          const responseTime = Date.now() - startTime;
          const statusCode = error.status || 500;
          
          this.logger.error(
            `Request failed: ${error.message}`,
            error.stack,
            'HTTP',
          );
          
          this.logger.logRequest(
            method,
            url,
            statusCode,
            responseTime,
            ip,
            userAgent.substring(0, 100),
            userId,
          );
        },
      }),
    );
  }
}