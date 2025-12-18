import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  ParseIntPipe,
  Req,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SolutionService } from './solution.service';
import { SolutionScreenType } from '@prisma/client';

@ApiTags('맞춤 솔루션 관리')
@ApiBearerAuth()
@Controller('solution')
@UseGuards(JwtAuthGuard)
export class SolutionController {
  constructor(private readonly solutionService: SolutionService) {}

  // ==================== 화면 관리 ====================

  /**
   * 화면 목록 조회
   */
  @Get('screens')
  async getScreens(
    @Query('screenType') screenType?: SolutionScreenType,
    @Query('healthTypeAnimalId') healthTypeAnimalId?: string,
    @Query('isActive') isActive?: string,
    @Query('search') search?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.solutionService.getScreens({
      screenType,
      healthTypeAnimalId: healthTypeAnimalId
        ? parseInt(healthTypeAnimalId)
        : undefined,
      isActive:
        isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      search,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  /**
   * 화면 상세 조회
   */
  @Get('screens/:screenKey')
  async getScreen(@Param('screenKey') screenKey: string) {
    return this.solutionService.getScreenByKey(screenKey);
  }

  /**
   * 화면 생성
   */
  @Post('screens')
  async createScreen(
    @Body()
    dto: {
      screenKey: string;
      screenType: SolutionScreenType;
      healthTypeAnimalId?: number;
    },
  ) {
    return this.solutionService.createScreen(dto);
  }

  /**
   * 화면 삭제
   */
  @Delete('screens/:screenKey')
  async deleteScreen(@Param('screenKey') screenKey: string) {
    return this.solutionService.deleteScreen(screenKey);
  }

  /**
   * 화면 활성/비활성 토글
   */
  @Patch('screens/:screenKey/active')
  async toggleActive(
    @Param('screenKey') screenKey: string,
    @Body('isActive') isActive: boolean,
  ) {
    return this.solutionService.toggleScreenActive(screenKey, isActive);
  }

  // ==================== DRAFT 관리 ====================

  /**
   * DRAFT 조회 (없으면 PUBLISHED에서 복제하여 생성)
   */
  @Get('screens/:screenKey/draft')
  async getDraft(
    @Param('screenKey') screenKey: string,
    @Req() req: any,
  ) {
    return this.solutionService.getDraft(screenKey, req.user.id);
  }

  /**
   * DRAFT 저장
   */
  @Post('screens/:screenKey/draft')
  async saveDraft(
    @Param('screenKey') screenKey: string,
    @Body('payload') payload: object,
    @Req() req: any,
  ) {
    return this.solutionService.saveDraft(screenKey, payload, req.user.id);
  }

  // ==================== 배포/롤백 ====================

  /**
   * 배포
   */
  @Post('screens/:screenKey/publish')
  async publish(
    @Param('screenKey') screenKey: string,
    @Req() req: any,
  ) {
    return this.solutionService.publish(screenKey, req.user.id);
  }

  /**
   * 롤백
   */
  @Post('screens/:screenKey/rollback')
  async rollback(
    @Param('screenKey') screenKey: string,
    @Body('versionId', ParseIntPipe) versionId: number,
    @Req() req: any,
  ) {
    return this.solutionService.rollback(screenKey, versionId, req.user.id);
  }

  // ==================== 버전 관리 ====================

  /**
   * 버전 목록 조회
   */
  @Get('screens/:screenKey/versions')
  async getVersions(@Param('screenKey') screenKey: string) {
    return this.solutionService.getVersions(screenKey);
  }

  /**
   * 버전 상세 조회
   */
  @Get('screens/:screenKey/versions/:versionId')
  async getVersion(
    @Param('screenKey') screenKey: string,
    @Param('versionId', ParseIntPipe) versionId: number,
  ) {
    return this.solutionService.getVersion(screenKey, versionId);
  }

  // ==================== 미리보기 ====================

  /**
   * 미리보기 데이터 조회
   */
  @Get('screens/:screenKey/preview')
  async getPreview(@Param('screenKey') screenKey: string) {
    return this.solutionService.getPreview(screenKey);
  }

  // ==================== 성분 관리 ====================

  /**
   * 성분 목록 조회
   */
  @Get('ingredients')
  async getIngredients(
    @Query('category') category?: string,
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.solutionService.getIngredients({
      category,
      search,
      isActive:
        isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50,
    });
  }

  /**
   * 성분 생성
   */
  @Post('ingredients')
  async createIngredient(
    @Body()
    dto: {
      key: string;
      code: string;
      name: string;
      nameEn?: string;
      category?: string;
      sortOrder?: number;
    },
  ) {
    return this.solutionService.createIngredient(dto);
  }

  /**
   * 성분 수정
   */
  @Put('ingredients/:id')
  async updateIngredient(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    dto: {
      name?: string;
      nameEn?: string;
      category?: string;
      sortOrder?: number;
      isActive?: boolean;
    },
  ) {
    return this.solutionService.updateIngredient(id, dto);
  }

  // ==================== 성분 순서 템플릿 ====================

  /**
   * 템플릿 목록 조회
   */
  @Get('ingredient-templates')
  async getIngredientOrderTemplates() {
    return this.solutionService.getIngredientOrderTemplates();
  }

  /**
   * 템플릿 생성
   */
  @Post('ingredient-templates')
  async createIngredientOrderTemplate(
    @Body()
    dto: {
      templateKey: string;
      name: string;
      ingredientOrder: string[];
    },
  ) {
    return this.solutionService.createIngredientOrderTemplate(dto);
  }

  /**
   * 템플릿 수정
   */
  @Put('ingredient-templates/:id')
  async updateIngredientOrderTemplate(
    @Param('id', ParseIntPipe) id: number,
    @Body()
    dto: {
      name?: string;
      ingredientOrder?: string[];
      isActive?: boolean;
    },
  ) {
    return this.solutionService.updateIngredientOrderTemplate(id, dto);
  }

  // ==================== 참조 데이터 ====================

  /**
   * HealthTypeAnimal 목록 조회 (드롭다운용)
   */
  @Get('health-type-animals')
  async getHealthTypeAnimals() {
    return this.solutionService.getHealthTypeAnimals();
  }
}
