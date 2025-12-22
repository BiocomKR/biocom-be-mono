import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Body,
  Param,
  Query,
  UseGuards,
} from '@nestjs/common';
import { ApiTags, ApiOperation, ApiBearerAuth, ApiQuery } from '@nestjs/swagger';
import { AppConfigService, CreateAppConfigDto, UpdateAppConfigDto } from './app-config.service';
import { JwtAuthGuard } from '../auth/guards/jwt-auth.guard';

@ApiTags('앱 설정')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('app-configs')
export class AppConfigController {
  constructor(private readonly appConfigService: AppConfigService) {}

  @Get()
  @ApiOperation({ summary: '설정 목록 조회' })
  @ApiQuery({ name: 'search', required: false, description: '검색어 (키, 설명)' })
  @ApiQuery({ name: 'isActive', required: false, type: Boolean, description: '활성화 여부' })
  @ApiQuery({ name: 'page', required: false, type: Number, description: '페이지' })
  @ApiQuery({ name: 'limit', required: false, type: Number, description: '페이지당 개수' })
  async getConfigs(
    @Query('search') search?: string,
    @Query('isActive') isActive?: string,
    @Query('page') page = '1',
    @Query('limit') limit = '20',
  ) {
    return this.appConfigService.getConfigs({
      search,
      isActive: isActive !== undefined ? isActive === 'true' : undefined,
      page: parseInt(page, 10),
      limit: parseInt(limit, 10),
    });
  }

  @Get(':configKey')
  @ApiOperation({ summary: '설정 단건 조회' })
  @ApiQuery({ name: 'decrypt', required: false, type: Boolean, description: '복호화 여부 (암호화된 값)' })
  async getConfigByKey(
    @Param('configKey') configKey: string,
    @Query('decrypt') decrypt?: string,
  ) {
    return this.appConfigService.getConfigByKey(configKey, decrypt === 'true');
  }

  @Post()
  @ApiOperation({ summary: '설정 생성' })
  async createConfig(@Body() dto: CreateAppConfigDto) {
    return this.appConfigService.createConfig(dto);
  }

  @Put(':configKey')
  @ApiOperation({ summary: '설정 수정' })
  async updateConfig(
    @Param('configKey') configKey: string,
    @Body() dto: UpdateAppConfigDto,
  ) {
    return this.appConfigService.updateConfig(configKey, dto);
  }

  @Delete(':configKey')
  @ApiOperation({ summary: '설정 삭제' })
  async deleteConfig(@Param('configKey') configKey: string) {
    return this.appConfigService.deleteConfig(configKey);
  }

  @Put(':configKey/toggle')
  @ApiOperation({ summary: '설정 활성화/비활성화 토글' })
  async toggleActive(@Param('configKey') configKey: string) {
    return this.appConfigService.toggleActive(configKey);
  }
}
