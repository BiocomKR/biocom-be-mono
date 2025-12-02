import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import { PrismaService } from '../../common/services/prisma.service';

/** 변수 패턴: {{variableName}} */
const VARIABLE_PATTERN = /\{\{([a-zA-Z_][a-zA-Z0-9_]*)\}\}/g;

/** 잘못된 변수 문법 패턴 (점, 하이픈, 공백 포함) */
const INVALID_SYNTAX_PATTERN = /\{\{[^}]*[.\-\s][^}]*\}\}/g;

/**
 * 푸시 템플릿 서비스
 *
 * 변수 치환 로직 담당
 */
@Injectable()
export class PushTemplateService {
  private readonly logger = new Logger(PushTemplateService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 사용 가능한 변수 목록 조회 (프론트엔드 표시용)
   */
  async getVariables() {
    return this.prisma.pushTemplateVariable.findMany({
      where: { isActive: true },
      orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
      select: {
        id: true,
        category: true,
        variableKey: true,
        displayName: true,
        description: true,
        defaultValue: true,
      },
    });
  }

  /**
   * 템플릿 유효성 검증
   *
   * @param template - 검증할 템플릿 문자열
   * @throws BadRequestException - 유효하지 않은 변수 사용 시
   */
  async validateTemplate(template: string): Promise<void> {
    // 잘못된 문법 체크 (점, 하이픈, 공백)
    const invalidSyntax = [...template.matchAll(INVALID_SYNTAX_PATTERN)].map(
      (m) => m[0],
    );
    if (invalidSyntax.length > 0) {
      throw new BadRequestException(
        `잘못된 변수 문법: ${invalidSyntax.join(', ')} (점, 하이픈, 공백 불가)`,
      );
    }

    // 사용된 변수 추출
    const usedVars = this.extractVariableKeys(template);
    if (usedVars.length === 0) return;

    // DB에서 허용된 변수 조회
    const allowedVars = await this.prisma.pushTemplateVariable.findMany({
      where: { isActive: true },
      select: { variableKey: true },
    });
    const allowedKeys = new Set(allowedVars.map((v) => v.variableKey));

    // 존재하지 않는 변수 체크
    const invalidVars = usedVars.filter((v) => !allowedKeys.has(v));
    if (invalidVars.length > 0) {
      throw new BadRequestException(
        `존재하지 않는 변수: ${invalidVars.join(', ')}`,
      );
    }
  }

  /**
   * 템플릿에서 사용된 변수 키 추출
   */
  extractVariableKeys(template: string): string[] {
    const matches = [...template.matchAll(VARIABLE_PATTERN)];
    return [...new Set(matches.map((m) => m[1]))];
  }

  /**
   * 사용자별 템플릿 치환
   *
   * @param template - 템플릿 문자열
   * @param userIds - 대상 사용자 ID 배열
   * @returns 사용자별 치환된 메시지 배열
   */
  async substituteForUsers(
    template: string,
    userIds: number[],
  ): Promise<Map<number, string>> {
    const usedVarKeys = this.extractVariableKeys(template);

    // 변수가 없으면 모든 사용자에게 동일한 메시지
    if (usedVarKeys.length === 0) {
      const result = new Map<number, string>();
      userIds.forEach((id) => result.set(id, template));
      return result;
    }

    // 변수 매핑 정보 조회
    const mappings = await this.prisma.pushTemplateVariable.findMany({
      where: {
        variableKey: { in: usedVarKeys },
        isActive: true,
      },
    });

    // 필요한 관계(include) 수집
    const includes = this.collectIncludes(mappings);

    // 사용자 조회 (관계 포함)
    const users = await this.prisma.user.findMany({
      where: { id: { in: userIds } },
      include: includes,
    });

    // 사용자별 치환
    const result = new Map<number, string>();
    for (const user of users) {
      let message = template;
      for (const mapping of mappings) {
        const value = this.getValueByPath(user, mapping.dataPath);
        const finalValue =
          value !== null && value !== undefined
            ? String(value)
            : mapping.defaultValue || '';

        const pattern = new RegExp(
          `\\{\\{${mapping.variableKey}\\}\\}`,
          'g',
        );
        message = message.replace(pattern, finalValue);
      }
      result.set(user.id, message);
    }

    return result;
  }

  /**
   * 템플릿 미리보기 (샘플 사용자로 치환 결과 확인)
   */
  async previewTemplate(
    template: string,
    sampleUserId?: number,
  ): Promise<{ original: string; substituted: string; user?: any }> {
    await this.validateTemplate(template);

    if (!sampleUserId) {
      // 샘플 사용자 없으면 첫 번째 활성 사용자 사용
      const sampleUser = await this.prisma.user.findFirst({
        where: { isActive: true, deletedAt: null },
        orderBy: { id: 'asc' },
      });
      sampleUserId = sampleUser?.id;
    }

    if (!sampleUserId) {
      return { original: template, substituted: template };
    }

    const result = await this.substituteForUsers(template, [sampleUserId]);
    const substituted = result.get(sampleUserId) || template;

    // 사용자 기본 정보
    const user = await this.prisma.user.findUnique({
      where: { id: sampleUserId },
      select: { id: true, name: true, mobile: true },
    });

    return { original: template, substituted, user };
  }

  /**
   * 필요한 Prisma include 객체 생성
   */
  private collectIncludes(
    mappings: { requiredIncludes: any }[],
  ): Record<string, boolean> {
    const includes: Record<string, boolean> = {};

    for (const mapping of mappings) {
      const required = mapping.requiredIncludes as string[] | null;
      if (required && Array.isArray(required)) {
        for (const key of required) {
          includes[key] = true;
        }
      }
    }

    return includes;
  }

  /**
   * 객체에서 dot notation 경로로 값 조회
   * 예: getValueByPath(user, 'healthTypeAnimal.animalName')
   */
  private getValueByPath(obj: any, path: string): any {
    // 'user.' 접두사 제거 (dataPath가 user.name 형태일 수 있음)
    const cleanPath = path.startsWith('user.') ? path.slice(5) : path;

    const keys = cleanPath.split('.');
    let current = obj;

    for (const key of keys) {
      if (current === null || current === undefined) {
        return null;
      }

      // 배열 인덱스 처리 (예: orders[0])
      const arrayMatch = key.match(/^(\w+)\[(\d+)\]$/);
      if (arrayMatch) {
        const [, arrayKey, indexStr] = arrayMatch;
        const index = parseInt(indexStr, 10);
        current = current[arrayKey]?.[index];
      } else {
        current = current[key];
      }
    }

    return current;
  }
}
