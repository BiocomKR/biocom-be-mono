import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Body,
  Param,
  Query,
  ParseIntPipe,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiQuery,
} from '@nestjs/swagger';
import { AppVersionService } from './app-version.service';
import { ApiResponseDto } from '../common/dto/api-response.dto';
import { CheckVersionDto } from './dto/check-version.dto';
import { CreateAppVersionDto } from './dto/create-app-version.dto';
import { UpdateAppVersionDto } from './dto/update-app-version.dto';
import { getNowKST } from '../common/utils/kst-date.util';

@ApiTags('앱 버전')
@Controller()
export class AppVersionController {
  constructor(private readonly appVersionService: AppVersionService) {}

  /**
   * 버전 체크 (앱용 - Public)
   */
  @Get('app-version/check')
  @ApiOperation({
    summary: '버전 체크',
    description: '앱 시작 시 버전 체크하여 업데이트/점검 여부를 확인합니다.',
  })
  @ApiQuery({ name: 'platform', required: true, description: '플랫폼 (IOS, ANDROID, WEB)' })
  @ApiQuery({ name: 'version', required: true, description: '현재 앱 버전 (1.0.0)' })
  @ApiResponse({
    status: 200,
    description: '버전 체크 성공',
    schema: {
      example: {
        success: true,
        message: '버전 체크 완료',
        data: {
          needsUpdate: false,
          forceUpdate: false,
          latestVersion: '1.2.0',
          minRequiredVersion: '1.0.0',
          storeUrl: 'https://apps.apple.com/...',
          maintenance: false,
          maintenanceMessage: null,
        },
      },
    },
  })
  async checkVersion(@Query() dto: CheckVersionDto): Promise<ApiResponseDto> {
    const result = await this.appVersionService.checkVersion(dto);

    return {
      success: true,
      message: '버전 체크 완료',
      data: result,
      timestamp: getNowKST(),
    };
  }

  /**
   * 버전 목록 조회 (어드민용)
   */
  @Get('admin/app-versions')
  @ApiOperation({
    summary: '버전 목록 조회',
    description: '앱 버전 목록을 조회합니다.',
  })
  @ApiQuery({ name: 'platform', required: false, description: '플랫폼 필터' })
  @ApiQuery({ name: 'page', required: false, description: '페이지 번호' })
  @ApiQuery({ name: 'limit', required: false, description: '페이지 크기' })
  async findAll(
    @Query('platform') platform?: string,
    @Query('page') page?: string,
    @Query('limit') limit?: string,
  ): Promise<ApiResponseDto> {
    const result = await this.appVersionService.findAll({
      platform,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 10,
    });

    return {
      success: true,
      message: '버전 목록 조회 완료',
      data: result,
      timestamp: getNowKST(),
    };
  }

  /**
   * 버전 상세 조회 (어드민용)
   */
  @Get('admin/app-versions/:id')
  @ApiOperation({
    summary: '버전 상세 조회',
    description: '앱 버전 상세 정보를 조회합니다.',
  })
  async findOne(@Param('id', ParseIntPipe) id: number): Promise<ApiResponseDto> {
    const result = await this.appVersionService.findOne(id);

    return {
      success: true,
      message: '버전 상세 조회 완료',
      data: result,
      timestamp: getNowKST(),
    };
  }

  /**
   * 버전 등록 (어드민용)
   */
  @Post('admin/app-versions')
  @ApiOperation({
    summary: '버전 등록',
    description: '새로운 앱 버전을 등록합니다.',
  })
  async create(@Body() dto: CreateAppVersionDto): Promise<ApiResponseDto> {
    const result = await this.appVersionService.create(dto);

    return {
      success: true,
      message: '버전 등록 완료',
      data: result,
      timestamp: getNowKST(),
    };
  }

  /**
   * 버전 수정 (어드민용)
   */
  @Patch('admin/app-versions/:id')
  @ApiOperation({
    summary: '버전 수정',
    description: '앱 버전 정보를 수정합니다.',
  })
  async update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateAppVersionDto,
  ): Promise<ApiResponseDto> {
    const result = await this.appVersionService.update(id, dto);

    return {
      success: true,
      message: '버전 수정 완료',
      data: result,
      timestamp: getNowKST(),
    };
  }

  /**
   * 버전 삭제 (어드민용)
   */
  @Delete('admin/app-versions/:id')
  @ApiOperation({
    summary: '버전 삭제',
    description: '앱 버전을 삭제합니다.',
  })
  async remove(@Param('id', ParseIntPipe) id: number): Promise<ApiResponseDto> {
    await this.appVersionService.remove(id);

    return {
      success: true,
      message: '버전 삭제 완료',
      data: null,
      timestamp: getNowKST(),
    };
  }
}
