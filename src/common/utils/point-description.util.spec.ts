import { PointRelatedType } from '../enums/point-related-type.enum';
import { getPointDescription, cleanPointDescription } from './point-description.util';

describe('Point Description Utilities', () => {
  describe('getPointDescription', () => {
    describe('ORDER 타입', () => {
      it('USE 타입은 "제품 구매"를 반환해야 한다', () => {
        const result = getPointDescription(PointRelatedType.ORDER, undefined, 'USE');
        expect(result).toBe('제품 구매');
      });

      it('SPEND 타입은 "제품 구매"를 반환해야 한다', () => {
        const result = getPointDescription(PointRelatedType.ORDER, undefined, 'SPEND');
        expect(result).toBe('제품 구매');
      });

      it('REFUND 타입은 "포인트 환급"를 반환해야 한다', () => {
        const result = getPointDescription(PointRelatedType.ORDER, undefined, 'REFUND');
        expect(result).toBe('포인트 환급');
      });

      it('PURCHASE_REWARD 타입은 "구매 적립"를 반환해야 한다', () => {
        const result = getPointDescription(PointRelatedType.ORDER, undefined, 'PURCHASE_REWARD');
        expect(result).toBe('구매 적립');
      });

      it('PURCHASE_REWARD_CANCEL 타입은 "구매 적립 회수"를 반환해야 한다', () => {
        const result = getPointDescription(
          PointRelatedType.ORDER,
          undefined,
          'PURCHASE_REWARD_CANCEL',
        );
        expect(result).toBe('구매 적립 회수');
      });

      it('기타 타입은 "주문"를 반환해야 한다', () => {
        const result = getPointDescription(PointRelatedType.ORDER);
        expect(result).toBe('주문');
      });
    });

    describe('RECORD_COMPLETION 타입', () => {
      it.each([
        ['BEAUTY', '뷰티 점수 평가'],
        ['DIET', '식단 기록'],
        ['SUPPLEMENT', '영양제 기록'],
        ['FASTING', '공복 시간 기록'],
        ['SLEEP', '수면 시간 기록'],
        ['ACTIVITY', '활동 기록'],
      ])('recordType %s는 "%s"를 반환해야 한다', (recordType, expected) => {
        const result = getPointDescription(PointRelatedType.RECORD_COMPLETION, recordType);
        expect(result).toBe(expected);
      });

      it('알 수 없는 recordType은 "{recordType} 기록"를 반환해야 한다', () => {
        const result = getPointDescription(PointRelatedType.RECORD_COMPLETION, 'UNKNOWN');
        expect(result).toBe('UNKNOWN 기록');
      });
    });

    describe('MISSION_COMPLETION 타입', () => {
      it('AFTER_SURVEY는 "사후 문진 완료"를 반환해야 한다', () => {
        const result = getPointDescription(PointRelatedType.MISSION_COMPLETION, 'AFTER_SURVEY');
        expect(result).toBe('사후 문진 완료');
      });

      it('알 수 없는 recordType은 "미션 완료"를 반환해야 한다', () => {
        const result = getPointDescription(PointRelatedType.MISSION_COMPLETION, 'UNKNOWN');
        expect(result).toBe('미션 완료');
      });
    });

    describe('CHALLENGE_MISSION 타입', () => {
      it('"챌린지 미션 완료"를 반환해야 한다', () => {
        const result = getPointDescription(PointRelatedType.CHALLENGE_MISSION);
        expect(result).toBe('챌린지 미션 완료');
      });
    });

    describe('기타 relatedType', () => {
      it.each([
        [PointRelatedType.WEEKLY_REPORT, '심층 리포트 확인'],
        [PointRelatedType.QUIZ, '강의 시청 후 퀴즈'],
        [PointRelatedType.BALANCE_GAME, '밸런스 게임 참여'],
        [PointRelatedType.REVIEW, '리뷰 작성'],
        [PointRelatedType.IMWEB_TRANSFER, '포인트 이관'],
        [PointRelatedType.MANUAL, '수동 지급'],
      ])('%s는 "%s"를 반환해야 한다', (relatedType, expected) => {
        const result = getPointDescription(relatedType);
        expect(result).toBe(expected);
      });

      it('매핑되지 않은 타입은 그대로 반환해야 한다', () => {
        const result = getPointDescription('UNKNOWN_TYPE');
        expect(result).toBe('UNKNOWN_TYPE');
      });
    });
  });

  describe('cleanPointDescription', () => {
    it('ID 부분을 제거해야 한다', () => {
      const result = cleanPointDescription('심층리포트 조회 (report_abc123)');
      expect(result).toBe('심층리포트 조회');
    });

    it('숫자 ID도 제거해야 한다', () => {
      const result = cleanPointDescription('퀴즈 완료 (12345)');
      expect(result).toBe('퀴즈 완료');
    });

    it('하이픈이 포함된 ID도 제거해야 한다', () => {
      const result = cleanPointDescription('미션 완료 (mission-001)');
      expect(result).toBe('미션 완료');
    });

    it('언더스코어가 포함된 ID도 제거해야 한다', () => {
      const result = cleanPointDescription('활동 기록 (activity_type_1)');
      expect(result).toBe('활동 기록');
    });

    it('ID가 없으면 그대로 반환해야 한다', () => {
      const result = cleanPointDescription('식단 기록');
      expect(result).toBe('식단 기록');
    });

    it('null은 빈 문자열을 반환해야 한다', () => {
      const result = cleanPointDescription(null);
      expect(result).toBe('');
    });

    it('빈 문자열은 빈 문자열을 반환해야 한다', () => {
      const result = cleanPointDescription('');
      expect(result).toBe('');
    });

    it('공백을 트림해야 한다', () => {
      const result = cleanPointDescription('  리뷰 작성  ');
      expect(result).toBe('리뷰 작성');
    });
  });
});
