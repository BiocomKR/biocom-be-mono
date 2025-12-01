import { HttpException, HttpStatus } from '@nestjs/common';

/**
 * Rate Limit 초과 예외
 * 요청 제한을 초과했을 때 발생하는 예외
 */
export class RateLimitException extends HttpException {
  constructor(
    ttl?: number,
    limit?: number,
    retryAfter?: number,
  ) {
    const message = ttl && limit 
      ? `${ttl}초 동안 최대 ${limit}개의 요청만 가능합니다. ${retryAfter ? `${retryAfter}초 후에 다시 시도해주세요.` : '잠시 후 다시 시도해주세요.'}`
      : '너무 많은 요청을 보냈습니다. 잠시 후 다시 시도해주세요.';
    
    super(
      {
        success: false,
        message,
        error: 'Too Many Requests',
        errorCode: 'RATE_LIMIT_EXCEEDED',
        details: {
          ttl,
          limit,
          retryAfter,
        },
        statusCode: HttpStatus.TOO_MANY_REQUESTS,
      },
      HttpStatus.TOO_MANY_REQUESTS,
    );
  }
}