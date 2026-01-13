import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';
import * as jwt from 'jsonwebtoken';

const prisma = new PrismaClient();

const USER_ID = 56;
const API_BASE = 'http://localhost:10804/api';
const JWT_SECRET = 'i7SXN6XAwMKjz!vMjSvY+ZJj10&d7l=2Wsy1Y1^Qw7u*L';

// 로컬 서버용 토큰 생성
function generateToken() {
  return 'Bearer ' + jwt.sign(
    { sub: USER_ID, name: '엄신우' },
    JWT_SECRET,
    { expiresIn: '1h' }
  );
}

// 경계값 테스트 케이스 (오늘 기준 2026-01-12)
const TEST_CASES = [
  { day: 1, startDate: '2026-01-12', description: '챌린지 시작' },
  { day: 2, startDate: '2026-01-11', description: '2일차' },
  { day: 7, startDate: '2026-01-06', description: '7일차 (심층리포트 전날)' },
  { day: 8, startDate: '2026-01-05', description: '심층리포트 시작' },
  { day: 10, startDate: '2026-01-03', description: '자기선언문 마지막날' },
  { day: 11, startDate: '2026-01-02', description: '나칭찬 시작, 자기선언문 종료' },
  { day: 20, startDate: '2025-12-24', description: '나칭찬 마지막날' },
  { day: 21, startDate: '2025-12-23', description: '챌린지 마지막날, 나칭찬 종료' },
  { day: 22, startDate: '2025-12-22', description: '챌린지 종료 후 1일차 (사후문진 시작)' },
  { day: 28, startDate: '2025-12-16', description: '사후문진 마지막날' },
  { day: 29, startDate: '2025-12-15', description: '29일차 이후' },
];

// 문서 기준 기대값
const EXPECTED_MISSIONS: Record<number, { A: string[]; B: string[] }> = {
  1: { A: ['DECLARATION'], B: ['BEAUTY', 'DIET', 'SUPPLEMENT', 'FASTING', 'QUIZ', 'BALANCE_GAME', 'SLEEP', 'ACTIVITY', 'DAILY_MISSION'] },
  2: { A: ['DECLARATION'], B: ['BEAUTY', 'DIET', 'SUPPLEMENT', 'FASTING', 'QUIZ', 'BALANCE_GAME', 'SLEEP', 'ACTIVITY', 'DAILY_MISSION'] },
  7: { A: ['DECLARATION'], B: ['BEAUTY', 'DIET', 'SUPPLEMENT', 'FASTING', 'QUIZ', 'BALANCE_GAME', 'SLEEP', 'ACTIVITY', 'DAILY_MISSION'] },
  8: { A: ['DECLARATION', 'WEEKLY_REPORT'], B: ['BEAUTY', 'DIET', 'SUPPLEMENT', 'FASTING', 'QUIZ', 'BALANCE_GAME', 'SLEEP', 'ACTIVITY', 'DAILY_MISSION'] },
  10: { A: ['DECLARATION', 'WEEKLY_REPORT'], B: ['BEAUTY', 'DIET', 'SUPPLEMENT', 'FASTING', 'QUIZ', 'BALANCE_GAME', 'SLEEP', 'ACTIVITY', 'DAILY_MISSION'] },
  11: { A: ['SELF_PRAISE', 'WEEKLY_REPORT'], B: ['BEAUTY', 'DIET', 'SUPPLEMENT', 'FASTING', 'QUIZ', 'BALANCE_GAME', 'SLEEP', 'ACTIVITY', 'DAILY_MISSION'] },
  20: { A: ['SELF_PRAISE', 'WEEKLY_REPORT'], B: ['BEAUTY', 'DIET', 'SUPPLEMENT', 'FASTING', 'QUIZ', 'BALANCE_GAME', 'SLEEP', 'ACTIVITY', 'DAILY_MISSION'] },
  21: { A: ['WEEKLY_REPORT'], B: ['BEAUTY', 'DIET', 'SUPPLEMENT', 'FASTING', 'QUIZ', 'BALANCE_GAME', 'SLEEP', 'ACTIVITY', 'DAILY_MISSION'] },
  22: { A: ['AFTER_SURVEY', 'WEEKLY_REPORT'], B: [] }, // NEWCOMER_EXP: A그룹만
  28: { A: ['AFTER_SURVEY', 'WEEKLY_REPORT'], B: [] },
  29: { A: [], B: [] }, // 블러 처리 (전체 보이되 비활성화)
};

