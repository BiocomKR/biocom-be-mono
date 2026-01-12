import {
  Controller,
  Post,
  Get,
  Delete,
  Param,
  Query,
  Req,
  UseInterceptors,
  UploadedFile,
  UploadedFiles,
  ParseIntPipe,
  HttpStatus,
  Logger,
  BadRequestException,
  UseGuards
} from '@nestjs/common';
import { FileInterceptor, FilesInterceptor } from '@nestjs/platform-express';
import { 
  ApiTags, 
  ApiOperation, 
  ApiResponse, 
  ApiConsumes,
  ApiBody,
  ApiParam,
  ApiQuery as ApiQueryDecorator,
  ApiBearerAuth
} from '@nestjs/swagger';
import { Express } from 'express';
import * as fs from 'fs';
import { UploadService } from './upload.service';
import { FileUploadResponseDto } from './dto/file-upload-response.dto';
import { FoodAnalysisResponseDto } from './dto/food-analysis-response.dto';
import { FaceSlimmingResponseDto } from './dto/face-slimming-response.dto';
import { ApiResponseDto } from '../common/dto/api-response.dto';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';
import { FoodCalorieService } from './food-calorie.service';
import { FaceSlimmingService } from './face-slimming.service';
import { getNowKST } from '../common/utils/kst-date.util';

/**
 * 파일 업로드 컨트롤러
 * 활동 기록과 연관된 이미지 파일 업로드 API
 */
@ApiTags('헬스케어-이미지 분석')
@Controller('upload')
export class UploadController {
  private readonly logger = new Logger(UploadController.name);

  constructor(
    private readonly uploadService: UploadService,
    private readonly foodCalorieService: FoodCalorieService,
    private readonly faceSlimmingService: FaceSlimmingService
  ) {}

