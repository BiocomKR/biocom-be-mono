import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * Local 인증 가드
 * 이메일/비밀번호 기반 인증에 사용
 * 
 * 주로 로그인 엔드포인트에서 사용
 */
@Injectable()
export class LocalAuthGuard extends AuthGuard('local') {}