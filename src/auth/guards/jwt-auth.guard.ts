import { Injectable, ExecutionContext, UnauthorizedException } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { Reflector } from '@nestjs/core';

/**
 * JWT 인증 가드
 * JWT 토큰을 검증하고 인증된 사용자만 접근 허용
 * 
 * 사용 예:
 * @UseGuards(JwtAuthGuard)
 * @Get('protected')
 * getProtectedResource() { ... }
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {
  constructor(private reflector: Reflector) {
    super();
  }

  /**
   * 인증 활성화 여부 확인
   * @Public() 데코레이터가 있으면 인증을 건너뜀
   */
  canActivate(context: ExecutionContext) {
    // @Public() 데코레이터 확인
    const isPublic = this.reflector.getAllAndOverride<boolean>('isPublic', [
      context.getHandler(),
      context.getClass(),
    ]);

    if (isPublic) {
      return true;
    }

    return super.canActivate(context);
  }

  /**
   * 인증 실패 시 예외 처리
   */
  handleRequest(err: any, user: any, info: any) {
    if (err || !user) {
      throw err || new UnauthorizedException('인증이 필요합니다.');
    }
    return user;
  }
}