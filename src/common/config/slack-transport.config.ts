import * as winston from 'winston';
import * as Transport from 'winston-transport';
import * as os from 'os';
import axios from 'axios';
import { shouldSendSlackAlert } from './slack-alert.policy';

/**
 * Slack Transport 설정
 *
 * ERROR 레벨 이상의 로그를 Slack으로 전송
 *
 * 수집 정보:
 * - 환경 (development/production)
 * - 서버 정보 (hostname, port)
 * - 에러 엔드포인트 및 메서드
 * - 에러 body 값
 * - 에러 내용 및 스택 트레이스
 * - 타이밍 정보 (timestamp, duration)
 * - 사용자 정보 (userId)
 * - 요청 추적 (requestId)
 * - 응답 정보 (statusCode)
 */

// 환경 변수
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || '';
const SLACK_ENABLED = process.env.SLACK_NOTIFICATION_ENABLED === 'true';
const NODE_ENV = process.env.NODE_ENV || 'development';
const SERVER_PORT = process.env.PORT || '3000';
const PROJECT_NAME = process.env.PROJECT_NAME || 'biocom-bo-api';

/**
 * 민감정보 마스킹
 */
function maskSensitiveData(data: any): any {
  if (!data || typeof data !== 'object') return data;

  const sensitiveFields = ['password', 'token', 'authorization', 'apiKey', 'secret'];
  const masked = { ...data };

  for (const key in masked) {
    if (sensitiveFields.some(field => key.toLowerCase().includes(field))) {
      masked[key] = '***MASKED***';
    } else if (typeof masked[key] === 'object') {
      masked[key] = maskSensitiveData(masked[key]);
    }
  }

  return masked;
}

/**
 * Slack 메시지 포맷터
 */
function formatSlackMessage(info: any): any {
  const {
    level,
    message,
    timestamp,
    context,
    trace,
    // 요청 정보
    method,
    url,
    endpoint = url, // url을 endpoint로 매핑
    body,
    query,
    params,
    // 응답 정보
    statusCode,
    // 타이밍
    requestDuration,
    // 사용자
    userId,
    userRole,
    // 추적
    requestId,
    correlationId,
    // 네트워크
    ip,
    userAgent,
    // 서버
    hostname = os.hostname(),
    port = SERVER_PORT,
    environment = NODE_ENV,
  } = info;

  // 상태 코드에 따른 이모지 (5xx: 🔴 서버에러, 4xx: 🟠 클라이언트에러)
  const emoji = statusCode >= 500 ? '🔴' : '🟠';

  // 타임스탬프 KST 변환
  const kstTimestamp = new Date(timestamp).toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  // 에러 요약 (프로젝트명 + 환경 포함)
  const errorSummary = `${emoji} *[${PROJECT_NAME}/${environment}]* ${message}`;

  // Slack Attachment Fields
  const fields: any[] = [
    {
      title: '프로젝트',
      value: PROJECT_NAME,
      short: true,
    },
    {
      title: '환경',
      value: environment,
      short: true,
    },
    {
      title: '서버',
      value: `${hostname}:${port}`,
      short: true,
    },
  ];

  // 요청 정보 (서버와 같은 줄)
  if (method && endpoint) {
    fields.push({
      title: '엔드포인트',
      value: `${method} ${endpoint}`,
      short: true,
    });
  }

  // 요청 ID
  if (requestId) {
    fields.push({
      title: 'Request ID',
      value: `\`${requestId}\``,
      short: true,
    });
  }

  // 사용자 정보
  if (userId) {
    fields.push({
      title: '사용자',
      value: `ID: ${userId}${userRole ? ` (${userRole})` : ''}`,
      short: true,
    });
  }

  // 상태 코드
  if (statusCode) {
    fields.push({
      title: 'Status Code',
      value: String(statusCode),
      short: true,
    });
  }

  // 응답 시간
  if (requestDuration) {
    const isTimeout = requestDuration > 10000;
    fields.push({
      title: '응답 시간',
      value: `${requestDuration}ms${isTimeout ? ' ⏱️ TIMEOUT' : ''}`,
      short: true,
    });
  }

  // 타임스탬프
  fields.push({
    title: '발생 시각 (KST)',
    value: kstTimestamp,
    short: false,
  });

  // 요청 Body (마스킹 처리)
  if (body && Object.keys(body).length > 0) {
    const maskedBody = maskSensitiveData(body);
    fields.push({
      title: 'Request Body',
      value: `\`\`\`${JSON.stringify(maskedBody, null, 2).substring(0, 500)}\`\`\``,
      short: false,
    });
  }

  // 스택 트레이스 (trace 필드 사용)
  if (trace) {
    fields.push({
      title: 'Stack Trace',
      value: `\`\`\`${trace.substring(0, 1000)}\`\`\``,
      short: false,
    });
  }

  // 컨텍스트 정보
  if (context) {
    fields.push({
      title: 'Context',
      value: context,
      short: true,
    });
  }

  return {
    text: errorSummary,
    attachments: [
      {
        color: level === 'error' ? 'danger' : 'warning',
        fields,
        footer: 'Biocom API Error Monitor',
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  };
}

/**
 * 커스텀 Slack Transport 클래스
 */
class SlackTransport extends Transport {
  private webhookUrl: string;

  constructor(opts: any) {
    super(opts);
    this.webhookUrl = opts.webhookUrl;
  }

  async log(info: any, callback: () => void) {
    setImmediate(() => {
      this.emit('logged', info);
    });

    // error 레벨만 Slack으로 전송
    if (info.level !== 'error') {
      callback();
      return;
    }

    // 알림 정책 기반 필터링
    // - 상태 코드 (401, 403, 404, 405 등)
    // - 경로 패턴 (스캐닝 봇, VPN 장비 스캔 등)
    // - 메시지 패턴 (CORS violation, Cannot GET 등)
    if (!shouldSendSlackAlert({
      statusCode: info.statusCode,
      url: info.url,
      message: info.message,
      error: info.error,
    })) {
      callback();
      return;
    }

    try {
      const slackMessage = formatSlackMessage(info);

      await axios.post(this.webhookUrl, slackMessage, {
        headers: { 'Content-Type': 'application/json' },
        timeout: 5000,
      });

      console.log('✅ Slack 에러 알림 전송 성공');
    } catch (error) {
      // Slack 전송 실패는 조용히 무시 (로깅 시스템이 에러를 발생시키면 안됨)
      console.error('❌ Slack 알림 전송 실패:', error.message);
    }

    callback();
  }
}

/**
 * Slack Transport 인스턴스 생성
 */
export function createSlackTransport(): winston.transport | null {
  // local 환경에서는 슬랙 알림 비활성화
  if (NODE_ENV === 'local') {
    return null;
  }

  // Slack 알림이 비활성화되었거나 Webhook URL이 없으면 null 반환
  if (!SLACK_ENABLED || !SLACK_WEBHOOK_URL) {
    console.log('⚠️  Slack 알림이 비활성화되어 있습니다.');
    return null;
  }

  try {
    return new SlackTransport({
      webhookUrl: SLACK_WEBHOOK_URL,
      level: 'error',
    });
  } catch (error) {
    console.error('❌ Slack Transport 생성 실패:', error);
    return null;
  }
}

/**
 * Slack Transport 설정 정보
 */
export const slackTransportConfig = {
  enabled: SLACK_ENABLED,
  webhookUrl: SLACK_WEBHOOK_URL ? '***CONFIGURED***' : 'NOT_SET',
  level: 'error',
};
