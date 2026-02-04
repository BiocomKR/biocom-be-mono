import { Controller, Get, Param, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiQuery } from '@nestjs/swagger';
import { AppConfigService } from './app-config.service';

@ApiTags('앱 설정')
@Controller('app-configs')
export class AppConfigController {
  constructor(private readonly appConfigService: AppConfigService) {}

  @Get(':configKey')
  @ApiOperation({ summary: '설정 단건 조회' })
  async getConfigByKey(@Param('configKey') configKey: string) {
    return this.appConfigService.getConfigByKey(configKey);
  }

  @Get()
  @ApiOperation({ summary: '설정 다건 조회' })
  @ApiQuery({ name: 'keys', required: true, description: '설정 키 (쉼표 구분)' })
  async getConfigsByKeys(@Query('keys') keys: string) {
    const configKeys = keys.split(',').map((k) => k.trim()).filter(Boolean);
    return this.appConfigService.getConfigsByKeys(configKeys);
  }
}
