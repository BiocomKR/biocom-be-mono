import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Query,
  Body,
  UseGuards,
  ParseIntPipe,
  UseInterceptors,
  UploadedFile,
} from '@nestjs/common';
import { ApiTags, ApiBearerAuth, ApiConsumes } from '@nestjs/swagger';
import { FileInterceptor } from '@nestjs/platform-express';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { AnimalService } from './animal.service';
import { UploadService } from '../upload/upload.service';

@ApiTags('동물 관리')
@ApiBearerAuth()
@Controller('master/animals')
@UseGuards(JwtAuthGuard)
export class AnimalController {
  constructor(
    private readonly animalService: AnimalService,
    private readonly uploadService: UploadService,
  ) {}

  /**
   * 동물 목록 조회
   */
  @Get()
  async getAnimals(
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.animalService.getAnimals({
      search,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      sortBy,
      sortOrder: sortOrder as 'asc' | 'desc' | undefined,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
    });
  }

  /**
   * 동물 이미지 업로드
   */
  @Post('upload-image')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadAnimalImage(@UploadedFile() file: Express.Multer.File) {
    const result = await this.uploadService.uploadProductImage(file);
    return {
      imageUrl: result.filePath,
      fileId: result.id,
    };
  }

  /**
   * 동물 상세 조회
   */
  @Get(':id')
  async getAnimalById(@Param('id', ParseIntPipe) id: number) {
    return this.animalService.getAnimalById(id);
  }

  /**
   * 동물 생성
   */
  @Post()
  async createAnimal(@Body() dto: any) {
    return this.animalService.createAnimal(dto);
  }

  /**
   * 동물 수정
   */
  @Put(':id')
  async updateAnimal(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: any,
  ) {
    return this.animalService.updateAnimal(id, dto);
  }

  /**
   * 동물 삭제
   */
  @Delete(':id')
  async deleteAnimal(@Param('id', ParseIntPipe) id: number) {
    return this.animalService.deleteAnimal(id);
  }

  /**
   * 동물 활성화/비활성화 토글
   */
  @Put(':id/toggle-active')
  async toggleAnimalActive(@Param('id', ParseIntPipe) id: number) {
    return this.animalService.toggleAnimalActive(id);
  }

  /**
   * 동물 파일 추가
   */
  @Post(':id/files')
  async addAnimalFile(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { fileId: number; imageType: string; sortOrder?: number },
  ) {
    return this.animalService.addAnimalFile(id, dto);
  }

  /**
   * 동물 파일 삭제
   */
  @Delete(':id/files/:fileRelationId')
  async removeAnimalFile(
    @Param('id', ParseIntPipe) id: number,
    @Param('fileRelationId', ParseIntPipe) fileRelationId: number,
  ) {
    return this.animalService.removeAnimalFile(id, fileRelationId);
  }

  /**
   * 동물 파일 순서 변경
   */
  @Put(':id/files/reorder')
  async reorderAnimalFiles(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: { fileOrders: { id: number; sortOrder: number }[] },
  ) {
    return this.animalService.reorderAnimalFiles(id, dto.fileOrders);
  }
}
