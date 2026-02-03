import {
  createKSTDate,
  stringToKSTDate,
  parseKSTDateTime,
  extractKSTDate,
  getDayOfWeek,
  formatKoreanDate,
} from './kst-date.util';

describe('KST Date Utilities', () => {
  describe('createKSTDate', () => {
    it('지정한 년월일로 Date 객체를 생성해야 한다', () => {
      const date = createKSTDate(2025, 10, 20);

      expect(date.getUTCFullYear()).toBe(2025);
      expect(date.getUTCMonth()).toBe(9); // 0-indexed
      expect(date.getUTCDate()).toBe(20);
    });

    it('시간까지 지정할 수 있어야 한다', () => {
      const date = createKSTDate(2025, 10, 20, 14, 30, 45);

      expect(date.getUTCHours()).toBe(14);
      expect(date.getUTCMinutes()).toBe(30);
      expect(date.getUTCSeconds()).toBe(45);
    });

    it('시간 미지정시 00:00:00이어야 한다', () => {
      const date = createKSTDate(2025, 1, 1);

      expect(date.getUTCHours()).toBe(0);
      expect(date.getUTCMinutes()).toBe(0);
      expect(date.getUTCSeconds()).toBe(0);
    });
  });

  describe('stringToKSTDate', () => {
    it('YYYY-MM-DD 문자열을 Date로 변환해야 한다', () => {
      const date = stringToKSTDate('2025-10-20');

      expect(date.getUTCFullYear()).toBe(2025);
      expect(date.getUTCMonth()).toBe(9);
      expect(date.getUTCDate()).toBe(20);
    });

    it('시간을 추가로 지정할 수 있어야 한다', () => {
      const date = stringToKSTDate('2025-10-20', 14, 30, 0);

      expect(date.getUTCHours()).toBe(14);
      expect(date.getUTCMinutes()).toBe(30);
    });

    it('월초 날짜를 정확히 파싱해야 한다', () => {
      const date = stringToKSTDate('2025-01-01');

      expect(date.getUTCFullYear()).toBe(2025);
      expect(date.getUTCMonth()).toBe(0);
      expect(date.getUTCDate()).toBe(1);
    });

    it('월말 날짜를 정확히 파싱해야 한다', () => {
      const date = stringToKSTDate('2025-12-31');

      expect(date.getUTCFullYear()).toBe(2025);
      expect(date.getUTCMonth()).toBe(11);
      expect(date.getUTCDate()).toBe(31);
    });
  });

  describe('parseKSTDateTime', () => {
    it('YYYY-MM-DD HH:MM:SS 형식을 파싱해야 한다', () => {
      const date = parseKSTDateTime('2025-11-07 20:00:00');

      expect(date.getUTCFullYear()).toBe(2025);
      expect(date.getUTCMonth()).toBe(10);
      expect(date.getUTCDate()).toBe(7);
      expect(date.getUTCHours()).toBe(20);
      expect(date.getUTCMinutes()).toBe(0);
      expect(date.getUTCSeconds()).toBe(0);
    });

    it('자정 시간을 정확히 파싱해야 한다', () => {
      const date = parseKSTDateTime('2025-01-01 00:00:00');

      expect(date.getUTCHours()).toBe(0);
      expect(date.getUTCMinutes()).toBe(0);
      expect(date.getUTCSeconds()).toBe(0);
    });

    it('23:59:59를 정확히 파싱해야 한다', () => {
      const date = parseKSTDateTime('2025-12-31 23:59:59');

      expect(date.getUTCHours()).toBe(23);
      expect(date.getUTCMinutes()).toBe(59);
      expect(date.getUTCSeconds()).toBe(59);
    });

    it('잘못된 형식은 에러를 던져야 한다', () => {
      expect(() => parseKSTDateTime('2025-11-07')).toThrow('Invalid datetime format');
      expect(() => parseKSTDateTime('20251107 200000')).toThrow('Invalid datetime format');
      expect(() => parseKSTDateTime('invalid')).toThrow('Invalid datetime format');
    });
  });

  describe('extractKSTDate', () => {
    it('Date 객체에서 YYYY-MM-DD 문자열을 추출해야 한다', () => {
      const date = createKSTDate(2025, 11, 7);
      const result = extractKSTDate(date);

      expect(result).toBe('2025-11-07');
    });

    it('시간이 있어도 날짜만 추출해야 한다', () => {
      const date = createKSTDate(2025, 11, 7, 23, 59, 59);
      const result = extractKSTDate(date);

      expect(result).toBe('2025-11-07');
    });
  });

  describe('getDayOfWeek', () => {
    it('월요일을 반환해야 한다', () => {
      // 2025-02-03은 월요일
      expect(getDayOfWeek('2025-02-03')).toBe('월');
    });

    it('일요일을 반환해야 한다', () => {
      // 2025-02-02는 일요일
      expect(getDayOfWeek('2025-02-02')).toBe('일');
    });

    it('토요일을 반환해야 한다', () => {
      // 2025-02-01은 토요일
      expect(getDayOfWeek('2025-02-01')).toBe('토');
    });

    it('금요일을 반환해야 한다', () => {
      // 2025-01-31은 금요일
      expect(getDayOfWeek('2025-01-31')).toBe('금');
    });
  });

  describe('formatKoreanDate', () => {
    it('Date 객체를 YYYY-MM-DD 형식으로 변환해야 한다', () => {
      // UTC 기준 2025-12-11 15:00:00 = KST 2025-12-12 00:00:00
      const date = new Date(Date.UTC(2025, 11, 11, 15, 0, 0));
      const result = formatKoreanDate(date);

      expect(result).toBe('2025-12-12');
    });

    it('KST 기준으로 날짜가 변환되어야 한다', () => {
      // UTC 2025-12-31 20:00:00 = KST 2026-01-01 05:00:00
      const date = new Date(Date.UTC(2025, 11, 31, 20, 0, 0));
      const result = formatKoreanDate(date);

      expect(result).toBe('2026-01-01');
    });
  });
});
