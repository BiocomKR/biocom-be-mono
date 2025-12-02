import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';
import { OPERATORS, isValidOperator } from '../enums';

/**
 * 세그먼트 규칙 JSON 구조
 */
export interface SegmentCondition {
  /** 조건 키 (DB의 condition_key) */
  key: string;
  /** 연산자 코드 */
  operator: string;
  /** 비교값 (단일값, 배열, 또는 범위) */
  value?: any;
}

export interface SegmentRule {
  /** 논리 연산자 (AND 또는 OR) */
  logic: 'AND' | 'OR';
  /** 조건 목록 */
  conditions: SegmentCondition[];
}

/**
 * 푸시 세그먼트 서비스
 *
 * 조건 기반 사용자 필터링 로직
 */
@Injectable()
export class PushSegmentService {
  private readonly logger = new Logger(PushSegmentService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 세그먼트 조건 목록 조회 (프론트엔드 표시용)
   */
  async getConditions() {
    const conditions = await this.prisma.pushSegmentCondition.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
    });

    // 연산자 정보 추가
    return conditions.map((cond) => ({
      ...cond,
      operators: (cond.allowedOperators as string[]).map((opCode) => ({
        code: opCode,
        label: OPERATORS[opCode]?.label || opCode,
      })),
    }));
  }

  /**
   * 세그먼트 규칙으로 대상 사용자 ID 조회
   *
   * @param rule - 세그먼트 규칙 JSON
   * @returns 대상 사용자 ID 배열
   */
  async getTargetUserIds(rule: SegmentRule): Promise<number[]> {
    this.logger.log(`🎯 [PushSegmentService] 세그먼트 대상 조회 시작`);

    // 조건이 없으면 빈 배열 반환
    if (!rule.conditions || rule.conditions.length === 0) {
      this.logger.warn('⚠️ 세그먼트 조건이 없습니다');
      return [];
    }

    try {
      const whereClause = await this.buildWhereClause(rule);

      this.logger.debug(`📝 SQL WHERE: ${whereClause.sql}`);
      this.logger.debug(`📝 Params: ${JSON.stringify(whereClause.params)}`);

      // 활성 사용자만 대상으로 조회
      const query = `
        SELECT id FROM users
        WHERE is_active = true
          AND deleted_at IS NULL
          AND (${whereClause.sql})
      `;

      const rows = await this.prisma.$queryRawUnsafe<{ id: number }[]>(
        query,
        ...whereClause.params,
      );

      this.logger.log(`✅ 대상 사용자 수: ${rows.length}명`);
      return rows.map((r) => r.id);
    } catch (error) {
      this.logger.error(`❌ 세그먼트 쿼리 실패: ${error.message}`);
      throw new BadRequestException(`세그먼트 조회 실패: ${error.message}`);
    }
  }

  /**
   * 세그먼트 대상 수 미리보기
   */
  async previewCount(rule: SegmentRule): Promise<number> {
    const userIds = await this.getTargetUserIds(rule);
    return userIds.length;
  }

  /**
   * 세그먼트 규칙을 SQL WHERE절로 변환
   */
  private async buildWhereClause(rule: SegmentRule): Promise<{
    sql: string;
    params: any[];
  }> {
    const { logic, conditions } = rule;

    // 조건 정의 조회
    const conditionKeys = conditions.map((c) => c.key);
    const conditionDefs = await this.prisma.pushSegmentCondition.findMany({
      where: {
        conditionKey: { in: conditionKeys },
        isActive: true,
      },
    });

    const clauses: string[] = [];
    const params: any[] = [];
    let paramIndex = 1;

    for (const cond of conditions) {
      const condDef = conditionDefs.find((d) => d.conditionKey === cond.key);
      if (!condDef) {
        throw new BadRequestException(
          `존재하지 않는 조건: ${cond.key}`,
        );
      }

      // 연산자 유효성 검사
      if (!isValidOperator(cond.operator)) {
        throw new BadRequestException(
          `존재하지 않는 연산자: ${cond.operator}`,
        );
      }

      const allowedOps = condDef.allowedOperators as string[];
      if (!allowedOps.includes(cond.operator)) {
        throw new BadRequestException(
          `조건 '${cond.key}'에서 허용되지 않는 연산자: ${cond.operator}`,
        );
      }

      const op = OPERATORS[cond.operator];
      let sql = op.sql;

      // field_expression 치환
      sql = sql.replace(/{expr}/g, condDef.fieldExpression);

      // 파라미터 바인딩 (PostgreSQL $1, $2 형식)
      if (op.valueCount === 0) {
        // 값 불필요 (is_true, is_false 등)
      } else if (op.valueCount === 1) {
        // 단일값 - days_ago 연산자는 같은 값을 2번 사용
        if (cond.operator === 'days_ago') {
          sql = sql.replace(/\?/g, () => `$${paramIndex++}`);
          params.push(cond.value, cond.value);
        } else {
          sql = sql.replace('?', `$${paramIndex++}`);
          params.push(cond.value);
        }
      } else if (op.valueCount === 2) {
        // 범위값 (between)
        sql = sql.replace('?', `$${paramIndex++}`);
        sql = sql.replace('?', `$${paramIndex++}`);
        params.push(cond.value[0], cond.value[1]);
      } else if (op.valueCount === -1) {
        // 배열 (in)
        const values = Array.isArray(cond.value) ? cond.value : [cond.value];
        const placeholders = values.map(() => `$${paramIndex++}`).join(', ');
        sql = sql.replace('?', placeholders);
        params.push(...values);
      }

      clauses.push(`(${sql})`);
    }

    return {
      sql: clauses.join(` ${logic} `),
      params,
    };
  }
}
