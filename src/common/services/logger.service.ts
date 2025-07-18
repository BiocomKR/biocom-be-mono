import { Injectable, Inject, LoggerService as NestLoggerService } from '@nestjs/common';
import { WINSTON_MODULE_PROVIDER } from 'nest-winston';
import { Logger } from 'winston';

/**
 * Logger 서비스
 * Winston Logger를 래핑하여 NestJS에서 사용하기 쉽게 만든 서비스
 * 
 * 사용법:
 * constructor(private readonly logger: LoggerService) {}
 * this.logger.log('메시지', 'ContextName');
 */
@Injectable()
export class LoggerService implements NestLoggerService {
  constructor(
    @Inject(WINSTON_MODULE_PROVIDER) private readonly logger: Logger,
  ) {}

  /**
   * 일반 로그 (info 레벨)
   */
  log(message: any, context?: string, meta?: any): void {
    this.logger.info(message, { context, ...meta });
  }

  /**
   * 에러 로그
   */
  error(message: any, trace?: string, context?: string): void {
    const meta: any = { context };
    if (trace) {
      meta.trace = trace;
    }
    this.logger.error(message, meta);
  }

  /**
   * 경고 로그
   */
  warn(message: any, context?: string, meta?: any): void {
    this.logger.warn(message, { context, ...meta });
  }

  /**
   * 디버그 로그 (개발 환경)
   */
  debug(message: any, context?: string, meta?: any): void {
    this.logger.debug(message, { context, ...meta });
  }

  /**
   * 상세 로그
   */
  verbose(message: any, context?: string, meta?: any): void {
    this.logger.verbose(message, { context, ...meta });
  }

  /**
   * HTTP 요청 로깅
   */
  logRequest(
    method: string,
    url: string,
    statusCode: number,
    responseTime: number,
    ip?: string,
    userAgent?: string,
    userId?: number,
  ): void {
    this.logger.info('HTTP Request', {
      context: 'HTTP',
      method,
      url,
      statusCode,
      responseTime: `${responseTime}ms`,
      ip,
      userAgent,
      userId,
    });
  }

  /**
   * 데이터베이스 쿼리 로깅
   */
  logQuery(query: string, params?: any[], duration?: number): void {
    this.logger.debug('Database Query', {
      context: 'Database',
      query,
      params,
      duration: duration ? `${duration}ms` : undefined,
    });
  }

  /**
   * 비즈니스 이벤트 로깅
   */
  logEvent(eventName: string, data?: any, userId?: number): void {
    this.logger.info(`Business Event: ${eventName}`, {
      context: 'BusinessEvent',
      eventName,
      data,
      userId,
    });
  }

  /**
   * 보안 이벤트 로깅
   */
  logSecurity(event: string, details: any, severity: 'low' | 'medium' | 'high' | 'critical'): void {
    const level = severity === 'critical' || severity === 'high' ? 'error' : 'warn';
    this.logger.log(level, `Security Event: ${event}`, {
      context: 'Security',
      event,
      severity,
      details,
    });
  }
}