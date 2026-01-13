import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

/**
 * CSV에서 PushNotificationSchedule 데이터를 파싱하여 DB에 삽입하는 스크립트
 *
 * 실행 방법:
 * npx ts-node prisma/operation/seed-push-schedules.ts          # dry-run (JSON 출력만)
 * npx ts-node prisma/operation/seed-push-schedules.ts --execute # 실제 DB 삽입
 */

// =====================================================
// 타입 정의
// =====================================================

interface CsvRow {
  기간_및_대상: string;
  상황: string;
  조건: string;
  세부_조건_1: string;
  세부_조건_2: string;
  발송_시점: string;
  랜딩_위치: string;
  스텔라: string;
  메이브: string;
  헤이즐: string;
  이안: string;
  테오: string;
  헨리: string;
  비고: string;
}

interface ScheduleData {
  pushCode: string;
  name: string;
  description: string | null;
  scheduleType: 'RECURRING';
  type: string;
  category: 'AUTO';
  cronExpression: string;
  title: string;
  bodyTemplate: string;
  conditionType: string;
  conditionParams: Record<string, any>;
  landingType: string;
  landingParams: Record<string, any> | null;
  personaMessages: Record<string, { title: string; body: string }>;
  senderType: 'BIOCOM' | 'PERSONA';
  isActive: boolean;
}

// =====================================================
// ConditionType 매핑
// =====================================================

type ConditionType =
  | 'ONBOARDING_STATE'
  | 'CHALLENGE_STATUS'
  | 'CHALLENGE_DAY'
  | 'CHALLENGE_START_OFFSET_DAYS'
  | 'NO_ACCESS_HOURS'
  | 'INCOMPLETE_COUNT'
  | 'INCOMPLETE_TYPES'
  | 'COMPLETION_RATE'
  | 'REPORT_STATE'
  | 'POINTS'
  | 'COUPON_EXPIRING_HOURS'
  | 'CART_HAS_ITEMS';

// =====================================================
// LandingType 매핑
// =====================================================

type LandingType =
  | 'HOME'
  | 'LECTURE'
  | 'MISSION_RECORD'
  | 'SOLUTION'
  | 'CART'
  | 'SURVEY_ONBOARDING'
  | 'SURVEY_TYPE_CLASSIFICATION'
  | 'SURVEY_CHALLENGE_START'
  | 'SURVEY_AFTER'
  | 'PLAYGROUND'
  | 'REPORT';

// =====================================================
// 매핑 함수들
// =====================================================

/**
 * CSV 조건/상황을 ConditionType으로 변환
 */
