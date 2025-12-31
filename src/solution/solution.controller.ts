import {
  Controller,
  Get,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth } from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { SolutionService } from './solution.service';

@ApiTags('맞춤솔루션 관리')
@ApiBearerAuth()
@Controller('solution')
@UseGuards(JwtAuthGuard)
export class SolutionController {
  constructor(private readonly solutionService: SolutionService) {}

  /**
   * 건강유형 동물 목록 조회
   */
  @Get('health-type-animals')
  async getHealthTypeAnimals(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.solutionService.getHealthTypeAnimals({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  /**
   * 건강유형 추천상품 목록 조회
   */
  @Get('health-type-animal-products')
  async getHealthTypeAnimalProducts(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('healthTypeAnimalId') healthTypeAnimalId?: string,
  ) {
    return this.solutionService.getHealthTypeAnimalProducts({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      healthTypeAnimalId: healthTypeAnimalId ? parseInt(healthTypeAnimalId) : undefined,
    });
  }

  /**
   * 라인업 목록 조회
   */
  @Get('product-lineups')
  async getProductLineups(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.solutionService.getProductLineups({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
    });
  }

  /**
   * 솔루션 관련 상품 목록 조회
   */
  @Get('products')
  async getSolutionProducts(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('categoryCode') categoryCode?: string,
  ) {
    return this.solutionService.getSolutionProducts({
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 20,
      categoryCode,
    });
  }
}
