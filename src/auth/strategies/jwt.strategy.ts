import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { ExtractJwt, Strategy } from 'passport-jwt';
import { AuthService } from '../auth.service';
import { JwtPayload } from '../interfaces/jwt-payload.interface';
import { ConfigService } from '../../common/services/config.service';

/**
 * JWT 인증 전략
 * Bearer 토큰에서 JWT를 추출하고 검증
 */
@Injectable()
export class JwtStrategy extends PassportStrategy(Strategy, 'jwt') {
  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {
    super({
      // Authorization 헤더의 Bearer 토큰에서 JWT 추출
      jwtFromRequest: ExtractJwt.fromAuthHeaderAsBearerToken(),
      // 만료된 토큰 거부
      ignoreExpiration: false,
      // JWT 서명 검증용 시크릿 키
      secretOrKey: configService.jwt.secret,
    });
  }

  /**
   * JWT 페이로드 검증
   * Passport가 JWT를 디코딩한 후 자동으로 호출
   *
   * @param payload 디코딩된 JWT 페이로드
   * @returns 검증된 운영자 정보
   */
  async validate(payload: JwtPayload) {
    const operator = await this.authService.validateJwtPayload(payload);

    if (!operator) {
      throw new UnauthorizedException('유효하지 않은 토큰입니다.');
    }

    // req.user에 저장될 운영자 정보
    return operator;
  }
}