import { Injectable, CanActivate, ExecutionContext, ForbiddenException } from '@nestjs/common';

/**
 * SYSTEM 등급만 접근 가능한 가드
 * 운영자 관리 등 시스템 관리 기능에 사용
 */
@Injectable()
export class SystemOnlyGuard implements CanActivate {
  canActivate(context: ExecutionContext): boolean {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    if (!user) {
      throw new ForbiddenException('인증이 필요합니다.');
    }

    if (user.accessTier !== 'SYSTEM') {
      throw new ForbiddenException('SYSTEM 권한이 필요합니다.');
    }

    return true;
  }
}
