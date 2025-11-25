import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT 인증 가드
 * JWT 토큰이 필요한 엔드포인트를 보호
 */
@Injectable()
export class JwtAuthGuard extends AuthGuard('jwt') {}