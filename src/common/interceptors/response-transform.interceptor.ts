import {
  Injectable,
  NestInterceptor,
  ExecutionContext,
  CallHandler,
} from '@nestjs/common';
import { Observable } from 'rxjs';
import { map } from 'rxjs/operators';
import { Request } from 'express';

/**
 * API 응답 형식 인터페이스
 */
export interface ApiResponse<T> {
  success: boolean;
  statusCode: number;
  message?: string;
  data?: T;
  timestamp: string;
  path: string;
  requestId?: string;
}

/**
 * 응답 변환 인터셉터
 * 모든 성공 응답을 일관된 형식으로 변환
 * 
 * 변환 형식:
 * {
 *   success: true,
 *   statusCode: 200,
 *   data: { ... },
 *   timestamp: "2024-01-01T00:00:00.000Z",
 *   path: "/api/v1/users",
 *   requestId: "req_123456"
 * }
 */
@Injectable()
export class ResponseTransformInterceptor<T>
  implements NestInterceptor<T, ApiResponse<T>>
{
  intercept(
    context: ExecutionContext,
    next: CallHandler,
  ): Observable<ApiResponse<T>> {
    const ctx = context.switchToHttp();
    const request = ctx.getRequest<Request>();
    const response = ctx.getResponse();
    
    return next.handle().pipe(
      map((data) => {
        // Health check 엔드포인트는 변환하지 않음
        if (request.path.includes('/health')) {
          return data;
        }

        // 이미 ApiResponse 형식인 경우 그대로 반환
        if (data && typeof data === 'object' && 'success' in data) {
          return data;
        }

        // 표준 응답 형식으로 변환
        const transformedResponse: ApiResponse<T> = {
          success: true,
          statusCode: response.statusCode || 200,
          data,
          timestamp: new Date().toISOString(),
          path: request.path,
        };

        // Request ID가 있으면 추가
        const requestId = request.headers['x-request-id'] as string;
        if (requestId) {
          transformedResponse.requestId = requestId;
        }

        // 특정 상황에 대한 메시지 추가
        if (response.statusCode === 201) {
          transformedResponse.message = '리소스가 성공적으로 생성되었습니다.';
        } else if (response.statusCode === 204) {
          transformedResponse.message = '요청이 성공적으로 처리되었습니다.';
        }

        return transformedResponse;
      }),
    );
  }
}