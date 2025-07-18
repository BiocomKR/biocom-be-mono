import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { Request, Response } from 'express';
import { v4 as uuidv4 } from 'uuid';

/**
 * Request ID 인터셉터
 * 각 요청에 고유한 ID를 부여하여 로그 추적 및 디버깅 용이성 향상
 * 
 * 동작:
 * 1. 클라이언트가 X-Request-ID 헤더를 보내면 그대로 사용
 * 2. 없으면 UUID v4로 새로 생성
 * 3. 응답 헤더에 X-Request-ID 추가
 * 
 * 사용 예:
 * - 분산 시스템에서 요청 추적
 * - 로그 분석 시 특정 요청의 전체 플로우 추적
 * - 에러 발생 시 관련 로그 쉽게 찾기
 */
@Injectable()
export class RequestIdInterceptor implements NestInterceptor {
  intercept(context: ExecutionContext, next: CallHandler): Observable<any> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse<Response>();
    
    // 요청 ID 생성 또는 기존 ID 사용
    let requestId = request.headers['x-request-id'] as string;
    
    if (!requestId) {
      // UUID v4 형식으로 생성 (예: req_550e8400-e29b-41d4-a716-446655440000)
      requestId = `req_${uuidv4()}`;
    }
    
    // 요청 객체에 requestId 추가 (다른 곳에서 사용 가능)
    (request as any).requestId = requestId;
    
    // 응답 헤더에 Request ID 추가
    response.setHeader('X-Request-Id', requestId);
    
    // Express의 locals에도 저장 (미들웨어에서 사용 가능)
    response.locals.requestId = requestId;
    
    return next.handle();
  }
}