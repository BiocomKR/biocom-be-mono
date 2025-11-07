import { HttpModule } from '@nestjs/axios';
import { Module } from '@nestjs/common';
import { KcpApiService } from './kcp/kcp-api.service';
import { KcpSignatureService } from './kcp/kcp-signature.service';
import { PhoneVerificationController } from './phone-verification.controller';
import { PhoneVerificationService } from './phone-verification.service';

/**
 * 휴대폰 본인인증 모듈
 * NHN KCP SMS 인증 API 연동
 */
@Module({
  imports: [
    HttpModule.register({
      timeout: 10000, // KCP API 10초 타임아웃
      maxRedirects: 5,
    }),
  ],
  controllers: [PhoneVerificationController],
  providers: [
    PhoneVerificationService,
    KcpApiService,
    KcpSignatureService,
  ],
  exports: [PhoneVerificationService], // 다른 모듈에서 사용 가능
})
export class PhoneVerificationModule {}
