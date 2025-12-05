import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { tap } from 'rxjs/operators';
import { Request, Response } from 'express';
import { PrismaService } from '../services/prisma.service';
import { getNowKST } from '../utils/kst-date.util';

/**
 * 민감 필드 마스킹 대상
 */
const SENSITIVE_FIELDS = [
  'password',
  'token',
  'secret',
  'accessToken',
  'refreshToken',
  'apiKey',
  'authorization',
];

/**
 * 로깅 제외 경로
 */
const EXCLUDED_PATHS = [
  '/api/health',
  '/api/docs',
];

/**
 * 민감 정보 마스킹 함수
 */
function maskSensitiveData(obj: any): any {
  if (!obj || typeof obj !== 'object') return obj;

  const masked: any = Array.isArray(obj) ? [] : {};

  for (const [key, value] of Object.entries(obj)) {
    const lowerKey = key.toLowerCase();

    if (SENSITIVE_FIELDS.some(field => lowerKey.includes(field.toLowerCase()))) {
      masked[key] = '***';
    } else if (value && typeof value === 'object') {
      masked[key] = maskSensitiveData(value);
    } else {
      masked[key] = value;
    }
  }

  return masked;
}

/**
 * 관리자 활동 로그 인터셉터
 * 인증된 모든 API 요청을 DB에 기록
 *
 * 기록 대상:
 * - 인증된 모든 요청 (GET/POST/PUT/DELETE)
 * - 비인증 요청은 제외 (헬스체크 등)
 *
 * 기록 정보:
 * - HTTP 메서드, URL, 상태 코드
 * - 응답 시간
 * - 클라이언트 IP, User-Agent
 * - Request Body (민감 정보 마스킹)
 */
@Injectable()
export class ActivityLogInterceptor implements NestInterceptor {
  constructor(private readonly prisma: PrismaService) {}

  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();

    const startTime = Date.now();
    const { method, url, ip, headers, body } = request;
    const userAgent = headers['user-agent'] || '';
    const operator = (request as any).user;

    // 제외 경로 체크
    if (EXCLUDED_PATHS.some(path => url.startsWith(path))) {
      return next.handle();
    }

    // 인증되지 않은 GET 요청은 제외
    if (!operator && method === 'GET') {
      return next.handle();
    }

    return next.handle().pipe(
      tap({
        next: () => {
          this.saveActivityLog({
            operatorId: operator?.id || null,
            method,
            path: url,
            statusCode: response.statusCode,
            ip: this.getClientIp(request),
            userAgent,
            requestBody: body && Object.keys(body).length > 0
              ? JSON.stringify(maskSensitiveData(body))
              : null,
            duration: Date.now() - startTime,
          });
        },
        error: (error) => {
          const statusCode = error.status || error.statusCode || 500;
          this.saveActivityLog({
            operatorId: operator?.id || null,
            method,
            path: url,
            statusCode,
            ip: this.getClientIp(request),
            userAgent,
            requestBody: body && Object.keys(body).length > 0
              ? JSON.stringify(maskSensitiveData(body))
              : null,
            duration: Date.now() - startTime,
          });
        },
      }),
    );
  }

  /**
   * 클라이언트 IP 추출 (프록시 고려)
   */
  private getClientIp(request: Request): string {
    const forwarded = request.headers['x-forwarded-for'];
    if (forwarded) {
      const ips = Array.isArray(forwarded) ? forwarded[0] : forwarded;
      return ips.split(',')[0].trim();
    }
    return request.ip || request.socket.remoteAddress || '';
  }

  /**
   * 활동 로그 DB 저장 (비동기, 에러 무시)
   */
  private async saveActivityLog(data: {
    operatorId: number | null;
    method: string;
    path: string;
    statusCode: number;
    ip: string;
    userAgent: string;
    requestBody: string | null;
    duration: number;
  }): Promise<void> {
    try {
      await this.prisma.operatorActivityLog.create({
        data: {
          operatorId: data.operatorId,
          method: data.method,
          path: data.path.substring(0, 255),
          statusCode: data.statusCode,
          ip: data.ip?.substring(0, 45) || null,
          userAgent: data.userAgent || null,
          requestBody: data.requestBody,
          duration: data.duration,
          createdAt: getNowKST(),
        },
      });
    } catch (error) {
      // 로그 저장 실패는 무시 (메인 로직에 영향 주지 않음)
      console.error('Failed to save activity log:', error);
    }
  }
}