function parseConditionType(row: CsvRow): { type: ConditionType; params: Record<string, any> } {
  const { 상황, 조건, 세부_조건_1, 세부_조건_2 } = row;

  // 온보딩 관련
  if (상황 === '온보딩') {
    if (조건.includes('결과지 조회') && 세부_조건_1.includes('유형분류 문진 미완료')) {
      return { type: 'ONBOARDING_STATE', params: { state: 'TYPE_SURVEY_INCOMPLETE' } };
    }
    if (세부_조건_1.includes('유형분류 문진 완료') && 세부_조건_2.includes('맞춤 솔루션 조회 미완료')) {
      return { type: 'ONBOARDING_STATE', params: { state: 'SOLUTION_NOT_VIEWED' } };
    }
    if (세부_조건_2.includes('맞춤 솔루션 조회 완료')) {
      return { type: 'ONBOARDING_STATE', params: { state: 'SOLUTION_VIEWED_START_NOT_SET' } };
    }
    if (조건.includes('시작일 지정 완료')) {
      if (세부_조건_1.includes('챌린지 시작 1일 전')) {
        return { type: 'CHALLENGE_START_OFFSET_DAYS', params: { offsetDays: -1 } };
      }
      if (세부_조건_1.includes('챌린지 시작일')) {
        return { type: 'CHALLENGE_DAY', params: { day: 1 } };
      }
    }
  }

  // 오프보딩 (애프터 문진)
  if (상황 === '오프 보딩' || 조건.includes('챌린지 종료 후')) {
    return { type: 'CHALLENGE_STATUS', params: { status: 'COMPLETED', afterSurveyCompleted: false } };
  }

  // 미션 미수행 - 미접속 시간
  if (상황 === '미션 미 수행' || 조건.includes('미접속')) {
    if (세부_조건_2?.includes('24시간 이상 미접속') || 세부_조건_1?.includes('24시간')) {
      return { type: 'NO_ACCESS_HOURS', params: { hours: 24 } };
    }
    if (세부_조건_2?.includes('48시간 이상 미접속') || 세부_조건_1?.includes('48시간')) {
      return { type: 'NO_ACCESS_HOURS', params: { hours: 48 } };
    }
  }

  // 미수행 개수
  if (조건.includes('3개 이상 미수행')) {
    return { type: 'INCOMPLETE_COUNT', params: { minCount: 3 } };
  }
  if (조건.includes('2개 이하 미수행')) {
    return { type: 'INCOMPLETE_COUNT', params: { maxCount: 2, minCount: 1 } };
  }

  // 특정 미션만 미수행 (INCOMPLETE_TYPES)
  const missionTypeMap: Record<string, string> = {
    자기선언문: 'SELF_DECLARATION',
    '나 칭찬하기': 'SELF_PRAISE',
    '데일리 뷰티 문진': 'DAILY_BEAUTY_SURVEY',
    '식단 기록': 'FOOD',
    '영양제 기록': 'SUPPLEMENT',
    '공복 시간 기록': 'FASTING',
    '수면 시간 기록': 'SLEEP',
    '활동 기록': 'ACTIVITY',
    '강의 시청 & 퀴즈 풀기': 'LECTURE',
    '1일 1미션': 'DAILY_MISSION',
    '밸런스 게임': 'BALANCE_GAME',
    '심층 리포트 미확인': 'DEEP_REPORT',
  };

  for (const [csvName, missionType] of Object.entries(missionTypeMap)) {
    if (조건.includes(csvName)) {
      const dayMatch = 세부_조건_1?.match(/(\d+)일차/);
      const day = dayMatch ? parseInt(dayMatch[1], 10) : null;
      const exclusive = 세부_조건_2?.includes('만 미수행') || 세부_조건_1?.includes('만 미수행');

      return {
        type: 'INCOMPLETE_TYPES',
        params: {
          types: [missionType],
          exclusive,
          ...(day && { day }),
        },
      };
    }
  }

  // 참여 독려 - 수행률
  if (상황 === '참여 독려' || 조건.includes('수행률')) {
    const rateMatch = (세부_조건_1 || 조건).match(/수행률\s*(\d+)~(\d+)%/);
    if (rateMatch) {
      const minRate = parseInt(rateMatch[1], 10);
      const maxRate = parseInt(rateMatch[2], 10);
      const dayMatch = (세부_조건_1 || 조건).match(/(\d+)일차/);
      const day = dayMatch ? parseInt(dayMatch[1], 10) : null;

      return {
        type: 'COMPLETION_RATE',
        params: {
          minRate,
          maxRate,
          ...(day && { day }),
        },
      };
    }
  }

  // 포인트/쿠폰
  if (상황?.includes('포인트') || 조건.includes('포인트')) {
    const pointsMatch = (세부_조건_1 || 조건).match(/(\d+[,\d]*)/);
    if (pointsMatch) {
      const points = parseInt(pointsMatch[1].replace(/,/g, ''), 10);
      return { type: 'POINTS', params: { minPoints: points } };
    }
  }

  // 쿠폰 만료 임박
  if (조건.includes('쿠폰') && (조건.includes('만료') || 세부_조건_1?.includes('만료'))) {
    return { type: 'COUPON_EXPIRING_HOURS', params: { hours: 24 } };
  }

  // 장바구니
  if (조건.includes('장바구니')) {
    return { type: 'CART_HAS_ITEMS', params: {} };
  }

  // 챌린지 일차 (기본)
  const dayMatch = (세부_조건_1 || 조건).match(/(\d+)일차/);
  if (dayMatch) {
    return { type: 'CHALLENGE_DAY', params: { day: parseInt(dayMatch[1], 10) } };
  }

  // 기본값
  return { type: 'CHALLENGE_STATUS', params: { status: 'ACTIVE' } };
}

/**
 * 랜딩 위치를 LandingType으로 변환
 */
