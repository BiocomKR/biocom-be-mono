/**
 * 백오피스 피드백 슬랙 알림 유틸리티
 *
 * 백오피스 사용자가 개선사항을 등록하면 슬랙으로 알림
 */
import axios from 'axios';

// 환경 변수
const SLACK_FEEDBACK_WEBHOOK_URL = process.env.SLACK_FEEDBACK_WEBHOOK_URL || '';
const NODE_ENV = process.env.NODE_ENV || 'dev';
const PROJECT_NAME = 'biocom-bo-api';

// 카테고리 한글 매핑
const CATEGORY_KO: Record<string, string> = {
  BUG: '버그',
  FEATURE: '기능 요청',
  UI: 'UI/UX',
  OTHER: '기타',
};

interface FeedbackData {
  category: string;
  content: string;
  fileCount?: number;
}

/**
 * 피드백 슬랙 알림 전송
 */
export async function sendFeedbackSlackNotification(
  data: FeedbackData,
): Promise<void> {
  // 슬랙 웹훅 URL이 없으면 스킵
  if (!SLACK_FEEDBACK_WEBHOOK_URL) {
    console.log('⚠️ SLACK_FEEDBACK_WEBHOOK_URL이 설정되지 않아 슬랙 알림을 건너뜁니다.');
    return;
  }

  // local 환경에서는 스킵
  if (NODE_ENV === 'local') {
    return;
  }

  const timestamp = new Date().toLocaleString('ko-KR', {
    timeZone: 'Asia/Seoul',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  });

  const categoryKo = CATEGORY_KO[data.category] || data.category;

  const fields: any[] = [
    {
      title: '카테고리',
      value: categoryKo,
      short: true,
    },
    {
      title: '환경',
      value: NODE_ENV,
      short: true,
    },
    {
      title: '내용',
      value: data.content.length > 500 ? `${data.content.substring(0, 500)}...` : data.content,
      short: false,
    },
    {
      title: '접수 시각 (KST)',
      value: timestamp,
      short: false,
    },
  ];

  // 첨부파일이 있으면 표시
  if (data.fileCount && data.fileCount > 0) {
    fields.splice(2, 0, {
      title: '첨부파일',
      value: `${data.fileCount}개`,
      short: true,
    });
  }

  const payload = {
    text: `📝 *[${PROJECT_NAME}/${NODE_ENV}]* 백오피스 개선사항 접수`,
    attachments: [
      {
        color: '#3498db', // 파란색
        fields,
        footer: 'Biocom BO Feedback',
        ts: Math.floor(Date.now() / 1000),
      },
    ],
  };

  try {
    await axios.post(SLACK_FEEDBACK_WEBHOOK_URL, payload, {
      headers: { 'Content-Type': 'application/json' },
      timeout: 5000,
    });
    console.log('✅ 슬랙 피드백 알림 전송 성공');
  } catch (error: any) {
    // 슬랙 전송 실패는 조용히 무시 (피드백 등록에 영향 주면 안됨)
    console.error(`❌ 슬랙 피드백 알림 전송 실패: ${error.message}`);
  }
}
