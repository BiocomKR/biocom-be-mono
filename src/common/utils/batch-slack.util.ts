/**
 * 배치 슬랙 알림 유틸리티
 *
 * Kubernetes CronJob으로 실행되는 배치의 시작/완료/실패를 슬랙으로 알림
 */
import axios from 'axios';

// 환경 변수
const SLACK_WEBHOOK_URL = process.env.SLACK_WEBHOOK_URL || '';
const NODE_ENV = process.env.NODE_ENV || 'dev';
const PROJECT_NAME = 'biocom-api';

// 배치명 한글 매핑
const BATCH_NAME_KO: Record<string, string> = {
  'expire-challenges': '챌린지 만료 처리',
  'activate-challenges': '챌린지 활성화',
  'create-weekly-supplements': '영양제 주간 생성',
  'check-push-schedules': '푸시 스케줄 확인',
  'iap-acknowledge-retry': 'Google IAP 재시도',
  'sync-shipping-status': '배송 상태 동기화',
  'retry-logistics': '물류 주문 재시도',
  'expire-coupons': '쿠폰 만료 처리',
  'sib-health-check': 'SIB API 헬스체크',
};

interface BatchResult {
  successCount?: number;
  failCount?: number;
  totalCount?: number;
  error?: string;
  stack?: string;
}

/**
 * 배치 슬랙 알림 전송
 */
export async function sendBatchSlackNotification(
  type: 'start' | 'success' | 'fail' | 'warning',
  batchName: string,
  result?: BatchResult,
): Promise<void> {
  // 슬랙 웹훅 URL이 없으면 스킵
  if (!SLACK_WEBHOOK_URL) {
    console.log('⚠️ SLACK_WEBHOOK_URL이 설정되지 않아 슬랙 알림을 건너뜁니다.');
    return;
  }

  const batchNameKo = BATCH_NAME_KO[batchName] || batchName;
  const timestamp = new Date().toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  let emoji: string;
  let color: string;
  let title: string;

  switch (type) {
    case 'start':
      emoji = '🕐';
      color = '#3498db'; // 파란색
      title = `${emoji} [${PROJECT_NAME}/${NODE_ENV}] 배치 시작: ${batchNameKo}`;
      break;
    case 'success':
      emoji = '✅';
      color = '#2ecc71'; // 초록색
      title = `${emoji} [${PROJECT_NAME}/${NODE_ENV}] 배치 완료: ${batchNameKo}`;
      break;
    case 'fail':
      emoji = '❌';
      color = '#e74c3c'; // 빨간색
      title = `${emoji} [${PROJECT_NAME}/${NODE_ENV}] 배치 실패: ${batchNameKo}`;
      break;
    case 'warning':
      emoji = '⚠️';
      color = '#f39c12'; // 주황색
      title = `${emoji} [${PROJECT_NAME}/${NODE_ENV}] 배치 경고: ${batchNameKo}`;
      break;
  }

  const fields: any[] = [
    {
      title: '배치명',
      value: batchNameKo,
      short: true,
    },
    {
      title: '환경',
      value: NODE_ENV,
      short: true,
    },
    {
      title: '실행 시각 (KST)',
      value: timestamp,
      short: false,
    },
  ];

  // 결과 정보 추가
  if (result) {
    if (result.successCount !== undefined || result.failCount !== undefined) {
      fields.push({
        title: '처리 결과',
        value: `성공: ${result.successCount ?? 0}건, 실패: ${result.failCount ?? 0}건${result.totalCount ? ` (총 ${result.totalCount}건)` : ''}`,
        short: false,
      });
    }

    if (result.error) {
      fields.push({
        title: '에러 메시지',
        value: `\`\`\`${result.error.substring(0, 500)}\`\`\``,
        short: false,
      });
    }

    if (result.stack) {
      fields.push({
        title: 'Stack Trace',
        value: `\`\`\`${result.stack.substring(0, 1000)}\`\`\``,
        short: false,
      });
    }
  }

  const payload = {
    text: title,
    attachments: [
      {
        color,
        fields,
        footer: 'Biocom Batch Monitor',
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  };

  try {
    await axios.post(SLACK_WEBHOOK_URL, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000,
    });
    console.log(`✅ 슬랙 배치 알림 전송 성공: ${type} - ${batchName}`);
  } catch (error: any) {
    // 슬랙 전송 실패는 조용히 무시 (배치 실행에 영향 주면 안됨)
    console.error(`❌ 슬랙 배치 알림 전송 실패: ${error.message}`);
  }
}
