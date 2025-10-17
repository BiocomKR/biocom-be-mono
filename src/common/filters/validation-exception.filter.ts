import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { Response } from 'express';
import { getNowKST } from '../utils/kst-date.util';

/**
 * Validation 예외 필터
 * class-validator의 유효성 검사 실패 시 발생하는 BadRequestException을 처리
 * 
 * 더 읽기 쉬운 에러 메시지 형식으로 변환
 */
@Catch(BadRequestException)
export class ValidationExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(ValidationExceptionFilter.name);

  catch(exception: BadRequestException, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest();
    const status = exception.getStatus();
    const exceptionResponse = exception.getResponse();

    let message = '입력값 검증에 실패했습니다.';
    let errors: any[] = [];

    // Validation 에러 처리
    if (typeof exceptionResponse === 'object' && 'message' in exceptionResponse) {
      const messages = (exceptionResponse as any).message;
      
      if (Array.isArray(messages)) {
        // class-validator 에러 메시지 파싱
        errors = messages.map(msg => {
          if (typeof msg === 'string') {
            // "property.constraint" 형식 파싱
            const parts = msg.split(' ');
            const field = parts[0];
            const constraint = parts.slice(1).join(' ');
            
            return {
              field,
              message: constraint,
            };
          }
          return msg;
        });

        // 사용자 친화적인 메시지 생성
        if (errors.length === 1) {
          message = errors[0].message || message;
        } else {
          message = `${errors.length}개의 유효성 검사 오류가 발생했습니다.`;
        }
      } else if (typeof messages === 'string') {
        message = messages;
      }
    }

    // 에러 로깅
    this.logger.warn(
      `Validation failed - [${request.method}] ${request.url}`,
      {
        errors,
        body: request.body,
      },
    );

    // 응답 생성
    response.status(status).json({
      success: false,
      statusCode: status,
      message,
      error: 'Validation Error',
      errors,
      timestamp: getNowKST().toISOString(),
      path: request.url,
    });
  }
}