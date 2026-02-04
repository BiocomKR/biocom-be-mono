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
import { PersonaService } from './persona.service';
import { UploadService } from '../upload/upload.service';

@ApiTags('페르소나 관리')
@ApiBearerAuth()
@Controller('master/personas')
@UseGuards(JwtAuthGuard)
export class PersonaController {
  constructor(
    private readonly personaService: PersonaService,
    private readonly uploadService: UploadService,
  ) {}

  /**
   * 페르소나 목록 조회
   */
  @Get()
  async getPersonas(
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
    @Query('sortBy') sortBy?: string,
    @Query('sortOrder') sortOrder?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ) {
    return this.personaService.getPersonas({
      search,
      isActive: isActive === 'true' ? true : isActive === 'false' ? false : undefined,
      sortBy,
      sortOrder: sortOrder as 'asc' | 'desc' | undefined,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 10,
    });
  }

  /**
   * 페르소나 이미지 업로드
   */
  @Post('upload-image')
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(FileInterceptor('file'))
  async uploadPersonaImage(@UploadedFile() file: Express.Multer.File) {
    const result = await this.uploadService.uploadProductImage(file);
    return {
      imageUrl: result.filePath,
      fileId: result.id,
    };
  }

  /**
   * 페르소나 상세 조회
   */
  @Get(':id')
  async getPersonaById(@Param('id', ParseIntPipe) id: number) {
    return this.personaService.getPersonaById(id);
  }

  /**
   * 페르소나 생성
   */
  @Post()
  async createPersona(@Body() dto: any) {
    return this.personaService.createPersona(dto);
  }

  /**
   * 페르소나 수정
   */
  @Put(':id')
  async updatePersona(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: any,
  ) {
    return this.personaService.updatePersona(id, dto);
  }

  /**
   * 페르소나 삭제
   */
  @Delete(':id')
  async deletePersona(@Param('id', ParseIntPipe) id: number) {
    return this.personaService.deletePersona(id);
  }

  /**
   * 페르소나 활성화/비활성화 토글
   */
  @Put(':id/toggle-active')
  async togglePersonaActive(@Param('id', ParseIntPipe) id: number) {
    return this.personaService.togglePersonaActive(id);
  }
}