async function updateChallengeDate(startDate: string) {
  const start = new Date(startDate);
  start.setUTCHours(0, 0, 0, 0);

  const end = new Date(start);
  end.setDate(end.getDate() + 20); // 21일 챌린지
  end.setUTCHours(23, 59, 59, 999);

  // 오늘 날짜
  const today = new Date('2026-01-12');
  today.setUTCHours(12, 0, 0, 0);

  const isExpired = end < today;

  await prisma.userChallenge.updateMany({
    where: { userId: USER_ID },
    data: {
      activatedAt: start,
      expiresAt: end,
      status: isExpired ? 'EXPIRED' : 'ACTIVE',
    },
  });

  await prisma.user.update({
    where: { id: USER_ID },
    data: {
      status: isExpired ? 'NEWCOMER' : 'CHALLENGER',
    },
  });
}

async function callHomeAPI(): Promise<any> {
  try {
    const response = await fetch(`${API_BASE}/home`, {
      headers: {
        'Authorization': generateToken(),
      },
    });
    const json = await response.json();
    console.log('API 응답 상태:', response.status);
    if (!json.data) {
      console.log('API 응답:', JSON.stringify(json, null, 2));
    }
    return json;
  } catch (error) {
    console.error('API 호출 실패:', error);
    return { data: null, error: String(error) };
  }
}

function compareWithExpected(day: number, actual: any): { pass: boolean; details: string[] } {
  const expected = EXPECTED_MISSIONS[day];
  if (!expected) return { pass: true, details: ['기대값 없음'] };

  const details: string[] = [];
  let pass = true;

  if (!actual.data || !actual.data.missionList) {
    return { pass: false, details: ['❌ API 응답 없음'] };
  }

  const actualRecordTypes = actual.data.missionList.map((m: any) => m.recordType);
  const actualA = actualRecordTypes.filter((t: string) => ['DECLARATION', 'AFTER_SURVEY', 'SELF_PRAISE', 'WEEKLY_REPORT'].includes(t));
  const actualB = actualRecordTypes.filter((t: string) => !['DECLARATION', 'AFTER_SURVEY', 'SELF_PRAISE', 'WEEKLY_REPORT'].includes(t));

  // A그룹 검증
  const expectedA = expected.A;
  const missingA = expectedA.filter(t => !actualA.includes(t));
  const extraA = actualA.filter((t: string) => !expectedA.includes(t));

  if (missingA.length > 0) {
    details.push(`❌ A그룹 누락: ${missingA.join(', ')}`);
    pass = false;
  }
  if (extraA.length > 0) {
    details.push(`⚠️ A그룹 불필요: ${extraA.join(', ')}`);
    pass = false;
  }

  // B그룹 검증 (22일차 이후 NEWCOMER_EXP는 B그룹 없어야 함)
  if (day >= 22 && expected.B.length === 0) {
    if (actualB.length > 0) {
      details.push(`❌ B그룹이 있으면 안됨 (NEWCOMER_EXP): ${actualB.join(', ')}`);
      pass = false;
    }
  }

  // sortOrder 검증 (A그룹이 B그룹보다 위에 있어야 함)
  const missions = actual.data.missionList;
  for (let i = 0; i < missions.length - 1; i++) {
    if (missions[i].sortOrder > missions[i + 1].sortOrder) {
      details.push(`❌ sortOrder 순서 오류: ${missions[i].recordType}(${missions[i].sortOrder}) > ${missions[i + 1].recordType}(${missions[i + 1].sortOrder})`);
      pass = false;
      break;
    }
  }

  if (pass) {
    details.push('✅ 문서와 일치');
  }

  return { pass, details };
}

