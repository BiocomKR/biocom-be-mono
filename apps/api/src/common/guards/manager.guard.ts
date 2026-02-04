import {
  Injectable,
  CanActivate,
  ExecutionContext,
  ForbiddenException,
} from '@nestjs/common';
import { Observable } from 'rxjs';

/**
 * 관리자 권한 가드
 *
 * MANAGER 또는 ADMIN 역할을 가진 사용자만 접근 허용
 * JWT 인증 후에 실행되어야 하므로 반드시 JwtAuthGuard와 함께 사용
 *
 * @example
 * ```typescript
 * @UseGuards(JwtAuthGuard, ManagerGuard)
 * @Post('admin/action')
 * async adminAction(@Req() req: any) {
 *   // 관리자만 접근 가능
 * }
 * ```
 */
@Injectable()
export class ManagerGuard implements CanActivate {
  /**
   * 사용자의 관리자 권한을 확인합니다
   *
   * @param context - 실행 컨텍스트 (HTTP 요청 정보 포함)
   * @returns 권한이 있으면 true, 없으면 ForbiddenException 발생
   * @throws ForbiddenException - MANAGER 또는 ADMIN 권한이 없는 경우
   */
  canActivate(
    context: ExecutionContext,
  ): boolean | Promise<boolean> | Observable<boolean> {
    const request = context.switchToHttp().getRequest();
    const user = request.user;

    // JWT 인증이 선행되지 않은 경우
    if (!user) {
      throw new ForbiddenException('인증이 필요합니다.');
    }

    // role 필드가 없는 경우 (구버전 데이터)
    if (!user.role) {
      throw new ForbiddenException('권한 정보가 없습니다. 관리자에게 문의하세요.');
    }

    // MANAGER 또는 ADMIN 권한 확인
    const allowedRoles = ['MANAGER', 'ADMIN'];
    if (!allowedRoles.includes(user.role)) {
      throw new ForbiddenException('관리자 권한이 필요합니다.');
    }

    return true;
  }
}