  /**
   * 이미지 파일 업로드
   */
  @Post('image')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ 
    summary: '이미지 파일 업로드', 
    description: '활동 기록과 연관된 이미지 파일을 업로드합니다.' 
  })
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
      },
      required: ['file'],
    },
  })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: '파일 업로드 성공',
    type: ApiResponseDto
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: '잘못된 파일 형식 또는 크기' 
  })
  @ApiQueryDecorator({
    name: 'relatedType',
    required: true,
    description: '연관된 활동 타입 (DIET, DAILY_MISSION, SUPPLEMENT, ACTIVITY, QUIZ, REVIEW, QNA, PROFILE)',
    example: 'DIET'
  })
  async uploadImage(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File,
    @Query('relatedType') relatedType: string
  ): Promise<ApiResponseDto<FileUploadResponseDto>> {
    if (!file) {
      throw new BadRequestException('파일이 업로드되지 않았습니다.');
    }

    if (!relatedType) {
      throw new BadRequestException('연관된 활동 타입(relatedType)을 지정해주세요.');
    }

    this.logger.log(`이미지 업로드 요청 - 사용자: ${req.user.sub}, 파일: ${file.originalname}, 타입: ${relatedType}`);

    const uploadedFile = await this.uploadService.uploadImage(
      req.user.sub,
      file,
      relatedType
    );

    return {
      success: true,
      message: '이미지가 성공적으로 업로드되었습니다.',
      data: uploadedFile,
      timestamp: getNowKST(),
    };
  }

  /**
   * 다중 이미지 파일 업로드
   */
  @Post('images')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @UseInterceptors(FilesInterceptor('files', 10)) // 최대 10개 파일
  @ApiOperation({
    summary: '다중 이미지 파일 업로드',
    description: '여러 이미지 파일을 한 번에 업로드합니다. 최대 10개까지 가능합니다.'
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        files: {
          type: 'array',
          items: {
            type: 'string',
            format: 'binary',
          },
          description: '업로드할 이미지 파일들 (최대 10개)',
        },
      },
      required: ['files'],
    },
  })
  @ApiResponse({
    status: HttpStatus.CREATED,
    description: '파일 업로드 성공',
    type: ApiResponseDto
  })
  @ApiResponse({
    status: HttpStatus.BAD_REQUEST,
    description: '잘못된 파일 형식 또는 크기'
  })
  @ApiQueryDecorator({
    name: 'relatedType',
    required: true,
    description: '연관된 활동 타입 (DIET, DAILY_MISSION, SUPPLEMENT, ACTIVITY, QUIZ, REVIEW, QNA, PROFILE)',
    example: 'DIET'
  })
  async uploadImages(
    @Req() req: any,
    @UploadedFiles() files: Express.Multer.File[],
    @Query('relatedType') relatedType: string
  ): Promise<ApiResponseDto<FileUploadResponseDto[]>> {
    if (!files || files.length === 0) {
      throw new BadRequestException('파일이 업로드되지 않았습니다.');
    }

    if (!relatedType) {
      throw new BadRequestException('연관된 활동 타입(relatedType)을 지정해주세요.');
    }

    this.logger.log(`다중 이미지 업로드 요청 - 사용자: ${req.user.sub}, 파일 수: ${files.length}, 타입: ${relatedType}`);

    // 각 파일을 순차적으로 업로드
    const uploadedFiles: FileUploadResponseDto[] = [];

    for (const file of files) {
      try {
        const uploadedFile = await this.uploadService.uploadImage(
          req.user.sub,
          file,
          relatedType
        );
        uploadedFiles.push(uploadedFile);
      } catch (error) {
        this.logger.error(`파일 업로드 실패 - 파일: ${file.originalname}, 에러: ${error.message}`);
        // 실패한 파일은 건너뛰고 계속 진행
      }
    }

    if (uploadedFiles.length === 0) {
      throw new BadRequestException('모든 파일 업로드에 실패했습니다.');
    }

    return {
      success: true,
      message: `${uploadedFiles.length}개의 이미지가 성공적으로 업로드되었습니다.`,
      data: uploadedFiles,
      timestamp: getNowKST(),
    };
  }

  /**
   * 파일 정보 조회
   */
  @Get(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: '파일 정보 조회', 
    description: '특정 파일의 정보를 조회합니다.' 
  })
  @ApiParam({ 
    name: 'id', 
    description: '파일 ID',
    example: 1 
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: '파일 정보 조회 성공',
    type: ApiResponseDto
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: '파일을 찾을 수 없음' 
  })
  async getFileInfo(
    @Param('id', ParseIntPipe) id: number
  ): Promise<ApiResponseDto<FileUploadResponseDto>> {
    this.logger.log(`파일 정보 조회 요청 - ID: ${id}`);

    const file = await this.uploadService.getFileInfo(id);

    return {
      success: true,
      message: '파일 정보가 성공적으로 조회되었습니다.',
      data: file,
      timestamp: getNowKST(),
    };
  }

  /**
   * 사용자의 업로드 파일 목록 조회
   */
  @Get()
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: '업로드 파일 목록 조회', 
    description: '현재 사용자의 업로드된 파일 목록을 조회합니다.' 
  })
  @ApiQueryDecorator({ 
    name: 'relatedType', 
    required: false,
    description: '연관된 활동 타입으로 필터링',
    example: 'DIET' 
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: '파일 목록 조회 성공',
    type: ApiResponseDto
  })
  async getUserFiles(
    @Req() req: any,
    @Query('relatedType') relatedType?: string
  ): Promise<ApiResponseDto<FileUploadResponseDto[]>> {
    this.logger.log(`사용자 파일 목록 조회 요청 - 사용자: ${req.user.sub}, 타입: ${relatedType || '전체'}`);

    const files = await this.uploadService.getUserFiles(
      req.user.sub,
      relatedType
    );

    return {
      success: true,
      message: '파일 목록이 성공적으로 조회되었습니다.',
      data: files,
      timestamp: getNowKST(),
    };
  }

  /**
   * 파일 삭제
   */
  @Delete(':id')
  @UseGuards(JwtAuthGuard)
  @ApiBearerAuth()
  @ApiOperation({ 
    summary: '파일 삭제', 
    description: '업로드된 파일을 삭제합니다.' 
  })
  @ApiParam({ 
    name: 'id', 
    description: '삭제할 파일 ID',
    example: 1 
  })
  @ApiResponse({ 
    status: HttpStatus.OK, 
    description: '파일 삭제 성공',
    type: ApiResponseDto
  })
  @ApiResponse({ 
    status: HttpStatus.NOT_FOUND, 
    description: '파일을 찾을 수 없거나 삭제 권한 없음' 
  })
  async deleteFile(
    @Req() req: any,
    @Param('id', ParseIntPipe) id: number
  ): Promise<ApiResponseDto<void>> {
    this.logger.log(`파일 삭제 요청 - 사용자: ${req.user.sub}, ID: ${id}`);

    await this.uploadService.deleteFile(id, req.user.sub);

    return {
      success: true,
      message: '파일이 성공적으로 삭제되었습니다.',
      timestamp: getNowKST(),
    };
  }

  /**
   * 음식 이미지 분석 (GPT-4 AI 활용)
   */
  @Post('food-analysis')
  // @UseGuards(JwtAuthGuard)  // 테스트를 위해 임시 제거
  // @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ 
    summary: '음식 이미지 AI 분석', 
    description: 'GPT-5 모델을 활용하여 음식 이미지를 분석하고 칼로리 및 재료 정보를 제공합니다.' 
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: '분석할 음식 이미지 파일',
        },
      },
      required: ['file'],
    },
  })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: '음식 이미지 분석 완료',
    type: ApiResponseDto
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: '잘못된 파일 형식 또는 AI 분석 실패' 
  })
  @ApiResponse({ 
    status: HttpStatus.SERVICE_UNAVAILABLE, 
    description: 'AI 모델이 로드되지 않음' 
  })
  async analyzeFoodImage(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File
  ): Promise<ApiResponseDto<FoodAnalysisResponseDto>> {
    if (!file) {
      throw new BadRequestException('분석할 이미지 파일이 업로드되지 않았습니다.');
    }

    // AI 모델 준비 상태 확인
    if (!this.foodCalorieService.isReady()) {
      this.logger.error('음식 칼로리 계산 모델이 준비되지 않았습니다');
      throw new BadRequestException('AI 분석 서비스가 현재 사용 불가능합니다. 잠시 후 다시 시도해주세요.');
    }

    this.logger.log(`음식 이미지 분석 요청 - 사용자: ${req.user ? req.user.sub : '테스트'}, 파일: ${file.originalname}, 크기: ${file.size}bytes`);

    try {
      // Multer diskStorage를 사용하므로 file.path에서 파일을 읽어 Buffer로 변환
      let imageBuffer: Buffer;
      
      if (file.buffer) {
        // memoryStorage를 사용한 경우 (buffer가 있는 경우)
        imageBuffer = file.buffer;
        this.logger.debug(`메모리에서 파일 버퍼 사용 - 크기: ${imageBuffer.length}bytes`);
      } else if (file.path) {
        // diskStorage를 사용한 경우 (path에서 파일 읽기)
        imageBuffer = fs.readFileSync(file.path);
        this.logger.debug(`디스크에서 파일 읽기 완료 - 경로: ${file.path}, 크기: ${imageBuffer.length}bytes`);
        
        // 분석 후 임시 파일 삭제
        setTimeout(() => {
          try {
            fs.unlinkSync(file.path);
            this.logger.debug(`임시 파일 삭제 완료: ${file.path}`);
          } catch (error) {
            this.logger.warn(`임시 파일 삭제 실패: ${file.path}, 에러: ${error.message}`);
          }
        }, 1000);
      } else {
        throw new Error('파일 데이터가 없습니다. buffer와 path 모두 undefined입니다.');
      }

      // 음식 칼로리 계산 서비스로 음식 이미지 분석 (이미지 리사이징 포함, Google Storage 업로드)
      const analysisResult = await this.foodCalorieService.analyzeFoodImage(imageBuffer, file.originalname);

      // 음식 항목이 있는지 확인
      const hasFood = analysisResult.food_items && analysisResult.food_items.length > 0;
      const foodNames = hasFood 
        ? analysisResult.food_items.map(item => item.name).join(', ')
        : '음식 없음';

      this.logger.log(`음식 분석 완료 - 항목: ${analysisResult.food_items.length}개, 음식명: ${foodNames}`);

      return {
        success: true,
        message: hasFood 
          ? `${foodNames} 분석이 완료되었습니다.`
          : '음식이 감지되지 않았습니다.',
        data: analysisResult,
        timestamp: getNowKST(),
      };

    } catch (error) {
      this.logger.error(`음식 이미지 분석 실패 - 사용자: ${req.user ? req.user.sub : '테스트'}, 에러: ${error.message}`);
      
      // 분석 실패 시에도 구조화된 응답 반환
      const failedResult: FoodAnalysisResponseDto = {
        food_items: [],
        total: { calories: 0, protein: 0, carbs: 0, fat: 0 },
        errorMessage: `AI 분석 중 오류가 발생했습니다: ${error.message}`
      };

      return {
        success: false,
        message: 'AI 분석에 실패했습니다.',
        data: failedResult,
        timestamp: getNowKST(),
      };
    }
  }

  /**
   * 얼굴 슬리밍 이미지 생성 (Google Gemini AI 활용)
   * FastAPI 포팅 버전 - 재시도 로직 및 구글 스토리지 업로드 포함
   */
  @Post('face-slimming')
  // @UseGuards(JwtAuthGuard)  // 테스트를 위해 임시 제거
  // @ApiBearerAuth()
  @UseInterceptors(FileInterceptor('file'))
  @ApiOperation({ 
    summary: '얼굴 슬리밍 이미지 생성', 
    description: 'Google Gemini AI를 활용하여 얼굴을 5-30kg 홀쭉하게 만든 이미지를 생성합니다. 생성된 이미지는 구글 스토리지에 저장됩니다.' 
  })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: {
        file: {
          type: 'string',
          format: 'binary',
          description: '슬리밍 처리할 얼굴 이미지 파일 (jpg, png)',
        }
      },
      required: ['file'],
    },
  })
  @ApiResponse({ 
    status: HttpStatus.CREATED, 
    description: '얼굴 슬리밍 이미지 생성 완료',
    type: ApiResponseDto
  })
  @ApiResponse({ 
    status: HttpStatus.BAD_REQUEST, 
    description: '잘못된 파일 형식 또는 AI 생성 실패' 
  })
  @ApiResponse({ 
    status: HttpStatus.SERVICE_UNAVAILABLE, 
    description: 'AI 모델이 로드되지 않음' 
  })
  async createSlimmedFace(
    @Req() req: any,
    @UploadedFile() file: Express.Multer.File
  ): Promise<ApiResponseDto<FaceSlimmingResponseDto>> {
    // weightLoss 기본값 5로 설정 (스웨거에서 제거됨)
    const weightLoss = 5;
    console.log(`[UploadController] 🎨 얼굴 슬리밍 메서드 시작!`);
    console.log(`[UploadController] 📁 파일 정보:`, {
      hasFile: !!file,
      originalname: file?.originalname,
      size: file?.size,
      mimetype: file?.mimetype
    });
    console.log(`[UploadController] ⚖️ 체중감량 값: ${weightLoss}kg`);
    
    if (!file) {
      console.log(`[UploadController] ❌ 파일이 없어서 BadRequest 에러 발생`);
      throw new BadRequestException('슬리밍 처리할 얼굴 이미지 파일이 업로드되지 않았습니다.');
    }

    // 체중 감량 값 검증
    if (weightLoss < 1 || weightLoss > 30) {
      console.log(`[UploadController] ❌ 체중감량 값이 범위를 벗어남: ${weightLoss}kg`);
      throw new BadRequestException('체중 감량 값은 1kg에서 30kg 사이여야 합니다.');
    }

    // AI 모델 준비 상태 확인
    console.log(`[UploadController] 🤖 AI 모델 준비 상태 확인 중...`);
    if (!this.faceSlimmingService.isReady()) {
      console.log(`[UploadController] ❌ AI 모델이 준비되지 않음`);
      this.logger.error('Google Gemini AI 모델이 준비되지 않았습니다');
      throw new BadRequestException('얼굴 슬리밍 서비스가 현재 사용 불가능합니다. 잠시 후 다시 시도해주세요.');
    }
    console.log(`[UploadController] ✅ AI 모델 준비 상태 OK`);

    this.logger.log(`얼굴 슬리밍 요청 - 사용자: ${req.user ? req.user.sub : '테스트'}, 파일: ${file.originalname}, 크기: ${file.size}bytes, 체중감량: ${weightLoss}kg`);

    try {
      // Multer diskStorage를 사용하므로 file.path에서 파일을 읽어 Buffer로 변환
      let imageBuffer: Buffer;
      
      if (file.buffer) {
        // memoryStorage를 사용한 경우 (buffer가 있는 경우)
        imageBuffer = file.buffer;
        this.logger.debug(`메모리에서 파일 버퍼 사용 - 크기: ${imageBuffer.length}bytes`);
      } else if (file.path) {
        // diskStorage를 사용한 경우 (path에서 파일 읽기)
        imageBuffer = fs.readFileSync(file.path);
        this.logger.debug(`디스크에서 파일 읽기 완료 - 경로: ${file.path}, 크기: ${imageBuffer.length}bytes`);
        
        // 처리 후 임시 파일 삭제
        setTimeout(() => {
          try {
            fs.unlinkSync(file.path);
            this.logger.debug(`임시 파일 삭제 완료: ${file.path}`);
          } catch (error) {
            this.logger.warn(`임시 파일 삭제 실패: ${file.path}, 에러: ${error.message}`);
          }
        }, 1000);
      } else {
        throw new Error('파일 데이터가 없습니다. buffer와 path 모두 undefined입니다.');
      }

      // 얼굴 슬리밍 처리 (재시도 로직 포함)
      const slimmingResult = await this.faceSlimmingService.processImageSlimming(
        imageBuffer,
        weightLoss,
        file.originalname
      );

      if (slimmingResult.success) {
        this.logger.log(`얼굴 슬리밍 완료 - 처리시간: ${slimmingResult.processingTime}초, 재시도: ${slimmingResult.retryCount}회, 원본: ${slimmingResult.beforeImageUrl}, 처리본: ${slimmingResult.afterImageUrl}`);

        return {
          success: true,
          message: `${weightLoss}kg 체중 감량 효과의 얼굴 슬리밍 이미지가 생성되었습니다.`,
          data: slimmingResult,
          timestamp: getNowKST(),
        };
      } else {
        this.logger.error(`얼굴 슬리밍 실패 - 에러: ${slimmingResult.errorMessage}`);

        return {
          success: false,
          message: '얼굴 슬리밍 처리에 실패했습니다.',
          data: slimmingResult,
          timestamp: getNowKST(),
        };
      }

    } catch (error) {
      this.logger.error(`얼굴 슬리밍 처리 중 예외 발생 - 사용자: ${req.user ? req.user.sub : '테스트'}, 에러: ${error.message}`);
      
      // 처리 실패 시에도 구조화된 응답 반환
      const failedResult: FaceSlimmingResponseDto = {
        beforeImageUrl: '',
        afterImageUrl: '',
        weightLoss,
        processingTime: 0,
        originalFileName: file.originalname,
        success: false,
        errorMessage: `얼굴 슬리밍 처리 중 오류가 발생했습니다: ${error.message}`,
        retryCount: 0
      };

      return {
        success: false,
        message: '얼굴 슬리밍 처리에 실패했습니다.',
        data: failedResult,
        timestamp: getNowKST(),
      };
    }
  }
}