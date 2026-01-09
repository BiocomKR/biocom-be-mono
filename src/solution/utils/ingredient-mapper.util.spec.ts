import { classifyIngredients, getGlutenLevel } from './ingredient-mapper.util';
import { FoodLevelItem } from '../../sib/interfaces/sib-response.interface';
import { ExamType } from '../../sib/enums/exam-type.enum';

describe('ingredient-mapper.util', () => {
  // 90종 검사 결과 예시
  const mockFoodLevel90: FoodLevelItem = {
    userName: '테스트',
    chartId: 'TEST001',
    level1: '쌀, 소고기, 닭고기',
    level2: '돼지고기, 감자, 당근',
    level3: '양파, 마늘, 토마토',
    level4: '밀, 계란흰자, 우유',
    level5: '글루텐, 계란노른자',
  };

  // 89종 검사 결과 예시
  const mockFoodLevel89: FoodLevelItem = {
    userName: '테스트',
    chartId: 'TEST002',
    level1: '쌀, 소고기, 닭고기',
    level2: '돼지고기, 감자, 당근',
    level3: '양파, 마늘, 토마토',
    level4: '밀가루, 계란흰자, 우유',
    level5: '글루텐, 계란노른자',
  };

  describe('classifyIngredients', () => {
    describe('기본 매칭', () => {
      it('1-3단계 식재료는 safe로 분류된다', () => {
        const ingredients = ['쌀', '소고기', '감자'];
        const result = classifyIngredients(ingredients, mockFoodLevel90, ExamType.IGG);

        expect(result.safe).toEqual(['쌀', '소고기', '감자']);
        expect(result.caution).toEqual([]);
      });

      it('4-5단계 식재료는 caution으로 분류된다', () => {
        const ingredients = ['밀', '우유'];
        const result = classifyIngredients(ingredients, mockFoodLevel90, ExamType.IGG);

        expect(result.safe).toEqual([]);
        expect(result.caution).toContain('밀');
        expect(result.caution).toContain('우유');
      });
    });

    describe('1:N 매핑 (계란)', () => {
      it('계란흰자와 계란노른자 둘 다 4-5단계면 계란은 caution', () => {
        const ingredients = ['계란'];
        const result = classifyIngredients(ingredients, mockFoodLevel90, ExamType.IGG);

        expect(result.caution).toContain('계란');
        expect(result.safe).not.toContain('계란');
      });

      it('계란흰자만 4-5단계여도 계란은 caution', () => {
        const foodLevel: FoodLevelItem = {
          ...mockFoodLevel90,
          level1: '계란노른자',
          level4: '계란흰자',
          level5: '',
        };
        const ingredients = ['계란'];
        const result = classifyIngredients(ingredients, foodLevel, ExamType.IGG);

        expect(result.caution).toContain('계란');
      });

      it('계란흰자, 계란노른자 둘 다 1-3단계면 계란은 safe', () => {
        const foodLevel: FoodLevelItem = {
          ...mockFoodLevel90,
          level1: '계란흰자, 계란노른자',
          level4: '',
          level5: '',
        };
        const ingredients = ['계란'];
        const result = classifyIngredients(ingredients, foodLevel, ExamType.IGG);

        expect(result.safe).toContain('계란');
        expect(result.caution).not.toContain('계란');
      });
    });

    describe('N:1 매핑 (고추류)', () => {
      it('90종: 홍고추, 꽈리고추, 고춧가루는 고추 항원으로 매칭', () => {
        const foodLevel: FoodLevelItem = {
          ...mockFoodLevel90,
          level4: '고추',
          level5: '',
        };
        const ingredients = ['홍고추', '꽈리고추', '고춧가루'];
        const result = classifyIngredients(ingredients, foodLevel, ExamType.IGG);

        expect(result.caution).toContain('홍고추');
        expect(result.caution).toContain('꽈리고추');
        expect(result.caution).toContain('고춧가루');
      });

      it('89종: 고추 항원이 없으므로 고추류는 분류되지 않음', () => {
        const ingredients = ['홍고추', '꽈리고추'];
        const result = classifyIngredients(ingredients, mockFoodLevel89, ExamType.IGG_OLD);

        // 89종에는 고추 항원이 없으므로 어디에도 분류 안 됨
        expect(result.safe).not.toContain('홍고추');
        expect(result.caution).not.toContain('홍고추');
      });
    });

    describe('유사 명칭 매핑', () => {
      it('90종: 밀 식재료는 밀 항원으로 매칭', () => {
        const ingredients = ['밀'];
        const result = classifyIngredients(ingredients, mockFoodLevel90, ExamType.IGG);

        expect(result.caution).toContain('밀');
      });

      it('89종: 밀 식재료는 밀가루 항원으로 매칭', () => {
        const ingredients = ['밀'];
        const result = classifyIngredients(ingredients, mockFoodLevel89, ExamType.IGG_OLD);

        expect(result.caution).toContain('밀');
      });

      it('효모(와인)은 90종에서 효모균으로, 89종에서 효모로 매칭', () => {
        const foodLevel90: FoodLevelItem = {
          ...mockFoodLevel90,
          level4: '효모균',
        };
        const foodLevel89: FoodLevelItem = {
          ...mockFoodLevel89,
          level4: '효모',
        };

        const ingredients = ['효모(와인)'];

        const result90 = classifyIngredients(ingredients, foodLevel90, ExamType.IGG);
        const result89 = classifyIngredients(ingredients, foodLevel89, ExamType.IGG_OLD);

        expect(result90.caution).toContain('효모(와인)');
        expect(result89.caution).toContain('효모(와인)');
      });

      it('방울토마토는 토마토 항원으로 매칭', () => {
        const foodLevel: FoodLevelItem = {
          ...mockFoodLevel90,
          level3: '토마토',
        };
        const ingredients = ['방울토마토'];
        const result = classifyIngredients(ingredients, foodLevel, ExamType.IGG);

        expect(result.safe).toContain('방울토마토');
      });
    });

    describe('매핑 제외', () => {
      it('올리브유는 올리브 항원과 매핑되지 않음', () => {
        const foodLevel: FoodLevelItem = {
          ...mockFoodLevel90,
          level4: '올리브',
        };
        const ingredients = ['올리브유', '올리브'];
        const result = classifyIngredients(ingredients, foodLevel, ExamType.IGG);

        // 올리브유는 제외, 올리브는 caution
        expect(result.caution).not.toContain('올리브유');
        expect(result.safe).not.toContain('올리브유');
        expect(result.caution).toContain('올리브');
      });

      it('사과식초는 사과 항원과 매핑되지 않음', () => {
        const foodLevel: FoodLevelItem = {
          ...mockFoodLevel90,
          level4: '사과',
        };
        const ingredients = ['사과식초', '사과'];
        const result = classifyIngredients(ingredients, foodLevel, ExamType.IGG);

        expect(result.caution).not.toContain('사과식초');
        expect(result.caution).toContain('사과');
      });

      it('현미/흑미는 쌀 항원과 매핑되지 않음', () => {
        const foodLevel: FoodLevelItem = {
          ...mockFoodLevel90,
          level4: '쌀',
        };
        const ingredients = ['현미', '흑미', '쌀'];
        const result = classifyIngredients(ingredients, foodLevel, ExamType.IGG);

        expect(result.caution).not.toContain('현미');
        expect(result.caution).not.toContain('흑미');
        expect(result.caution).toContain('쌀');
      });
    });

    describe('단독 항목 (검사 종류별 차이)', () => {
      it('오리고기는 90종에만 있음', () => {
        const foodLevel90: FoodLevelItem = {
          ...mockFoodLevel90,
          level4: '오리고기',
        };
        const foodLevel89: FoodLevelItem = {
          ...mockFoodLevel89,
          level4: '오리고기', // 89종에는 실제로 없음
        };

        const ingredients = ['오리고기'];

        const result90 = classifyIngredients(ingredients, foodLevel90, ExamType.IGG);
        const result89 = classifyIngredients(ingredients, foodLevel89, ExamType.IGG_OLD);

        expect(result90.caution).toContain('오리고기');
        // 89종 매핑 테이블에 오리고기가 빈 배열이므로 분류 안 됨
        expect(result89.caution).not.toContain('오리고기');
        expect(result89.safe).not.toContain('오리고기');
      });

      it('브로콜리는 89종에만 있음', () => {
        const foodLevel90: FoodLevelItem = {
          ...mockFoodLevel90,
          level4: '브로콜리',
        };
        const foodLevel89: FoodLevelItem = {
          ...mockFoodLevel89,
          level4: '브로콜리',
        };

        const ingredients = ['브로콜리'];

        const result90 = classifyIngredients(ingredients, foodLevel90, ExamType.IGG);
        const result89 = classifyIngredients(ingredients, foodLevel89, ExamType.IGG_OLD);

        // 90종 매핑 테이블에 브로콜리가 빈 배열이므로 분류 안 됨
        expect(result90.caution).not.toContain('브로콜리');
        expect(result89.caution).toContain('브로콜리');
      });
    });
  });

  describe('getGlutenLevel', () => {
    it('글루텐이 level5에 있으면 5 반환', () => {
      const result = getGlutenLevel(mockFoodLevel90, ExamType.IGG);
      expect(result).toBe(5);
    });

    it('글루텐이 level4에만 있으면 4 반환', () => {
      const foodLevel: FoodLevelItem = {
        ...mockFoodLevel90,
        level4: '글루텐',
        level5: '',
      };
      const result = getGlutenLevel(foodLevel, ExamType.IGG);
      expect(result).toBe(4);
    });

    it('89종에서 밀가루가 level4에 있으면 4 반환', () => {
      const foodLevel: FoodLevelItem = {
        ...mockFoodLevel89,
        level4: '밀가루',
        level5: '',
      };
      const result = getGlutenLevel(foodLevel, ExamType.IGG_OLD);
      expect(result).toBe(4);
    });

    it('글루텐/밀이 없으면 0 반환', () => {
      const foodLevel: FoodLevelItem = {
        ...mockFoodLevel90,
        level4: '우유',
        level5: '땅콩',
      };
      const result = getGlutenLevel(foodLevel, ExamType.IGG);
      expect(result).toBe(0);
    });
  });
});
