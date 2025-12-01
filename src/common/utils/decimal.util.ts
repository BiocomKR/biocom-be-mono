import { Decimal } from '@prisma/client/runtime/library';

/**
 * Prisma Decimal 타입을 숫자로 안전하게 변환
 * @param value Prisma에서 반환된 Decimal 값
 * @returns 숫자 또는 null
 */
export function convertDecimalToNumber(value: any): number | null {
  if (!value) return null;

  // 1. instanceof 체크
  if (value instanceof Decimal) {
    return value.toNumber();
  }

  // 2. Decimal.isDecimal 메서드 체크
  if (Decimal.isDecimal && Decimal.isDecimal(value)) {
    return value.toNumber();
  }

  // 3. toNumber 메서드가 있는지 체크
  if (value.toNumber && typeof value.toNumber === 'function') {
    return value.toNumber();
  }

  // 4. Decimal 객체 구조 체크 (d, e, s 속성)
  if (value && typeof value === 'object' && 'd' in value && 'e' in value && 's' in value) {
    // Decimal.js 라이브러리 구조인 경우
    if (Array.isArray(value.d) && value.d.length > 0) {
      return Number(value.d[0]);
    }
  }

  // 일반 숫자나 문자열
  return Number(value) || null;
}

/**
 * 객체의 Decimal 필드들을 숫자로 일괄 변환
 * @param obj 변환할 객체
 * @param fields 변환할 필드명들
 * @returns 변환된 객체
 */
export function convertDecimalFields<T>(obj: T, fields: string[]): T {
  const result = { ...obj } as any;

  for (const field of fields) {
    if (result[field] !== undefined) {
      result[field] = convertDecimalToNumber(result[field]);
    }
  }

  return result;
}