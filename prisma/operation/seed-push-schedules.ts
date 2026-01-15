import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as XLSX from 'xlsx';

const prisma = new PrismaClient();

/**
 * Excel(xlsx)에서 PushNotificationSchedule 데이터를 파싱하여 DB에 삽입하는 스크립트
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
  custom_id: string;
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
  | 'REPORT'
  | 'COUPON_LIST'
  | 'DAILY_MISSION';

// =====================================================
// 매핑 함수들
// =====================================================

/**
 * CSV 조건/상황을 ConditionType으로 변환
 */
function parseConditionType(row: CsvRow): { type: ConditionType; params: Record<string, any> } {
  const { 조건, 세부_조건_1, 세부_조건_2 } = row;
  // "1. 온보딩" → "온보딩" (숫자+점 제거)
  const 상황 = row.상황.replace(/^\d+\.\s*/, '');

  // 온보딩 관련
  if (상황 === '온보딩') {
    // 1. 유형분류 문진 미완료
    if (세부_조건_1.includes('유형분류 문진 미완료')) {
      return { type: 'ONBOARDING_STATE', params: { state: 'TYPE_SURVEY_INCOMPLETE' } };
    }
    // 2. 솔루션 조회 미완료
    if (세부_조건_1.includes('유형분류 문진 완료') && 세부_조건_2.includes('맞춤 솔루션 조회 미완료')) {
      return { type: 'ONBOARDING_STATE', params: { state: 'SOLUTION_NOT_VIEWED' } };
    }
    // 3. 시작일 미설정 (솔루션 조회 완료)
    if (세부_조건_2.includes('맞춤 솔루션 조회 완료')) {
      return { type: 'ONBOARDING_STATE', params: { state: 'SOLUTION_VIEWED_START_NOT_SET' } };
    }
    // 4. D-1 (시작 1일 전)
    if (조건.includes('시작일 지정 완료') && 세부_조건_1.includes('챌린지 시작 1일 전')) {
      return { type: 'CHALLENGE_START_OFFSET_DAYS', params: { offsetDays: -1 } };
    }
    // 5. D-Day (챌린지 시작일 당일)
    if (세부_조건_1.includes('챌린지 시작일')) {
      return { type: 'CHALLENGE_START_OFFSET_DAYS', params: { offsetDays: 0 } };
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
 * params는 day만 필요한 경우에만 사용
 */
function parseLandingType(
  landingText: string,
  row: CsvRow,
): { type: LandingType; params: { day: number } | null } {
  const text = landingText.toLowerCase();

  // day 파라미터 추출 (공통)
  const dayMatch = row.세부_조건_1?.match(/(\d+)일차/);
  const day = dayMatch ? parseInt(dayMatch[1], 10) : null;

  // 파라미터 없는 화면들
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
  if (text.includes('놀이터')) {
    return { type: 'PLAYGROUND', params: null };
  }
  if (text.includes('리포트')) {
    return { type: 'REPORT', params: null };
  }
  if (text.includes('장바구니') || text.includes('cart')) {
    return { type: 'CART', params: null };
  }
  if (text.includes('쿠폰')) {
    return { type: 'COUPON_LIST', params: null };
  }

  // day 파라미터가 필요한 화면들
  if (text.includes('강의')) {
    return { type: 'LECTURE', params: day ? { day } : null };
  }
  if (text.includes('미션 기록') || text.includes('해당 일자 미션')) {
    return { type: 'MISSION_RECORD', params: day ? { day } : null };
  }
  if (text.includes('데일리 미션') || text.includes('1일 1미션')) {
    return { type: 'DAILY_MISSION', params: day ? { day } : null };
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
 * 세그먼트 변수 정규화 (CSV 형식 → DB 형식)
 * [00], [000], [001], [002] → {{userName}}
 */
function normalizeSegmentVariables(text: string): string {
  // [00], [000], [001], [002] 등을 모두 {{userName}}으로 치환
  return text.replace(/\[0+\d*\]/g, '{{userName}}');
}

/**
 * 메시지에서 title과 body 분리
 */
function parseMessage(messageText: string): { title: string; body: string } {
  if (!messageText || messageText.trim() === '') {
    return { title: '', body: '' };
  }

  // 세그먼트 변수 정규화
  const normalizedText = normalizeSegmentVariables(messageText);

  const lines = normalizedText.split('\n').filter((line) => line.trim() !== '');

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
 * custom_id가 있으면 {YYMMDD}_ 부분 제거 후 사용
 * {n} 플레이스홀더는 conditionParams.day 값으로 치환
 * 없으면 기존 로직으로 생성
 */
function generatePushCode(row: CsvRow, index: number, conditionParams?: Record<string, any>): string {
  // custom_id가 있으면 {YYMMDD}_ 부분 제거 후 사용
  if (row.custom_id && row.custom_id.trim()) {
    // {YYMMDD}_push_xxx → push_xxx
    let pushCode = row.custom_id.replace(/^\{YYMMDD\}_/, '');

    // {n} 플레이스홀더를 conditionParams.day 값으로 치환
    if (conditionParams?.day && pushCode.includes('{n}')) {
      pushCode = pushCode.replace('{n}', String(conditionParams.day));
    }

    return pushCode;
  }

  // custom_id가 없으면 기존 로직으로 생성
  const parts: string[] = [];

  if (row.상황) {
    // "1. 온보딩" → "온보딩" (숫자+점 제거)
    const cleanSituation = row.상황.replace(/^\d+\.\s*/, '');
    const situationMap: Record<string, string> = {
      온보딩: 'ONBOARD',
      '오프 보딩': 'OFFBOARD',
      '미션 미 수행': 'MISSION_INCOMPLETE',
      '참여 독려': 'ENCOURAGE',
      '포인트/쿠폰 사용/구매 독려': 'POINT_COUPON',
    };
    parts.push(situationMap[cleanSituation] || cleanSituation.replace(/\s+/g, '_').toUpperCase());
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
// Excel 파싱
// =====================================================

function parseExcel(xlsxPath: string, sheetName: string): CsvRow[] {
  const workbook = XLSX.readFile(xlsxPath);
  const sheet = workbook.Sheets[sheetName];

  if (!sheet) {
    throw new Error(`시트 '${sheetName}'를 찾을 수 없습니다. 사용 가능한 시트: ${workbook.SheetNames.join(', ')}`);
  }

  // 2D 배열로 변환 (header: 1 옵션으로 헤더 포함)
  const data: any[][] = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  const rows: CsvRow[] = [];

  // 컬럼 순서: 기간및대상(0), 상황(1), 조건(2), 세부조건1(3), 세부조건2(4), 발송시점(5), 랜딩위치(6), custom_id(7), 스텔라(8), 메이브(9), 헤이즐(10), 이안(11), 테오(12), 헨리(13), 비고(14)
  // 병합 셀 처리: 이전 행의 값을 유지
  let currentContext: Partial<CsvRow> = {
    기간_및_대상: '',
    상황: '',
    조건: '',
    세부_조건_2: '',
    발송_시점: '',
    랜딩_위치: '',
    custom_id: '',
    스텔라: '',
    메이브: '',
    헤이즐: '',
    이안: '',
    테오: '',
    헨리: '',
    비고: '',
  };

  // Row 0: 빈 행, Row 1: 헤더, Row 2~: 데이터
  for (let i = 2; i < data.length; i++) {
    const cells = data[i];

    // 완전히 빈 행은 스킵
    if (!cells || cells.length === 0) continue;

    // 세부_조건_1(일차 정보)이 없으면 스킵 (최소한 일차 정보는 있어야 함)
    // 컬럼: A(0)빈칸, B(1)기간및대상, C(2)상황, D(3)조건, E(4)세부조건1, F(5)세부조건2, G(6)발송시점, H(7)랜딩위치, I(8)custom_id, J(9)스텔라, K(10)메이브, L(11)헤이즐, M(12)이안, N(13)테오, O(14)헨리, P(15)비고
    const 세부_조건_1 = cells[4] ? String(cells[4]).trim() : '';
    if (!세부_조건_1) continue;

    // 컨텍스트 업데이트
    // 병합 셀 처리: 기간_및_대상, 상황, 조건만 이전 값 유지
    if (cells[1]) currentContext.기간_및_대상 = String(cells[1]).trim();
    if (cells[2]) currentContext.상황 = String(cells[2]).trim();
    if (cells[3]) currentContext.조건 = String(cells[3]).trim();

    // 나머지 컬럼은 빈 셀이면 초기화 (병합 셀 아님)
    currentContext.세부_조건_2 = cells[5] ? String(cells[5]).trim() : '';
    currentContext.발송_시점 = cells[6] ? String(cells[6]).trim() : '';
    currentContext.랜딩_위치 = cells[7] ? String(cells[7]).trim() : '';
    currentContext.custom_id = cells[8] ? String(cells[8]).trim() : '';
    currentContext.스텔라 = cells[9] ? String(cells[9]).trim() : '';
    currentContext.메이브 = cells[10] ? String(cells[10]).trim() : '';
    currentContext.헤이즐 = cells[11] ? String(cells[11]).trim() : '';
    currentContext.이안 = cells[12] ? String(cells[12]).trim() : '';
    currentContext.테오 = cells[13] ? String(cells[13]).trim() : '';
    currentContext.헨리 = cells[14] ? String(cells[14]).trim() : '';
    currentContext.비고 = cells[15] ? String(cells[15]).trim() : '';

    const row: CsvRow = {
      기간_및_대상: currentContext.기간_및_대상 || '',
      상황: currentContext.상황 || '',
      조건: currentContext.조건 || '',
      세부_조건_1: 세부_조건_1, // 현재 행의 일차 정보
      세부_조건_2: currentContext.세부_조건_2 || '',
      발송_시점: currentContext.발송_시점 || '',
      랜딩_위치: currentContext.랜딩_위치 || '',
      custom_id: currentContext.custom_id || '',
      스텔라: currentContext.스텔라 || '',
      메이브: currentContext.메이브 || '',
      헤이즐: currentContext.헤이즐 || '',
      이안: currentContext.이안 || '',
      테오: currentContext.테오 || '',
      헨리: currentContext.헨리 || '',
      비고: currentContext.비고 || '',
    };

    // 메시지가 하나라도 있는 행만 추가
    if (row.스텔라 || row.메이브 || row.헤이즐 || row.이안 || row.테오 || row.헨리) {
      rows.push(row);
    }
  }

  return rows;
}

// =====================================================
// 메인 로직
// =====================================================

async function main() {
  console.log('🚀 PushNotificationSchedule 시드 스크립트 시작...\n');

  // Excel 파일 읽기
  const xlsxPath = path.resolve(__dirname, '../../../푸시알림관련/이너뷰티 챌린지 db.xlsx');
  const sheetName = '푸시알림';

  if (!fs.existsSync(xlsxPath)) {
    console.error(`❌ Excel 파일을 찾을 수 없습니다: ${xlsxPath}`);
    process.exit(1);
  }

  console.log(`📄 Excel 파일 로드: ${xlsxPath} (시트: ${sheetName})\n`);

  // Excel 파싱
  const rows = parseExcel(xlsxPath, sheetName);
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

      // 키는 AiPersona.name과 동일한 한글 사용
      const personas = [
        { key: '스텔라', value: row.스텔라 },
        { key: '메이브', value: row.메이브 },
        { key: '헤이즐', value: row.헤이즐 },
        { key: '이안', value: row.이안 },
        { key: '테오', value: row.테오 },
        { key: '헨리', value: row.헨리 },
      ];

      // BIOCOM 발송 판단:
      // 1. 비고에 "바이오컴 이름으로"가 있거나
      // 2. 스텔라만 메시지가 있고 나머지 페르소나가 비어있으면 BIOCOM
      const hasOnlyStella =
        row.스텔라 && !row.메이브 && !row.헤이즐 && !row.이안 && !row.테오 && !row.헨리;
      const isBiocomSender = row.비고?.includes('바이오컴 이름으로') || hasOnlyStella;

      if (isBiocomSender) {
        // 바이오컴 이름으로 발송: default만 사용 (스텔라 또는 메이브 메시지를 default로)
        const biocomMsg = row.스텔라 || row.메이브;
        personaMessages.default = parseMessage(biocomMsg);
      } else {
        // 페르소나별 발송: 6개 페르소나 키 모두 추가 (default 없음)
        for (const persona of personas) {
          personaMessages[persona.key] = parseMessage(persona.value);
        }
      }

      const senderType: 'BIOCOM' | 'PERSONA' = isBiocomSender ? 'BIOCOM' : 'PERSONA';

      const pushCode = generatePushCode(row, i + 1, conditionParams);
      const name = `${row.상황 || '기타'} - ${row.조건 || row.세부_조건_1 || '일반'}`.substring(
        0,
        100,
      );

      // 기본 메시지 (default가 있으면 사용, 없으면 스텔라 또는 메이브 메시지 사용)
      const defaultMsg =
        personaMessages.default ||
        personaMessages['스텔라'] ||
        personaMessages['메이브'] ||
        parseMessage(row.스텔라 || row.메이브);

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

  // 플래그 확인
  const args = process.argv.slice(2);
  const dryRun = !args.includes('--execute');
  const onboardingOnly = args.includes('--onboarding');

  // 온보딩만 필터링
  let filteredSchedules = schedules;
  if (onboardingOnly) {
    filteredSchedules = schedules.filter(
      (s) =>
        s.conditionType === 'ONBOARDING_STATE' ||
        s.conditionType === 'CHALLENGE_START_OFFSET_DAYS' ||
        (s.conditionType === 'CHALLENGE_DAY' &&
          s.conditionParams &&
          (s.conditionParams as any).day === 1),
    );
    console.log(`🎯 온보딩 필터 적용: ${filteredSchedules.length}개 (전체 ${schedules.length}개 중)\n`);
  }

  if (dryRun) {
    console.log('\n⚠️ DRY RUN 모드입니다. 실제 DB에 삽입하려면 --execute 플래그를 추가하세요.');
    console.log('예: npx ts-node prisma/operation/seed-push-schedules.ts --execute');
    console.log('    npx ts-node prisma/operation/seed-push-schedules.ts --execute --onboarding\n');

    // JSON 파일로 출력
    const outputPath = path.resolve(__dirname, 'push-schedules-seed-data.json');
    fs.writeFileSync(outputPath, JSON.stringify(filteredSchedules, null, 2), 'utf-8');
    console.log(`📁 JSON 데이터 저장됨: ${outputPath}`);
  } else {
    console.log('\n🔄 DB에 Schedule 삽입 중...');

    let insertedCount = 0;
    let skippedCount = 0;

    for (const schedule of filteredSchedules) {
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
