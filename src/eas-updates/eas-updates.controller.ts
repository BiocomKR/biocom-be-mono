import {
  Controller,
  Get,
  Headers,
  Res,
  Query,
  Logger,
  HttpStatus,
} from '@nestjs/common';
import { Response } from 'express';
import { EasUpdatesService } from './eas-updates.service';
import { ApiTags, ApiOperation, ApiHeader, ApiQuery } from '@nestjs/swagger';

@ApiTags('EAS Updates')
@Controller('eas-updates')
export class EasUpdatesController {
  private readonly logger = new Logger(EasUpdatesController.name);

  constructor(private readonly easUpdatesService: EasUpdatesService) {}

  /**
   * Expo Updates 매니페스트 엔드포인트
   * expo-updates 클라이언트가 호출하는 메인 엔드포인트
   */
  @Get('manifest')
  @ApiOperation({ summary: 'OTA 업데이트 매니페스트 조회' })
  @ApiHeader({ name: 'expo-runtime-version', description: '앱의 런타임 버전' })
  @ApiHeader({ name: 'expo-platform', description: '플랫폼 (ios/android)' })
  @ApiHeader({ name: 'expo-channel-name', description: '채널 이름 (선택)', required: false })
  async getManifest(
    @Headers('expo-runtime-version') runtimeVersion: string,
    @Headers('expo-platform') platform: 'ios' | 'android',
    @Headers('expo-channel-name') channel: string,
    @Res() res: Response,
  ) {
    this.logger.log(
      `매니페스트 요청 - runtimeVersion: ${runtimeVersion}, platform: ${platform}, channel: ${channel || 'default'}`,
    );

    // 필수 헤더 검증
    if (!runtimeVersion || !platform) {
      this.logger.warn('필수 헤더 누락');
      return res.status(HttpStatus.BAD_REQUEST).json({
        error: 'Missing required headers: expo-runtime-version, expo-platform',
      });
    }

    try {
      const manifest = await this.easUpdatesService.getManifest(
        runtimeVersion,
        platform,
      );

      if (!manifest) {
        // 업데이트 없음 - 204 No Content
        this.logger.log('새 업데이트 없음');
        return res.status(HttpStatus.NO_CONTENT).send();
      }

      // Expo Updates 프로토콜 응답 헤더
      res.setHeader('expo-protocol-version', '1');
      res.setHeader('expo-sfv-version', '0');
      res.setHeader('cache-control', 'private, max-age=0');
      res.setHeader('content-type', 'application/json');

      return res.status(HttpStatus.OK).json(manifest);
    } catch (error) {
      this.logger.error(`매니페스트 조회 실패: ${error.message}`, error.stack);
      return res.status(HttpStatus.INTERNAL_SERVER_ERROR).json({
        error: 'Failed to fetch manifest',
      });
    }
  }

  /**
   * 에셋 파일 리다이렉트
   */
  @Get('assets')
  @ApiOperation({ summary: '에셋 파일 조회' })
  @ApiQuery({ name: 'asset', description: '에셋 키' })
  @ApiQuery({ name: 'runtimeVersion', description: '런타임 버전' })
  @ApiQuery({ name: 'platform', description: '플랫폼' })
  async getAsset(
    @Query('asset') assetKey: string,
    @Query('runtimeVersion') runtimeVersion: string,
    @Query('platform') platform: string,
    @Res() res: Response,
  ) {
    this.logger.log(`에셋 요청 - key: ${assetKey}, runtimeVersion: ${runtimeVersion}`);

    try {
      const assetUrl = await this.easUpdatesService.getAssetUrl(
        assetKey,
        runtimeVersion,
        platform,
      );

      // GCS URL로 리다이렉트
      return res.redirect(assetUrl);
    } catch (error) {
      this.logger.error(`에셋 조회 실패: ${error.message}`);
      return res.status(HttpStatus.NOT_FOUND).json({
        error: 'Asset not found',
      });
    }
  }

  /**
   * 헬스체크 / 상태 확인
   */
  @Get('status')
  @ApiOperation({ summary: 'EAS Updates 서비스 상태 확인' })
  getStatus() {
    return {
      status: 'ok',
      service: 'eas-updates',
      timestamp: new Date().toISOString(),
    };
  }
}