function parseLandingType(
  landingText: string,
  row: CsvRow,
): { type: LandingType; params: Record<string, any> | null } {
  const text = landingText.toLowerCase();

  if (text.includes('홈') || text.includes('home')) {
    return { type: 'HOME', params: null };
  }

  if (text.includes('유형분류 문진')) {
    return { type: 'SURVEY_TYPE_CLASSIFICATION', params: null };
  }

  if (text.includes('챌린지 시작 온보딩') || text.includes('시작일')) {
    return { type: 'SURVEY_CHALLENGE_START', params: null };
  }

  if (text.includes('맞춤 솔루션')) {
    return { type: 'SOLUTION', params: null };
  }

  if (text.includes('애프터 문진')) {
    return { type: 'SURVEY_AFTER', params: null };
  }

  if (text.includes('강의')) {
    const dayMatch = row.세부_조건_1?.match(/(\d+)일차/);
    const day = dayMatch ? parseInt(dayMatch[1], 10) : null;
    return { type: 'LECTURE', params: day ? { day } : null };
  }

  if (text.includes('미션 기록') || text.includes('해당 일자 미션')) {
    const dayMatch = row.세부_조건_1?.match(/(\d+)일차/);
    const day = dayMatch ? parseInt(dayMatch[1], 10) : null;

    const missionTypeMap: Record<string, string> = {
      자기선언문: 'SELF_DECLARATION',
      '나 칭찬하기': 'SELF_PRAISE',
      '데일리 뷰티': 'DAILY_BEAUTY_SURVEY',
      식단: 'FOOD',
      영양제: 'SUPPLEMENT',
      공복: 'FASTING',
      수면: 'SLEEP',
      활동: 'ACTIVITY',
    };

    let missionType: string | null = null;
    for (const [keyword, type] of Object.entries(missionTypeMap)) {
      if (row.조건.includes(keyword)) {
        missionType = type;
        break;
      }
    }

    return {
      type: 'MISSION_RECORD',
      params: {
        ...(day && { day }),
        ...(missionType && { missionType }),
      },
    };
  }

  if (text.includes('놀이터')) {
    return { type: 'PLAYGROUND', params: null };
  }

  if (text.includes('리포트')) {
    return { type: 'REPORT', params: null };
  }

  if (text.includes('장바구니') || text.includes('cart')) {
    return { type: 'CART', params: null };
  }

  return { type: 'HOME', params: null };
}

/**
 * 발송 시점을 크론 표현식으로 변환
 */
function parseSendTimeToCron(sendTimeText: string): string {
  const text = sendTimeText.toLowerCase();

  if (text.includes('07시') || text.includes('7시')) {
    return '0 7 * * *'; // 매일 07시
  }

  if (text.includes('18시')) {
    return '0 18 * * *'; // 매일 18시
  }

  // 기본값: 18시
  return '0 18 * * *';
}

/**
 * 메시지에서 title과 body 분리
 */
function parseMessage(messageText: string): { title: string; body: string } {
  if (!messageText || messageText.trim() === '') {
    return { title: '', body: '' };
  }

  const lines = messageText.split('\n').filter((line) => line.trim() !== '');

  if (lines.length === 0) {
    return { title: '', body: '' };
  }

  if (lines.length === 1) {
    return { title: lines[0].trim(), body: '' };
  }

  return {
    title: lines[0].trim(),
    body: lines.slice(1).join('\n').trim(),
  };
}

/**
 * pushCode 생성
 */
function generatePushCode(row: CsvRow, index: number): string {
  const parts: string[] = [];

  if (row.상황) {
    const situationMap: Record<string, string> = {
      온보딩: 'ONBOARD',
      '오프 보딩': 'OFFBOARD',
      '미션 미 수행': 'MISSION_INCOMPLETE',
      '참여 독려': 'ENCOURAGE',
      '포인트/쿠폰': 'POINT_COUPON',
    };
    parts.push(situationMap[row.상황] || row.상황.replace(/\s+/g, '_').toUpperCase());
  }

  if (row.조건) {
    const conditionClean = row.조건
      .replace(/[^a-zA-Z0-9가-힣\s]/g, '')
      .replace(/\s+/g, '_')
      .substring(0, 20)
      .toUpperCase();
    parts.push(conditionClean);
  }

  const dayMatch = row.세부_조건_1?.match(/(\d+)일차/);
  if (dayMatch) {
    parts.push(`D${dayMatch[1]}`);
  }

  parts.push(String(index).padStart(3, '0'));

  return parts.join('_');
}

