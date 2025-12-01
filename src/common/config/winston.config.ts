import * as winston from 'winston';
import * as DailyRotateFile from 'winston-daily-rotate-file';
import { join } from 'path';
import { createSlackTransport } from './slack-transport.config';

/**
 * Winston Logger 설정
 * 콘솔과 파일에 로그를 기록
 * 
 * 특징:
 * - 일별 로그 파일 로테이션
 * - 로그 레벨별 파일 분리 (error는 별도 파일)
 * - 외부 디렉토리에 로그 저장
 * - JSON 형식으로 구조화된 로그
 */

// 로그 경로 (환경변수 또는 기본값)
const LOG_PATH = process.env.LOG_PATH || './logs';
const LOG_LEVEL = process.env.LOG_LEVEL || 'info';
const LOG_MAX_DAYS = process.env.LOG_MAX_DAYS || '30';

// 로그 포맷 정의
const logFormat = winston.format.combine(
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
  }),
  winston.format.errors({ stack: true }),
  winston.format.splat(),
  winston.format.json(),
);

// 개발 환경용 콘솔 포맷 (색상 포함)
const consoleFormat = winston.format.combine(
  winston.format.colorize(),
  winston.format.timestamp({
    format: 'YYYY-MM-DD HH:mm:ss',
  }),
  winston.format.printf(({ timestamp, level, message, context, ...meta }) => {
    const metaString = Object.keys(meta).length ? JSON.stringify(meta) : '';
    return `${timestamp} [${context || 'Application'}] ${level}: ${message} ${metaString}`;
  }),
);

// Daily Rotate File 공통 설정
const dailyRotateOptions = {
  dirname: LOG_PATH,
  datePattern: 'YYYY-MM-DD',
  maxSize: '20m',
  maxFiles: LOG_MAX_DAYS + 'd',
  format: logFormat,
  auditFile: join(LOG_PATH, 'audit', 'log-audit.json'),
};

// Transports 배열 생성
const transports: winston.transport[] = [
  // 콘솔 출력 (개발 환경)
  new winston.transports.Console({
    format: process.env.NODE_ENV === 'production' ? logFormat : consoleFormat,
  }),

  // 전체 로그 파일 (info 레벨 이상)
  new DailyRotateFile({
    ...dailyRotateOptions,
    filename: 'application-%DATE%.log',
    level: 'info',
  }),

  // 에러 로그 파일 (error 레벨만)
  new DailyRotateFile({
    ...dailyRotateOptions,
    filename: 'error-%DATE%.log',
    level: 'error',
  }),
];

// Slack Transport 추가 (설정되어 있을 경우)
const slackTransport = createSlackTransport();
if (slackTransport) {
  transports.push(slackTransport);
  if (process.env.NODE_ENV !== 'local') {
    console.log('✅ Slack 에러 알림이 활성화되었습니다.');
  }
}

// Winston Logger 인스턴스 생성
export const winstonLogger = winston.createLogger({
  level: LOG_LEVEL,
  format: logFormat,
  defaultMeta: { service: 'nestjs-app' },
  transports,
  
  // 처리되지 않은 예외 처리
  exceptionHandlers: [
    new DailyRotateFile({
      ...dailyRotateOptions,
      filename: 'exceptions-%DATE%.log',
    }),
  ],
  
  // 처리되지 않은 Promise rejection 처리
  rejectionHandlers: [
    new DailyRotateFile({
      ...dailyRotateOptions,
      filename: 'rejections-%DATE%.log',
    }),
  ],
});

// 로그 디렉토리 생성 확인 메시지
if (process.env.NODE_ENV !== 'local') {
  console.log(`📝 로그 파일 저장 경로: ${LOG_PATH}`);
  console.log(`📊 로그 레벨: ${LOG_LEVEL}`);
  console.log(`📅 로그 보관 기간: ${LOG_MAX_DAYS}일`);
}

/**
 * NestJS용 Winston 설정 옵션
 * instance 방식 대신 transports, format 등을 직접 전달
 */
export const winstonConfig = {
  level: LOG_LEVEL,
  format: logFormat,
  defaultMeta: { service: 'nestjs-app' },
  transports,
  exceptionHandlers: [
    new DailyRotateFile({
      ...dailyRotateOptions,
      filename: 'exceptions-%DATE%.log',
    }),
  ],
  rejectionHandlers: [
    new DailyRotateFile({
      ...dailyRotateOptions,
      filename: 'rejections-%DATE%.log',
    }),
  ],
};