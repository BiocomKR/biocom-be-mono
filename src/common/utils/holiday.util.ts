import axios from 'axios';

/**
 * 공휴일 정보 인터페이스
 */
interface HolidayInfo {
  dateKind: string;     // 01: 국경일, 02: 기념일, 03: 24절기, 04: 잡절
  dateName: string;     // 공휴일명 (설날, 추석 등)
  isHoliday: string;    // Y: 공휴일, N: 비공휴일
  locdate: number;      // 날짜 (YYYYMMDD)
  seq: number;          // 순번
}

/**
 * 공공데이터포털 공휴일 API 응답 인터페이스
 */
interface HolidayApiResponse {
  response: {
    header: {
      resultCode: string;
      resultMsg: string;
    };
    body: {
      items: {
        item: HolidayInfo[] | HolidayInfo;
      };
      numOfRows: number;
      pageNo: number;
      totalCount: number;
    };
  };
}

/**
 * 공휴일 캐시 (년도별)
 * 메모리에 캐싱하여 API 호출 최소화
 */
const holidayCache: Map<number, Set<string>> = new Map();

/**
 * 공공데이터포털 API를 통해 특정 년도의 공휴일 목록을 가져옵니다
 *
 * @param year - 조회할 년도 (예: 2025)
 * @returns 공휴일 날짜 Set (YYYY-MM-DD 형식)
 */
async function fetchHolidays(year: number): Promise<Set<string>> {
  const apiKey = process.env.PUBLIC_DATA_PORTAL_API_KEY;
  const endpoint = process.env.PUBLIC_DATA_PORTAL_HOLIDAY_ENDPOINT;

  if (!apiKey || !endpoint) {
    console.warn('공휴일 API 키 또는 엔드포인트가 설정되지 않았습니다. 공휴일 체크를 건너뜁니다.');
    return new Set();
  }

  try {
    // NodeJS 샘플 방식: serviceKey 파라미터 + Encoding된 키 그대로 사용
    let url = endpoint + '/getRestDeInfo';
    let queryParams = '?' + encodeURIComponent('serviceKey') + '=' + apiKey; // 이미 Encoding된 키
    queryParams += '&' + encodeURIComponent('solYear') + '=' + encodeURIComponent(String(year));
    queryParams += '&' + encodeURIComponent('numOfRows') + '=' + encodeURIComponent('100');

    const response = await axios.get<HolidayApiResponse>(url + queryParams, {
      timeout: 10000, // 10초 타임아웃
    });

    const items = response.data.response.body.items.item;
    const holidaySet = new Set<string>();

    // item이 배열인지 단일 객체인지 확인
    const itemArray = Array.isArray(items) ? items : [items];

    for (const item of itemArray) {
      // isHoliday가 'Y'인 것만 공휴일로 처리
      if (item.isHoliday === 'Y') {
        // locdate: 20250101 → 2025-01-01 변환
        const dateStr = String(item.locdate);
        const formattedDate = `${dateStr.slice(0, 4)}-${dateStr.slice(4, 6)}-${dateStr.slice(6, 8)}`;
        holidaySet.add(formattedDate);
      }
    }

    return holidaySet;
  } catch (error) {
    console.error(`공휴일 API 조회 실패 (${year}년):`, error.message);
    // API 실패 시 빈 Set 반환 (주말 체크는 계속 진행)
    return new Set();
  }
}

/**
 * 특정 년도의 공휴일 목록을 가져옵니다 (캐싱 지원)
 *
 * @param year - 조회할 년도
 * @returns 공휴일 날짜 Set (YYYY-MM-DD 형식)
 */
async function getHolidays(year: number): Promise<Set<string>> {
  // 캐시에 있으면 캐시 반환
  if (holidayCache.has(year)) {
    return holidayCache.get(year)!;
  }

  // 캐시에 없으면 API 호출
  const holidays = await fetchHolidays(year);
  holidayCache.set(year, holidays);

  return holidays;
}

/**
 * 주어진 날짜가 주말인지 확인
 *
 * @param date - 확인할 날짜
 * @returns 주말이면 true, 평일이면 false
 */
function isWeekend(date: Date): boolean {
  const dayOfWeek = date.getDay();
  return dayOfWeek === 0 || dayOfWeek === 6; // 0: 일요일, 6: 토요일
}

/**
 * 주어진 날짜가 공휴일인지 확인
 *
 * @param date - 확인할 날짜
 * @param holidays - 공휴일 Set
 * @returns 공휴일이면 true, 아니면 false
 */
function isHoliday(date: Date, holidays: Set<string>): boolean {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  const dateStr = `${year}-${month}-${day}`;

  return holidays.has(dateStr);
}

/**
 * 주어진 날짜가 배송 가능한 날인지 확인 (평일이면서 공휴일이 아닌 날)
 *
 * @param date - 확인할 날짜
 * @returns 배송 가능하면 true, 불가능하면 false
 */
export async function isDeliveryAvailable(date: Date): Promise<boolean> {
  // 주말이면 배송 불가
  if (isWeekend(date)) {
    return false;
  }

  // 공휴일 체크
  const year = date.getFullYear();
  const holidays = await getHolidays(year);

  // 공휴일이면 배송 불가
  if (isHoliday(date, holidays)) {
    return false;
  }

  return true;
}

/**
 * 주어진 날짜부터 과거로 거슬러 올라가며 배송 가능한 가장 가까운 날짜를 찾습니다
 *
 * @param date - 시작 날짜
 * @param maxDaysBack - 최대 몇 일까지 거슬러 올라갈지 (기본: 7일)
 * @returns 배송 가능한 날짜, 없으면 null
 */
export async function findNearestDeliveryDate(date: Date, maxDaysBack: number = 7): Promise<Date | null> {
  const checkDate = new Date(date);

  for (let i = 0; i < maxDaysBack; i++) {
    if (await isDeliveryAvailable(checkDate)) {
      return checkDate;
    }
    // 하루씩 과거로 이동
    checkDate.setDate(checkDate.getDate() - 1);
  }

  // 7일 내에 배송 가능한 날이 없으면 null 반환
  return null;
}

/**
 * 캐시 초기화 (테스트용 또는 년도가 바뀌었을 때 사용)
 */
export function clearHolidayCache(): void {
  holidayCache.clear();
}