// =====================================================
// CSV 파싱
// =====================================================

function parseCSV(csvContent: string): CsvRow[] {
  const lines = csvContent.split('\n');
  const rows: CsvRow[] = [];

  let i = 1; // 헤더 스킵

  let currentContext = {
    기간_및_대상: '',
    상황: '',
  };

  while (i < lines.length) {
    let line = lines[i];

    // 멀티라인 셀 처리
    if (line.includes('"')) {
      let quoteCount = (line.match(/"/g) || []).length;
      while (quoteCount % 2 !== 0 && i + 1 < lines.length) {
        i++;
        line += '\n' + lines[i];
        quoteCount = (line.match(/"/g) || []).length;
      }
    }

    const cells = parseCSVLine(line);

    if (cells.length >= 13) {
      if (cells[0] && cells[0].trim()) {
        currentContext.기간_및_대상 = cells[0].trim();
      }
      if (cells[1] && cells[1].trim()) {
        currentContext.상황 = cells[1].trim();
      }

      const row: CsvRow = {
        기간_및_대상: currentContext.기간_및_대상,
        상황: currentContext.상황,
        조건: cells[2]?.trim() || '',
        세부_조건_1: cells[3]?.trim() || '',
        세부_조건_2: cells[4]?.trim() || '',
        발송_시점: cells[5]?.trim() || '',
        랜딩_위치: cells[6]?.trim() || '',
        스텔라: cells[7]?.trim() || '',
        메이브: cells[8]?.trim() || '',
        헤이즐: cells[9]?.trim() || '',
        이안: cells[10]?.trim() || '',
        테오: cells[11]?.trim() || '',
        헨리: cells[12]?.trim() || '',
        비고: cells[13]?.trim() || '',
      };

      if (row.스텔라 || row.메이브 || row.헤이즐 || row.이안 || row.테오 || row.헨리) {
        rows.push(row);
      }
    }

    i++;
  }

  return rows;
}

function parseCSVLine(line: string): string[] {
  const cells: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      cells.push(current);
      current = '';
    } else {
      current += char;
    }
  }

  cells.push(current);
  return cells;
}

// =====================================================
// 메인 로직
// =====================================================

async function main() {
  console.log('🚀 PushNotificationSchedule 시드 스크립트 시작...\n');

  // CSV 파일 읽기
  const csvPath = path.resolve(
    __dirname,
    '../../../푸시알림관련/AI 에이전트 푸시 로직_최종본_260108.csv',
  );

  if (!fs.existsSync(csvPath)) {
    console.error(`❌ CSV 파일을 찾을 수 없습니다: ${csvPath}`);
    process.exit(1);
  }

  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  console.log(`📄 CSV 파일 로드 완료: ${csvPath}\n`);

  // CSV 파싱
  const rows = parseCSV(csvContent);
  console.log(`📊 파싱된 행 수: ${rows.length}\n`);

  // Schedule 데이터 생성
  const schedules: ScheduleData[] = [];

  for (let i = 0; i < rows.length; i++) {
    const row = rows[i];

    try {
      const { type: conditionType, params: conditionParams } = parseConditionType(row);
      const { type: landingType, params: landingParams } = parseLandingType(row.랜딩_위치, row);
      const cronExpression = parseSendTimeToCron(row.발송_시점);

      // 페르소나별 메시지
      const personaMessages: Record<string, { title: string; body: string }> = {};

      // 메이브를 default로 사용 (페르소나 미지정 유저용 폴백)
      const maeveMsg = parseMessage(row.메이브);
      personaMessages.default = maeveMsg;

      const personas = [
        { key: 'STELLA', value: row.스텔라 },
        { key: 'MAEVE', value: row.메이브 },
        { key: 'HAZEL', value: row.헤이즐 },
        { key: 'IAN', value: row.이안 },
        { key: 'THEO', value: row.테오 },
        { key: 'HENRY', value: row.헨리 },
      ];

      for (const persona of personas) {
        const msg = parseMessage(persona.value);
        if (msg.title !== maeveMsg.title || msg.body !== maeveMsg.body) {
          personaMessages[persona.key] = msg;
        }
      }

      const senderType: 'BIOCOM' | 'PERSONA' = row.비고?.includes('바이오컴 이름으로')
        ? 'BIOCOM'
        : 'PERSONA';

      const pushCode = generatePushCode(row, i + 1);
      const name = `${row.상황 || '기타'} - ${row.조건 || row.세부_조건_1 || '일반'}`.substring(
        0,
        100,
      );

      // 기본 메시지 (personaMessages.default 사용)
      const defaultMsg = personaMessages.default;

      schedules.push({
        pushCode,
        name,
        description: row.비고 || null,
        scheduleType: 'RECURRING',
        type: 'CONDITION_BASED',
        category: 'AUTO',
        cronExpression,
        title: defaultMsg.title,
        bodyTemplate: defaultMsg.body,
        conditionType,
        conditionParams,
        landingType,
        landingParams,
        personaMessages,
        senderType,
        isActive: false, // 초기에는 비활성화 (테스트 후 활성화)
      });
    } catch (error) {
      console.error(`⚠️ 행 ${i + 1} 파싱 실패:`, error);
    }
  }

  console.log(`✅ 변환된 Schedule 수: ${schedules.length}\n`);

  // 샘플 출력
  console.log('📋 샘플 데이터 (처음 3개):');
  for (let i = 0; i < Math.min(3, schedules.length); i++) {
    console.log(`\n--- ${i + 1}. ${schedules[i].pushCode} ---`);
    console.log(JSON.stringify(schedules[i], null, 2));
  }

  // DB 삽입 여부 확인
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');

  if (dryRun) {
    console.log('\n⚠️ DRY RUN 모드입니다. 실제 DB에 삽입하려면 --execute 플래그를 추가하세요.');
    console.log('예: npx ts-node prisma/operation/seed-push-schedules.ts --execute\n');

    // JSON 파일로 출력
    const outputPath = path.resolve(__dirname, 'push-schedules-seed-data.json');
    fs.writeFileSync(outputPath, JSON.stringify(schedules, null, 2), 'utf-8');
    console.log(`📁 JSON 데이터 저장됨: ${outputPath}`);
  } else {
    console.log('\n🔄 DB에 Schedule 삽입 중...');

    let insertedCount = 0;
    let skippedCount = 0;

    for (const schedule of schedules) {
      try {
        // upsert 사용 (pushCode 기준)
        await prisma.pushNotificationSchedule.upsert({
          where: { pushCode: schedule.pushCode },
          update: {
            name: schedule.name,
            description: schedule.description,
            cronExpression: schedule.cronExpression,
            title: schedule.title,
            bodyTemplate: schedule.bodyTemplate,
            conditionType: schedule.conditionType,
            conditionParams: schedule.conditionParams,
            landingType: schedule.landingType,
            landingParams: schedule.landingParams,
            personaMessages: schedule.personaMessages,
            senderType: schedule.senderType,
          },
          create: {
            pushCode: schedule.pushCode,
            name: schedule.name,
            description: schedule.description,
            scheduleType: schedule.scheduleType,
            type: schedule.type,
            category: schedule.category,
            cronExpression: schedule.cronExpression,
            title: schedule.title,
            bodyTemplate: schedule.bodyTemplate,
            conditionType: schedule.conditionType,
            conditionParams: schedule.conditionParams,
            landingType: schedule.landingType,
            landingParams: schedule.landingParams,
            personaMessages: schedule.personaMessages,
            senderType: schedule.senderType,
            isActive: schedule.isActive,
          },
        });
        insertedCount++;
      } catch (error) {
        console.error(`⚠️ ${schedule.pushCode} 삽입 실패:`, error);
        skippedCount++;
      }
    }

    console.log(`\n✅ 삽입 완료: ${insertedCount}건`);
    if (skippedCount > 0) {
      console.log(`⚠️ 스킵됨: ${skippedCount}건`);
    }
  }

  console.log('\n🎉 스크립트 완료!');
}

main()
  .catch((e) => {
    console.error('❌ 스크립트 실행 실패:', e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
