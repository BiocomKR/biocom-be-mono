import { Module } from '@nestjs/common';
import { HttpModule } from '@nestjs/axios';
import { ImwebAuthService } from './imweb-auth.service';
import { ImwebApiService } from './imweb-api.service';
import { PrismaService } from '../common/services/prisma.service';

/**
 * 아임웹 통합 모듈
 * - 다른 모듈에서 import하여 사용
 */
@Module({
  imports: [
    HttpModule,
  ],
  providers: [
    PrismaService,
    ImwebAuthService,
    ImwebApiService,
  ],
  exports: [
    ImwebApiService, // 다른 서비스에서 주입받아 사용
    ImwebAuthService, // AuthController에서 사용
  ],
})
export class ImwebModule {}