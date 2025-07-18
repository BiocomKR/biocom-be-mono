import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';

/**
 * HTTP 예외 필터
 * HttpException을 처리하여 일관된 응답 형식 제공
 * 
 * 주로 다음과 같은 예외 처리:
 * - UnauthorizedException (401)
 * - ForbiddenException (403)
 * - NotFoundException (404)
 * - ConflictException (409)
 * - 기타 HTTP 예외
 */
@Catch(HttpException)
export class HttpExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(HttpExceptionFilter.name);

  catch(exception: HttpException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    // 에러 메시지 추출
    let message = exception.message;
    let error = exception.name;
    let details: any = undefined;

    if (typeof exceptionResponse === 'object' && exceptionResponse !== null) {
      message = (exceptionResponse as any).message || message;
      error = (exceptionResponse as any).error || error;
      details = (exceptionResponse as any).details;
    }

    // 상태 코드별 기본 메시지
    const statusMessages: { [key: number]: string } = {
      400: '잘못된 요청입니다.',
      401: '인증이 필요합니다.',
      403: '접근 권한이 없습니다.',
      404: '요청한 리소스를 찾을 수 없습니다.',
      409: '리소스 충돌이 발생했습니다.',
      422: '처리할 수 없는 요청입니다.',
      429: '너무 많은 요청을 보냈습니다.',
      500: '서버 내부 오류가 발생했습니다.',
    };

    // 메시지가 기본 에러명과 같으면 상태 코드별 메시지 사용
    if (message === error && statusMessages[status]) {
      message = statusMessages[status];
    }

    // 에러 로깅
    this.logger.warn(
      `HTTP Exception - [${request.method}] ${request.url} - ${status} ${error}`,
      {
        message,
        details,
        user: (request as any).user?.id,
        ip: request.ip,
      },
    );

    // 응답 생성
    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      error,
      details,
      timestamp: new Date().toISOString(),
      path: request.url,
    });
  }
}