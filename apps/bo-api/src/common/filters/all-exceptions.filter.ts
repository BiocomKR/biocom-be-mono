import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Injectable,
} from '@nestjs/common';
import { HttpAdapterHost } from '@nestjs/core';
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library';
import { getNowKST } from '../utils/kst-date.util';
import { LoggerService } from '../services/logger.service';

/**
 * 전역 예외 필터
 * 모든 예외를 캐치하여 일관된 형식으로 응답
 *
 * 처리하는 예외 유형:
 * - HttpException: NestJS 표준 HTTP 예외
 * - PrismaClientKnownRequestError: Prisma ORM 예외
 * - 기타 모든 예외
 */
@Injectable()
@Catch()
export class AllExceptionsFilter implements ExceptionFilter {
  constructor(
    private readonly httpAdapterHost: HttpAdapterHost,
    private readonly logger: LoggerService,
  ) {}

  catch(exception: unknown, host: ArgumentsHost): void {
    const { httpAdapter } = this.httpAdapterHost;
    const ctx = host.switchToHttp();
    const request = ctx.getRequest();

    // 기본 에러 정보
    let statusCode = HttpStatus.INTERNAL_SERVER_ERROR;
    let message = '서버 내부 오류가 발생했습니다.';
    let error = 'Internal Server Error';
    let details: any = undefined;

    // HttpException 처리
    if (exception instanceof HttpException) {
      statusCode = exception.getStatus();
      const response = exception.getResponse();
      
      if (typeof response === 'string') {
        message = response;
      } else if (typeof response === 'object' && response !== null) {
        message = (response as any).message || message;
        error = (response as any).error || exception.name;
        details = (response as any).details;
      }
    }
    // Prisma 에러 처리
    else if (exception instanceof PrismaClientKnownRequestError) {
      switch (exception.code) {
        case 'P2002':
          statusCode = HttpStatus.CONFLICT;
          message = '이미 존재하는 데이터입니다.';
          error = 'Conflict';
          details = {
            field: exception.meta?.target,
            code: exception.code,
          };
          break;
        case 'P2025':
          statusCode = HttpStatus.NOT_FOUND;
          message = '요청한 리소스를 찾을 수 없습니다.';
          error = 'Not Found';
          break;
        case 'P2003':
          statusCode = HttpStatus.BAD_REQUEST;
          message = '외래 키 제약 조건 위반입니다.';
          error = 'Foreign Key Constraint Violation';
          break;
        default:
          message = '데이터베이스 오류가 발생했습니다.';
          details = {
            code: exception.code,
            meta: exception.meta,
          };
      }
    }
    // 기타 에러
    else if (exception instanceof Error) {
      message = exception.message;
      error = exception.name;
    }

    // 에러 로깅 (Winston + Slack으로 전송)
    const responseTime = (request as any).responseTime;
    this.logger.logException(
      `[${request.method}] ${request.url} - ${statusCode} ${error}: ${message}`,
      exception instanceof Error ? exception.stack : String(exception),
      {
        statusCode,
        error,
        message,
        details,
        method: request.method,
        url: request.url,
        ip: request.ip,
        userAgent: request.headers['user-agent'],
        userId: (request as any).user?.id,
        requestId: (request as any).id,
        body: request.body,
        requestDuration: responseTime,
      },
    );

    // 응답 생성
    const responseBody = {
      success: false,
      statusCode,
      message,
      error,
      details,
      timestamp: getNowKST().toISOString(),
      path: request.url,
    };

    // 개발 환경에서는 스택 트레이스 포함
    if (process.env.NODE_ENV === 'development' && exception instanceof Error) {
      (responseBody as any).stack = exception.stack;
    }

    httpAdapter.reply(ctx.getResponse(), responseBody, statusCode);
  }
}