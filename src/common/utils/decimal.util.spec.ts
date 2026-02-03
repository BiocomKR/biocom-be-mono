import { Decimal } from '@prisma/client/runtime/library';
import { convertDecimalToNumber, convertDecimalFields } from './decimal.util';

describe('Decimal Utilities', () => {
  describe('convertDecimalToNumber', () => {
    it('Prisma Decimal을 숫자로 변환해야 한다', () => {
      const decimal = new Decimal(123.45);
      const result = convertDecimalToNumber(decimal);

      expect(result).toBe(123.45);
    });

    it('정수 Decimal을 변환해야 한다', () => {
      const decimal = new Decimal(100);
      const result = convertDecimalToNumber(decimal);

      expect(result).toBe(100);
    });

    it('0을 변환해야 한다', () => {
      const decimal = new Decimal(0);
      const result = convertDecimalToNumber(decimal);

      expect(result).toBe(0);
    });

    it('음수를 변환해야 한다', () => {
      const decimal = new Decimal(-50.5);
      const result = convertDecimalToNumber(decimal);

      expect(result).toBe(-50.5);
    });

    it('null은 null을 반환해야 한다', () => {
      const result = convertDecimalToNumber(null);

      expect(result).toBeNull();
    });

    it('undefined는 null을 반환해야 한다', () => {
      const result = convertDecimalToNumber(undefined);

      expect(result).toBeNull();
    });

    it('일반 숫자는 그대로 반환해야 한다', () => {
      const result = convertDecimalToNumber(42);

      expect(result).toBe(42);
    });

    it('숫자 문자열을 숫자로 변환해야 한다', () => {
      const result = convertDecimalToNumber('123.45');

      expect(result).toBe(123.45);
    });

    it('toNumber 메서드가 있는 객체를 처리해야 한다', () => {
      const mockDecimal = {
        toNumber: () => 999.99,
      };
      const result = convertDecimalToNumber(mockDecimal);

      expect(result).toBe(999.99);
    });
  });

  describe('convertDecimalFields', () => {
    it('지정한 필드들을 숫자로 변환해야 한다', () => {
      const obj = {
        id: 1,
        price: new Decimal(100.5),
        quantity: new Decimal(5),
        name: 'test',
      };

      const result = convertDecimalFields(obj, ['price', 'quantity']);

      expect(result.price).toBe(100.5);
      expect(result.quantity).toBe(5);
      expect(result.name).toBe('test');
      expect(result.id).toBe(1);
    });

    it('원본 객체를 변경하지 않아야 한다', () => {
      const original = {
        price: new Decimal(100),
      };

      const result = convertDecimalFields(original, ['price']);

      expect(result).not.toBe(original);
      expect(original.price).toBeInstanceOf(Decimal);
    });

    it('존재하지 않는 필드는 무시해야 한다', () => {
      const obj = {
        price: new Decimal(100),
      };

      const result = convertDecimalFields(obj, ['price', 'nonExistent']);

      expect(result.price).toBe(100);
      expect(result).not.toHaveProperty('nonExistent');
    });

    it('null 값 필드도 처리해야 한다', () => {
      const obj = {
        price: null,
        discount: new Decimal(10),
      };

      const result = convertDecimalFields(obj, ['price', 'discount']);

      expect(result.price).toBeNull();
      expect(result.discount).toBe(10);
    });
  });
});
