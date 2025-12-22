import { Module } from '@nestjs/common';
import { AppConfigController } from './app-config.controller';
import { AppConfigService } from './app-config.service';
import { PrismaService } from '../common/services/prisma.service';

@Module({
  controllers: [AppConfigController],
  providers: [AppConfigService, PrismaService],
  exports: [AppConfigService],
})
export class AppConfigModule {}
