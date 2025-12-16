import { Module } from '@nestjs/common';
import { BannersController } from './controllers/banners.controller';
import { BannersService } from './services/banners.service';

/**
 * 쇼핑몰 배너 모듈
 * 배너 조회 기능 제공
 */
@Module({
  controllers: [BannersController],
  providers: [BannersService],
  exports: [BannersService],
})
export class BannersModule {}
