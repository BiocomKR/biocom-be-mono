import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { PassportModule } from '@nestjs/passport';
import { ConfigModule } from '@nestjs/config';
import { HttpModule } from '@nestjs/axios';
import { AuthService } from './auth.service';
import { AuthController } from './auth.controller';
import { JwtStrategy } from './strategies/jwt.strategy';
import { LocalStrategy } from './strategies/local.strategy';
import { PrismaService } from '../common/services/prisma.service';
import { ConfigService } from '../common/services/config.service';
import { ImwebModule } from '@/imweb/imweb.module';
import { PhoneVerificationModule } from '../phone-verification/phone-verification.module';

/**
 * 인증 모듈
 * JWT 기반 인증 및 사용자 관리를 담당
 * 
 * 주요 기능:
 * - 회원가입/로그인
 * - JWT 토큰 발급 및 검증
 * - 패스워드 암호화
 * - 인증 가드를 통한 라우트 보호
 */
@Module({
  imports: [
    HttpModule,
    ImwebModule,
    PhoneVerificationModule,
    PassportModule.register({ defaultStrategy: 'jwt' }),
    JwtModule.registerAsync({
      imports: [ConfigModule],
      useFactory: (configService: ConfigService) => ({
        secret: configService.jwt.secret,
        signOptions: {
          expiresIn: configService.jwt.expiresIn,
        },
      }),
      inject: [ConfigService],
    }),
  ],
  controllers: [AuthController],
  providers: [
    AuthService,
    LocalStrategy,
    JwtStrategy,
    PrismaService,
    ConfigService,
  ],
  exports: [AuthService, PassportModule],
})
export class AuthModule {}