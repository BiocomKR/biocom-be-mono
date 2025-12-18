import {
  Injectable,
  Logger,
  NotFoundException,
  BadRequestException,
  ConflictException,
} from '@nestjs/common';
import { PrismaService } from '../common/services/prisma.service';
import {
  Prisma,
  SolutionScreenType,
  SolutionScreenVersionStatus,
} from '@prisma/client';
import { getNowKST } from '../common/utils/kst-date.util';

@Injectable()
export class SolutionService {
  private readonly logger = new Logger(SolutionService.name);

  constructor(private readonly prisma: PrismaService) {}

  /**
   * 화면 목록 조회
   */
  async getScreens(params: {
    screenType?: SolutionScreenType;
    healthTypeAnimalId?: number;
    isActive?: boolean;
    search?: string;
    page: number;
    limit: number;
  }) {
    const { screenType, healthTypeAnimalId, isActive, search, page, limit } =
      params;
    const skip = (page - 1) * limit;

    const where: Prisma.SolutionScreenWhereInput = {};
    if (screenType) where.screenType = screenType;
    if (healthTypeAnimalId) where.healthTypeAnimalId = healthTypeAnimalId;
    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.screenKey = { contains: search, mode: 'insensitive' };
    }

    const [screens, total] = await Promise.all([
      this.prisma.solutionScreen.findMany({
        where,
        skip,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          healthTypeAnimal: {
            select: {
              id: true,
              healthType: true,
              typeName: true,
              animalName: true,
            },
          },
          publishedVersion: {
            select: {
              id: true,
              schemaVersion: true,
              createdAt: true,
            },
          },
          _count: {
            select: { versions: true },
          },
        },
      }),
      this.prisma.solutionScreen.count({ where }),
    ]);

    return {
      items: screens.map((s) => ({
        id: s.id,
        screenKey: s.screenKey,
        screenType: s.screenType,
        healthTypeAnimal: s.healthTypeAnimal,
        isActive: s.isActive,
        publishedVersionId: s.publishedVersionId,
        publishedAt: s.publishedAt,
        publishedVersion: s.publishedVersion,
        versionCount: s._count.versions,
        createdAt: s.createdAt,
        updatedAt: s.updatedAt,
      })),
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 화면 상세 조회 (모든 버전 포함)
   */
  async getScreenByKey(screenKey: string) {
    const screen = await this.prisma.solutionScreen.findUnique({
      where: { screenKey },
      include: {
        healthTypeAnimal: true,
        versions: {
          orderBy: { createdAt: 'desc' },
        },
        publishedVersion: true,
      },
    });

    if (!screen) {
      throw new NotFoundException(`화면을 찾을 수 없습니다: ${screenKey}`);
    }

    return screen;
  }

  /**
   * 화면 생성
   */
  async createScreen(dto: {
    screenKey: string;
    screenType: SolutionScreenType;
    healthTypeAnimalId?: number;
  }) {
    // screenKey 중복 검사
    const existing = await this.prisma.solutionScreen.findUnique({
      where: { screenKey: dto.screenKey },
    });
    if (existing) {
      throw new ConflictException(
        `이미 존재하는 screenKey입니다: ${dto.screenKey}`,
      );
    }

    // healthTypeAnimalId 검증
    if (dto.healthTypeAnimalId) {
      const animal = await this.prisma.healthTypeAnimal.findUnique({
        where: { id: dto.healthTypeAnimalId },
      });
      if (!animal) {
        throw new BadRequestException(
          `존재하지 않는 healthTypeAnimal: ${dto.healthTypeAnimalId}`,
        );
      }
    }

    const screen = await this.prisma.solutionScreen.create({
      data: {
        screenKey: dto.screenKey,
        screenType: dto.screenType,
        healthTypeAnimalId: dto.healthTypeAnimalId,
        createdAt: getNowKST(),
      },
    });

    this.logger.log(`화면 생성: ${screen.screenKey} (ID: ${screen.id})`);

    return screen;
  }

  /**
   * 화면 삭제 (버전이 없을 때만)
   */
  async deleteScreen(screenKey: string) {
    const screen = await this.prisma.solutionScreen.findUnique({
      where: { screenKey },
      include: { _count: { select: { versions: true } } },
    });

    if (!screen) {
      throw new NotFoundException(`화면을 찾을 수 없습니다: ${screenKey}`);
    }

    if (screen._count.versions > 0) {
      throw new ConflictException(
        '버전이 있는 화면은 삭제할 수 없습니다. 비활성화하세요.',
      );
    }

    await this.prisma.solutionScreen.delete({
      where: { screenKey },
    });

    this.logger.log(`화면 삭제: ${screenKey}`);

    return { success: true };
  }

  /**
   * 화면 활성/비활성 토글
   */
  async toggleScreenActive(screenKey: string, isActive: boolean) {
    const screen = await this.prisma.solutionScreen.findUnique({
      where: { screenKey },
    });

    if (!screen) {
      throw new NotFoundException(`화면을 찾을 수 없습니다: ${screenKey}`);
    }

    await this.prisma.solutionScreen.update({
      where: { screenKey },
      data: { isActive },
    });

    this.logger.log(`화면 ${isActive ? '활성화' : '비활성화'}: ${screenKey}`);

    return { success: true };
  }

  /**
   * DRAFT 버전 조회 (없으면 PUBLISHED에서 복제하여 생성)
   */
  async getDraft(screenKey: string, operatorId: number) {
    const screen = await this.prisma.solutionScreen.findUnique({
      where: { screenKey },
      include: {
        versions: {
          where: { status: SolutionScreenVersionStatus.DRAFT },
          take: 1,
        },
        publishedVersion: true,
      },
    });

    if (!screen) {
      throw new NotFoundException(`화면을 찾을 수 없습니다: ${screenKey}`);
    }

    // 기존 DRAFT가 있으면 반환
    if (screen.versions.length > 0) {
      return screen.versions[0];
    }

    // DRAFT가 없으면 생성 (race condition 방지를 위해 try-catch)
    const basePayload = screen.publishedVersion?.payload || {
      schemaVersion: 1,
    };

    try {
      const draft = await this.prisma.solutionScreenVersion.create({
        data: {
          screenId: screen.id,
          status: SolutionScreenVersionStatus.DRAFT,
          payload: basePayload,
          schemaVersion:
            (basePayload as { schemaVersion?: number }).schemaVersion || 1,
          createdBy: operatorId,
          createdAt: getNowKST(),
        },
      });

      this.logger.log(`DRAFT 생성: ${screenKey} (Version ID: ${draft.id})`);

      return draft;
    } catch (error: any) {
      // unique constraint 에러 시 기존 DRAFT 재조회
      if (error.code === 'P2002') {
        const existingDraft = await this.prisma.solutionScreenVersion.findFirst({
          where: {
            screenId: screen.id,
            status: SolutionScreenVersionStatus.DRAFT,
          },
        });
        if (existingDraft) {
          return existingDraft;
        }
      }
      throw error;
    }
  }

  /**
   * DRAFT 저장 (덮어쓰기)
   */
  async saveDraft(
    screenKey: string,
    payload: object,
    operatorId: number,
  ) {
    const screen = await this.prisma.solutionScreen.findUnique({
      where: { screenKey },
      include: {
        versions: {
          where: { status: SolutionScreenVersionStatus.DRAFT },
          take: 1,
        },
      },
    });

    if (!screen) {
      throw new NotFoundException(`화면을 찾을 수 없습니다: ${screenKey}`);
    }

    const schemaVersion = (payload as { schemaVersion?: number }).schemaVersion || 1;

    // payload 기본 검증
    this.validatePayload(payload, screen.screenType);

    if (screen.versions.length > 0) {
      // 기존 DRAFT 업데이트
      const draft = await this.prisma.solutionScreenVersion.update({
        where: { id: screen.versions[0].id },
        data: {
          payload,
          schemaVersion,
        },
      });

      this.logger.log(`DRAFT 업데이트: ${screenKey} (Version ID: ${draft.id})`);

      return draft;
    } else {
      // 새 DRAFT 생성
      const draft = await this.prisma.solutionScreenVersion.create({
        data: {
          screenId: screen.id,
          status: SolutionScreenVersionStatus.DRAFT,
          payload,
          schemaVersion,
          createdBy: operatorId,
          createdAt: getNowKST(),
        },
      });

      this.logger.log(`DRAFT 생성: ${screenKey} (Version ID: ${draft.id})`);

      return draft;
    }
  }

  /**
   * 배포 (DRAFT → PUBLISHED)
   */
  async publish(screenKey: string, operatorId: number) {
    const screen = await this.prisma.solutionScreen.findUnique({
      where: { screenKey },
      include: {
        versions: {
          where: { status: SolutionScreenVersionStatus.DRAFT },
          take: 1,
        },
        publishedVersion: true,
      },
    });

    if (!screen) {
      throw new NotFoundException(`화면을 찾을 수 없습니다: ${screenKey}`);
    }

    if (screen.versions.length === 0) {
      throw new BadRequestException('배포할 DRAFT가 없습니다');
    }

    const draft = screen.versions[0];

    // payload 검증 (배포 시점에 한번 더)
    this.validatePayload(draft.payload as object, screen.screenType);

    // productId 유효성 검증
    await this.validateProductIds(draft.payload as object);

    await this.prisma.$transaction(async (tx) => {
      // 기존 PUBLISHED → ARCHIVED
      if (screen.publishedVersion) {
        await tx.solutionScreenVersion.update({
          where: { id: screen.publishedVersion.id },
          data: { status: SolutionScreenVersionStatus.ARCHIVED },
        });
      }

      // DRAFT → PUBLISHED
      await tx.solutionScreenVersion.update({
        where: { id: draft.id },
        data: { status: SolutionScreenVersionStatus.PUBLISHED },
      });

      // 화면에 배포 정보 업데이트
      await tx.solutionScreen.update({
        where: { screenKey },
        data: {
          publishedVersionId: draft.id,
          publishedAt: getNowKST(),
          publishedBy: operatorId,
        },
      });
    });

    this.logger.log(`배포 완료: ${screenKey} (Version ID: ${draft.id})`);

    return { success: true, versionId: draft.id };
  }

  /**
   * 롤백 (이전 버전으로 되돌리기)
   */
  async rollback(screenKey: string, versionId: number, operatorId: number) {
    const screen = await this.prisma.solutionScreen.findUnique({
      where: { screenKey },
    });

    if (!screen) {
      throw new NotFoundException(`화면을 찾을 수 없습니다: ${screenKey}`);
    }

    const targetVersion = await this.prisma.solutionScreenVersion.findFirst({
      where: {
        id: versionId,
        screenId: screen.id,
        status: SolutionScreenVersionStatus.ARCHIVED,
      },
    });

    if (!targetVersion) {
      throw new BadRequestException(
        '해당 버전을 찾을 수 없거나 ARCHIVED 상태가 아닙니다',
      );
    }

    await this.prisma.$transaction(async (tx) => {
      // 현재 PUBLISHED → ARCHIVED
      if (screen.publishedVersionId) {
        await tx.solutionScreenVersion.update({
          where: { id: screen.publishedVersionId },
          data: { status: SolutionScreenVersionStatus.ARCHIVED },
        });
      }

      // 타겟 버전 → PUBLISHED
      await tx.solutionScreenVersion.update({
        where: { id: versionId },
        data: { status: SolutionScreenVersionStatus.PUBLISHED },
      });

      // 화면 배포 정보 업데이트
      await tx.solutionScreen.update({
        where: { screenKey },
        data: {
          publishedVersionId: versionId,
          publishedAt: getNowKST(),
          publishedBy: operatorId,
        },
      });
    });

    this.logger.log(`롤백 완료: ${screenKey} → Version ID ${versionId}`);

    return { success: true, versionId };
  }

  /**
   * 버전 목록 조회
   */
  async getVersions(screenKey: string) {
    const screen = await this.prisma.solutionScreen.findUnique({
      where: { screenKey },
    });

    if (!screen) {
      throw new NotFoundException(`화면을 찾을 수 없습니다: ${screenKey}`);
    }

    const versions = await this.prisma.solutionScreenVersion.findMany({
      where: { screenId: screen.id },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        status: true,
        schemaVersion: true,
        createdBy: true,
        createdAt: true,
      },
    });

    return versions;
  }

  /**
   * 버전 상세 조회 (payload 포함)
   */
  async getVersion(screenKey: string, versionId: number) {
    const screen = await this.prisma.solutionScreen.findUnique({
      where: { screenKey },
    });

    if (!screen) {
      throw new NotFoundException(`화면을 찾을 수 없습니다: ${screenKey}`);
    }

    const version = await this.prisma.solutionScreenVersion.findFirst({
      where: {
        id: versionId,
        screenId: screen.id,
      },
    });

    if (!version) {
      throw new NotFoundException(`버전을 찾을 수 없습니다: ${versionId}`);
    }

    return version;
  }

  /**
   * 미리보기용 데이터 조회 (DRAFT payload + productMap + ingredientMap)
   */
  async getPreview(screenKey: string) {
    const screen = await this.prisma.solutionScreen.findUnique({
      where: { screenKey },
      include: {
        versions: {
          where: { status: SolutionScreenVersionStatus.DRAFT },
          take: 1,
        },
        publishedVersion: true,
      },
    });

    if (!screen) {
      throw new NotFoundException(`화면을 찾을 수 없습니다: ${screenKey}`);
    }

    // DRAFT가 있으면 DRAFT, 없으면 PUBLISHED
    let version = screen.versions[0] || screen.publishedVersion;

    // 버전이 없으면 빈 DRAFT 생성
    if (!version) {
      version = await this.prisma.solutionScreenVersion.create({
        data: {
          screenId: screen.id,
          status: SolutionScreenVersionStatus.DRAFT,
          payload: { schemaVersion: 1 },
          schemaVersion: 1,
          createdBy: 1, // 시스템 생성
          createdAt: getNowKST(),
        },
      });
    }

    const payload = version.payload as object;

    // productId들 추출
    const productIds = this.extractProductIds(payload);

    // ingredientKey들 추출
    const ingredientKeys = this.extractIngredientKeys(payload);

    // Product 조회
    const products = productIds.length > 0
      ? await this.prisma.product.findMany({
          where: { id: { in: productIds } },
          include: {
            productFiles: {
              include: { file: true },
              orderBy: { sortOrder: 'asc' },
              take: 1,
            },
          },
        })
      : [];

    // Ingredient 조회
    const ingredients = ingredientKeys.length > 0
      ? await this.prisma.ingredient.findMany({
          where: { key: { in: ingredientKeys } },
        })
      : [];

    // productMap 구성
    const productMap: Record<number, object> = {};
    for (const p of products) {
      productMap[p.id] = {
        id: p.id,
        name: p.name,
        price: p.price ? Number(p.price) : null,
        originalPrice: p.originalPrice ? Number(p.originalPrice) : null,
        imageUrl: p.productFiles[0]?.file.filePath || null,
      };
    }

    // ingredientMap 구성
    const ingredientMap: Record<string, object> = {};
    for (const i of ingredients) {
      ingredientMap[i.key] = {
        key: i.key,
        name: i.name,
        nameEn: i.nameEn,
        category: i.category,
      };
    }

    return {
      screenKey: screen.screenKey,
      screenType: screen.screenType,
      schemaVersion: version.schemaVersion,
      payload,
      products: productMap,
      ingredients: ingredientMap,
    };
  }

  /**
   * 성분 목록 조회
   */
  async getIngredients(params: {
    category?: string;
    search?: string;
    isActive?: boolean;
    page: number;
    limit: number;
  }) {
    const { category, search, isActive, page, limit } = params;
    const skip = (page - 1) * limit;

    const where: Prisma.IngredientWhereInput = {};
    if (category) where.category = category;
    if (isActive !== undefined) where.isActive = isActive;
    if (search) {
      where.OR = [
        { key: { contains: search, mode: 'insensitive' } },
        { name: { contains: search, mode: 'insensitive' } },
        { code: { contains: search, mode: 'insensitive' } },
      ];
    }

    const [ingredients, total] = await Promise.all([
      this.prisma.ingredient.findMany({
        where,
        skip,
        take: limit,
        orderBy: [{ category: 'asc' }, { sortOrder: 'asc' }],
      }),
      this.prisma.ingredient.count({ where }),
    ]);

    return {
      items: ingredients,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit),
    };
  }

  /**
   * 성분 생성
   */
  async createIngredient(dto: {
    key: string;
    code: string;
    name: string;
    nameEn?: string;
    category?: string;
    sortOrder?: number;
  }) {
    // key 중복 검사
    const existingByKey = await this.prisma.ingredient.findUnique({
      where: { key: dto.key },
    });
    if (existingByKey) {
      throw new ConflictException(`이미 존재하는 key입니다: ${dto.key}`);
    }

    // code 중복 검사
    const existingByCode = await this.prisma.ingredient.findUnique({
      where: { code: dto.code },
    });
    if (existingByCode) {
      throw new ConflictException(`이미 존재하는 code입니다: ${dto.code}`);
    }

    const ingredient = await this.prisma.ingredient.create({
      data: {
        key: dto.key,
        code: dto.code,
        name: dto.name,
        nameEn: dto.nameEn,
        category: dto.category,
        sortOrder: dto.sortOrder || 0,
        createdAt: getNowKST(),
      },
    });

    this.logger.log(`성분 생성: ${ingredient.name} (${ingredient.key})`);

    return ingredient;
  }

  /**
   * 성분 수정
   */
  async updateIngredient(
    id: number,
    dto: {
      name?: string;
      nameEn?: string;
      category?: string;
      sortOrder?: number;
      isActive?: boolean;
    },
  ) {
    const ingredient = await this.prisma.ingredient.findUnique({
      where: { id },
    });

    if (!ingredient) {
      throw new NotFoundException(`성분을 찾을 수 없습니다: ${id}`);
    }

    const updated = await this.prisma.ingredient.update({
      where: { id },
      data: dto,
    });

    this.logger.log(`성분 수정: ${updated.name} (${updated.key})`);

    return updated;
  }

  /**
   * 성분 순서 템플릿 목록
   */
  async getIngredientOrderTemplates() {
    return this.prisma.ingredientOrderTemplate.findMany({
      where: { isActive: true },
      orderBy: { templateKey: 'asc' },
    });
  }

  /**
   * 성분 순서 템플릿 생성
   */
  async createIngredientOrderTemplate(dto: {
    templateKey: string;
    name: string;
    ingredientOrder: string[];
  }) {
    // key 중복 검사
    const existing = await this.prisma.ingredientOrderTemplate.findUnique({
      where: { templateKey: dto.templateKey },
    });
    if (existing) {
      throw new ConflictException(
        `이미 존재하는 templateKey입니다: ${dto.templateKey}`,
      );
    }

    // ingredientOrder 유효성 검증
    await this.validateIngredientOrder(dto.ingredientOrder);

    const template = await this.prisma.ingredientOrderTemplate.create({
      data: {
        templateKey: dto.templateKey,
        name: dto.name,
        ingredientOrder: dto.ingredientOrder,
        createdAt: getNowKST(),
      },
    });

    this.logger.log(`성분 순서 템플릿 생성: ${template.name} (${template.templateKey})`);

    return template;
  }

  /**
   * 성분 순서 템플릿 수정
   */
  async updateIngredientOrderTemplate(
    id: number,
    dto: {
      name?: string;
      ingredientOrder?: string[];
      isActive?: boolean;
    },
  ) {
    const template = await this.prisma.ingredientOrderTemplate.findUnique({
      where: { id },
    });

    if (!template) {
      throw new NotFoundException(`템플릿을 찾을 수 없습니다: ${id}`);
    }

    // ingredientOrder 유효성 검증
    if (dto.ingredientOrder) {
      await this.validateIngredientOrder(dto.ingredientOrder);
    }

    const updated = await this.prisma.ingredientOrderTemplate.update({
      where: { id },
      data: dto,
    });

    this.logger.log(`성분 순서 템플릿 수정: ${updated.name}`);

    return updated;
  }

  /**
   * HealthTypeAnimal 목록 조회 (드롭다운용)
   */
  async getHealthTypeAnimals() {
    return this.prisma.healthTypeAnimal.findMany({
      select: {
        id: true,
        healthType: true,
        typeName: true,
        animalName: true,
      },
      orderBy: { id: 'asc' },
    });
  }

  // ==================== Private Methods ====================

  /**
   * payload 기본 검증
   */
  private validatePayload(payload: object, screenType: SolutionScreenType) {
    if (!payload || typeof payload !== 'object') {
      throw new BadRequestException('payload는 객체여야 합니다');
    }

    const p = payload as Record<string, unknown>;

    if (!p.schemaVersion || typeof p.schemaVersion !== 'number') {
      throw new BadRequestException('payload.schemaVersion은 필수입니다');
    }

    // screenType별 추가 검증
    switch (screenType) {
      case SolutionScreenType.DIET_ORIGINAL:
      case SolutionScreenType.DIET_SLOW_AGING:
        if (!p.title) throw new BadRequestException('식단 payload에는 title이 필수입니다');
        break;
      case SolutionScreenType.SUPPLEMENT_SET:
      case SolutionScreenType.SUPPLEMENT_SINGLE:
        if (!p.title) throw new BadRequestException('영양제 payload에는 title이 필수입니다');
        break;
      default:
        break;
    }
  }

  /**
   * productId 유효성 검증
   */
  private async validateProductIds(payload: object) {
    const productIds = this.extractProductIds(payload);

    if (productIds.length === 0) return;

    const existingProducts = await this.prisma.product.findMany({
      where: { id: { in: productIds } },
      select: { id: true },
    });

    const existingIds = new Set(existingProducts.map((p) => p.id));
    const missingIds = productIds.filter((id) => !existingIds.has(id));

    if (missingIds.length > 0) {
      throw new BadRequestException(
        `존재하지 않는 productId가 포함되어 있습니다: ${missingIds.join(', ')}`,
      );
    }
  }

  /**
   * ingredientOrder 유효성 검증
   */
  private async validateIngredientOrder(ingredientOrder: string[]) {
    if (ingredientOrder.length === 0) return;

    const existingIngredients = await this.prisma.ingredient.findMany({
      where: { key: { in: ingredientOrder } },
      select: { key: true },
    });

    const existingKeys = new Set(existingIngredients.map((i) => i.key));
    const missingKeys = ingredientOrder.filter((key) => !existingKeys.has(key));

    if (missingKeys.length > 0) {
      throw new BadRequestException(
        `존재하지 않는 성분 key가 포함되어 있습니다: ${missingKeys.join(', ')}`,
      );
    }
  }

  /**
   * payload에서 productId 추출
   */
  private extractProductIds(payload: object): number[] {
    const ids = new Set<number>();

    const traverse = (obj: unknown) => {
      if (obj === null || obj === undefined) return;

      if (Array.isArray(obj)) {
        obj.forEach(traverse);
      } else if (typeof obj === 'object') {
        const o = obj as Record<string, unknown>;
        if (typeof o.productId === 'number') {
          ids.add(o.productId);
        }
        if (Array.isArray(o.productIds)) {
          o.productIds.forEach((id) => {
            if (typeof id === 'number') ids.add(id);
          });
        }
        Object.values(o).forEach(traverse);
      }
    };

    traverse(payload);
    return Array.from(ids);
  }

  /**
   * payload에서 ingredientKey 추출
   */
  private extractIngredientKeys(payload: object): string[] {
    const keys = new Set<string>();

    const traverse = (obj: unknown) => {
      if (obj === null || obj === undefined) return;

      if (Array.isArray(obj)) {
        obj.forEach(traverse);
      } else if (typeof obj === 'object') {
        const o = obj as Record<string, unknown>;
        if (typeof o.ingredientKey === 'string') {
          keys.add(o.ingredientKey);
        }
        Object.values(o).forEach(traverse);
      }
    };

    traverse(payload);
    return Array.from(keys);
  }
}
