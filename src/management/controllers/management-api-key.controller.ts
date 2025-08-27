import {
  Controller,
  Get,
  Post,
  Body,
  Param,
  ParseIntPipe,
  Put,
  Delete,
  HttpStatus,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { ApiKeyGuard } from '../guards/api-key.guard';
import { ApiKeyService } from '../services/api-key.service';
import { CreateApiKeyDto } from '../dto/create-api-key.dto';
import { ApiKeyResponseDto, ApiKeyListResponseDto } from '../dto/api-key-response.dto';
import { ApiResponseDto } from '../../common/dto/api-response.dto';

/**
 * Management API Key 관리 컨트롤러
 * API Key의 생성, 조회, 활성화/비활성화 등을 관리
 * 자기 자신을 관리하는 API이므로 API Key 인증 필요
 */
@Controller('management/api-keys')
@UseGuards(ApiKeyGuard)
export class ManagementApiKeyController {
  private readonly logger = new Logger(ManagementApiKeyController.name);

  constructor(private readonly apiKeyService: ApiKeyService) {}

  /**
   * 전체 API Key 목록 조회
   * 보안을 위해 key 값은 일부만 노출
   */
  @Get()
      async findAll(): Promise<ApiResponseDto<ApiKeyListResponseDto[]>> {
    this.logger.log('API Key 목록 조회 요청');

    try {
      const apiKeys = await this.apiKeyService.findAll();
      
      // 보안을 위해 key 값은 일부만 노출
      const responseData: ApiKeyListResponseDto[] = apiKeys.map(apiKey => ({
        id: apiKey.id,
        keyPreview: `${apiKey.key.substring(0, 8)}-****`,
        name: apiKey.name,
        description: apiKey.description,
        isActive: apiKey.isActive,
        lastUsedAt: apiKey.lastUsedAt,
        createdAt: apiKey.createdAt,
      }));

      this.logger.log(`API Key 목록 조회 성공 - 총 ${apiKeys.length}개`);

      return {
        success: true,
        message: 'API Key 목록이 성공적으로 조회되었습니다.',
        data: responseData,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error('API Key 목록 조회 실패', error);
      throw error;
    }
  }

  /**
   * 특정 API Key 상세 조회
   * 전체 key 값 포함
   */
  @Get(':id')
          async findOne(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ApiResponseDto<ApiKeyResponseDto>> {
    this.logger.log(`API Key 상세 조회 요청 - ID: ${id}`);

    try {
      const apiKey = await this.apiKeyService.findOne(id);

      this.logger.log(`API Key 상세 조회 성공 - ID: ${id}`);

      return {
        success: true,
        message: 'API Key가 성공적으로 조회되었습니다.',
        data: apiKey,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`API Key 상세 조회 실패 - ID: ${id}`, error);
      throw error;
    }
  }

  /**
   * 새로운 API Key 생성
   */
  @Post()
        async create(
    @Body() createApiKeyDto: CreateApiKeyDto,
  ): Promise<ApiResponseDto<ApiKeyResponseDto>> {
    this.logger.log(`API Key 생성 요청 - 이름: ${createApiKeyDto.name}`);

    try {
      const apiKey = await this.apiKeyService.create(
        createApiKeyDto.name,
        createApiKeyDto.description,
      );

      this.logger.log(`API Key 생성 성공 - ID: ${apiKey.id}, 이름: ${apiKey.name}`);

      return {
        success: true,
        message: 'API Key가 성공적으로 생성되었습니다. key 값을 안전한 곳에 보관하세요.',
        data: apiKey,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`API Key 생성 실패 - 이름: ${createApiKeyDto.name}`, error);
      throw error;
    }
  }

  /**
   * API Key 활성화
   */
  @Put(':id/activate')
          async activate(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ApiResponseDto<ApiKeyResponseDto>> {
    this.logger.log(`API Key 활성화 요청 - ID: ${id}`);

    try {
      const apiKey = await this.apiKeyService.activate(id);

      this.logger.log(`API Key 활성화 성공 - ID: ${id}`);

      return {
        success: true,
        message: 'API Key가 성공적으로 활성화되었습니다.',
        data: apiKey,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`API Key 활성화 실패 - ID: ${id}`, error);
      throw error;
    }
  }

  /**
   * API Key 비활성화
   */
  @Put(':id/deactivate')
          async deactivate(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ApiResponseDto<ApiKeyResponseDto>> {
    this.logger.log(`API Key 비활성화 요청 - ID: ${id}`);

    try {
      const apiKey = await this.apiKeyService.deactivate(id);

      this.logger.log(`API Key 비활성화 성공 - ID: ${id}`);

      return {
        success: true,
        message: 'API Key가 성공적으로 비활성화되었습니다.',
        data: apiKey,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`API Key 비활성화 실패 - ID: ${id}`, error);
      throw error;
    }
  }

  /**
   * API Key 재생성
   */
  @Put(':id/regenerate')
          async regenerate(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ApiResponseDto<ApiKeyResponseDto>> {
    this.logger.log(`API Key 재생성 요청 - ID: ${id}`);

    try {
      const apiKey = await this.apiKeyService.regenerate(id);

      this.logger.log(`API Key 재생성 성공 - ID: ${id}`);

      return {
        success: true,
        message: 'API Key가 성공적으로 재생성되었습니다. 새로운 key 값을 안전한 곳에 보관하세요.',
        data: apiKey,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`API Key 재생성 실패 - ID: ${id}`, error);
      throw error;
    }
  }

  /**
   * API Key 삭제
   */
  @Delete(':id')
          async remove(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<ApiResponseDto<null>> {
    this.logger.log(`API Key 삭제 요청 - ID: ${id}`);

    try {
      await this.apiKeyService.remove(id);

      this.logger.log(`API Key 삭제 성공 - ID: ${id}`);

      return {
        success: true,
        message: 'API Key가 성공적으로 삭제되었습니다.',
        data: null,
        timestamp: new Date(),
      };
    } catch (error) {
      this.logger.error(`API Key 삭제 실패 - ID: ${id}`, error);
      throw error;
    }
  }
}