async function main() {
  const results: any[] = [];
  const outputDir = '/Users/shinwoo/Desktop/Biocom/repo/홈화면로직점검';

  // 디렉토리 생성
  if (!fs.existsSync(outputDir)) {
    fs.mkdirSync(outputDir, { recursive: true });
  }

  console.log('=== 홈 API 경계값 테스트 시작 ===\n');

  for (const testCase of TEST_CASES) {
    console.log(`\n[${testCase.day}일차] ${testCase.description}`);
    console.log(`시작일: ${testCase.startDate}`);

    // 1. 챌린지 날짜 업데이트
    await updateChallengeDate(testCase.startDate);

    // 잠시 대기 (DB 반영)
    await new Promise(r => setTimeout(r, 500));

    // 2. Home API 호출
    const response = await callHomeAPI();

    // 3. 기대값과 비교
    const comparison = compareWithExpected(testCase.day, response);

    // 4. 결과 저장
    results.push({
      day: testCase.day,
      description: testCase.description,
      startDate: testCase.startDate,
      userType: response.data?.userType,
      currentDay: response.data?.challengeInfo?.currentDay || `종료 후 ${testCase.day - 21}일차`,
      missionList: response.data?.missionList?.map((m: any) => ({
        recordType: m.recordType,
        sortOrder: m.sortOrder,
        title: m.title,
      })),
      comparison,
      fullResponse: response,
    });

    // 콘솔 출력
    console.log(`userType: ${response.data?.userType}`);
    console.log(`미션 수: ${response.data?.missionList?.length || 0}`);
    console.log(`검증: ${comparison.details.join(', ')}`);
  }

  // 결과 파일 저장
  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);

  // 상세 JSON 저장
  const jsonPath = path.join(outputDir, `테스트결과_${timestamp}.json`);
  fs.writeFileSync(jsonPath, JSON.stringify(results, null, 2), 'utf-8');

  // 요약 마크다운 저장
  let markdown = `# 홈 API 경계값 테스트 결과\n\n`;
  markdown += `테스트 일시: ${new Date().toLocaleString('ko-KR')}\n\n`;
  markdown += `| 일차 | 설명 | userType | 미션목록 | 검증결과 |\n`;
  markdown += `|------|------|----------|----------|----------|\n`;

  for (const r of results) {
    const missions = r.missionList?.map((m: any) => m.recordType).join(', ') || '-';
    const status = r.comparison.pass ? '✅' : '❌';
    markdown += `| ${r.day} | ${r.description} | ${r.userType} | ${missions.substring(0, 50)}... | ${status} |\n`;
  }

  markdown += `\n## 상세 결과\n\n`;
  for (const r of results) {
    markdown += `### ${r.day}일차 - ${r.description}\n\n`;
    markdown += `- **시작일**: ${r.startDate}\n`;
    markdown += `- **userType**: ${r.userType}\n`;
    markdown += `- **검증**: ${r.comparison.details.join(', ')}\n`;
    markdown += `- **미션 목록**:\n`;
    r.missionList?.forEach((m: any, i: number) => {
      markdown += `  ${i + 1}. ${m.recordType} (sortOrder: ${m.sortOrder})\n`;
    });
    markdown += `\n`;
  }

  const mdPath = path.join(outputDir, `테스트결과_${timestamp}.md`);
  fs.writeFileSync(mdPath, markdown, 'utf-8');

  console.log(`\n=== 테스트 완료 ===`);
  console.log(`JSON: ${jsonPath}`);
  console.log(`마크다운: ${mdPath}`);

  // 전체 통과 여부
  const allPass = results.every(r => r.comparison.pass);
  console.log(`\n전체 결과: ${allPass ? '✅ 모두 통과' : '❌ 일부 실패'}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
