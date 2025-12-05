import { Controller, Get, Query } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse, ApiQuery } from '@nestjs/swagger';
import { AppVersionService } from './app-version.service';
import { ApiResponseDto } from '../common/dto/api-response.dto';
import { CheckVersionDto } from './dto/check-version.dto';
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
}
