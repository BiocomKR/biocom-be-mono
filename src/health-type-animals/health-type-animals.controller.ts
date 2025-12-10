import {
  Controller,
  Get,
  Post,
  Delete,
  Patch,
  Param,
  Query,
  Body,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  ParseIntPipe,
  HttpStatus,
  Logger,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiQuery,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import {
  HealthTypeAnimalsService,
  AnimalImageType,
} from './health-type-animals.service';
import { ApiResponseDto } from '../common/dto/api-response.dto';
import { getNowKST } from '../common/utils/kst-date.util';

@ApiTags('건강타입 동물 관리')
@Controller('health-type-animals')
@UseGuards(JwtAuthGuard)
@ApiBearerAuth()
export class HealthTypeAnimalsController {
  private readonly logger = new Logger(HealthTypeAnimalsController.name);

  constructor(
    private readonly healthTypeAnimalsService: HealthTypeAnimalsService,
  ) {}

  /**
   * 건강 타입 동물 목록 조회
   */
  @Get()
  @ApiOperation({
    summary: '건강 타입 동물 목록 조회',
    description: '모든 건강 타입 동물과 연결된 이미지를 조회합니다.',
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '목록 조회 성공',
  })
  async findAll(): Promise<ApiResponseDto<any>> {
    const data = await this.healthTypeAnimalsService.findAll();
    return {
      success: true,
      message: '건강 타입 동물 목록 조회 성공',
      data,
      timestamp: getNowKST(),
    };
  }

  /**
   * 건강 타입 동물 단일 조회
   */
  @Get(':id')
  @ApiOperation({
    summary: '건강 타입 동물 단일 조회',
    description: '특정 건강 타입 동물과 연결된 이미지를 조회합니다.',
  })
  @ApiParam({ name: 'id', description: '건강 타입 동물 ID' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '조회 성공',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '건강 타입 동물을 찾을 수 없음',
  })
  async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ApiResponseDto<any>> {
    const data = await this.healthTypeAnimalsService.findOne(id);
    return {
      success: true,
      message: '건강 타입 동물 조회 성공',
      data,
      timestamp: getNowKST(),
    };
  }

  /**
   * 이미지 업로드 및 매핑
   */
  @Post(':id/images')
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({
    summary: '건강 타입 동물 이미지 업로드',
    description:
      '건강 타입 동물에 이미지를 업로드하고 매핑합니다. imageType: THUMBNAIL(썸네일) 또는 DESCRIPTION(설명 이미지)',
  })
  @ApiParam({ name: 'id', description: '건강 타입 동물 ID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: '업로드할 이미지 파일',
        },
        imageType: {
          type: 'string',
          enum: ['THUMBNAIL', 'DESCRIPTION'],
          description: '이미지 타입',
          example: 'THUMBNAIL',
        },
        sortOrder: {
          type: 'number',
          description: '정렬 순서 (기본값: 0)',
          example: 0,
        },
      },
      required: ['file', 'imageType'],
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: '이미지 업로드 성공',
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: '잘못된 요청',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '건강 타입 동물을 찾을 수 없음',
  })
  async uploadImage(
    @Param('id', ParseIntPipe) id: number,
    @UploadedFile() file: Express.Multer.File,
    @Body('imageType') imageType: string,
    @Body('sortOrder') sortOrder?: string,
  ): Promise<ApiResponseDto<any>> {
    if (!file) {
      throw new BadRequestException('파일이 업로드되지 않았습니다.');
    }

    if (!imageType) {
      throw new BadRequestException('이미지 타입(imageType)을 지정해주세요.');
    }

    // imageType 검증
    const upperImageType = imageType.toUpperCase();
    if (!Object.values(AnimalImageType).includes(upperImageType as AnimalImageType)) {
      throw new BadRequestException(
        `유효하지 않은 이미지 타입입니다. (THUMBNAIL 또는 DESCRIPTION)`,
      );
    }

    this.logger.log(
      `이미지 업로드 요청 - animalId: ${id}, type: ${upperImageType}, file: ${file.originalname}`,
    );

    const data = await this.healthTypeAnimalsService.uploadAndMapImage(
      id,
      file,
      upperImageType as AnimalImageType,
      sortOrder ? parseInt(sortOrder, 10) : 0,
    );

    return {
      success: true,
      message: '이미지 업로드 성공',
      data,
      timestamp: getNowKST(),
    };
  }

  /**
   * 이미지 삭제
   */
  @Delete('images/:imageId')
  @ApiOperation({
    summary: '건강 타입 동물 이미지 삭제',
    description: '건강 타입 동물에 매핑된 이미지를 삭제합니다.',
  })
  @ApiParam({ name: 'imageId', description: '이미지 매핑 ID (healthTypeAnimalFileId)' })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '이미지 삭제 성공',
  })
  @ApiResponse({
    status: HttpStatus.NOT_FOUND,
    description: '이미지를 찾을 수 없음',
  })
  async deleteImage(
    @Param('imageId', ParseIntPipe) imageId: number,
  ): Promise<ApiResponseDto<any>> {
    this.logger.log(`이미지 삭제 요청 - imageId: ${imageId}`);

    const data = await this.healthTypeAnimalsService.deleteImage(imageId);

    return {
      success: true,
      message: '이미지 삭제 성공',
      data,
      timestamp: getNowKST(),
    };
  }

  /**
   * 이미지 정렬 순서 변경
   */
  @Patch('images/:imageId/sort-order')
  @ApiOperation({
    summary: '이미지 정렬 순서 변경',
    description: '건강 타입 동물 이미지의 정렬 순서를 변경합니다.',
  })
  @ApiParam({ name: 'imageId', description: '이미지 매핑 ID (healthTypeAnimalFileId)' })
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        sortOrder: {
          type: 'number',
          description: '새 정렬 순서',
          example: 1,
        },
      },
      required: ['sortOrder'],
    },
  })
  @ApiResponse({
    status: HttpStatus.OK,
    description: '정렬 순서 변경 성공',
  })
  async updateSortOrder(
    @Param('imageId', ParseIntPipe) imageId: number,
    @Body('sortOrder') sortOrder: number,
  ): Promise<ApiResponseDto<any>> {
    if (sortOrder === undefined || sortOrder === null) {
      throw new BadRequestException('정렬 순서(sortOrder)를 지정해주세요.');
    }

    const data = await this.healthTypeAnimalsService.updateImageSortOrder(
      imageId,
      sortOrder,
    );

    return {
      success: true,
      message: '정렬 순서 변경 성공',
      data,
      timestamp: getNowKST(),
    };
  }
}
