import { Injectable, UnauthorizedException } from '@nestjs/common';
import { PassportStrategy } from '@nestjs/passport';
import { Strategy } from 'passport-local';
import { AuthService } from '../auth.service';

/**
 * Local 인증 전략
 * 이메일과 비밀번호를 사용한 인증
 */
@Injectable()
export class LocalStrategy extends PassportStrategy(Strategy, 'local') {
  constructor(private readonly authService: AuthService) {
    super({
      // 'username' 대신 'email' 필드 사용
      usernameField: 'email',
      passwordField: 'password',
    });
  }

  /**
   * 사용자 인증
   * Passport가 자동으로 호출
   * 
   * @param email 이메일
   * @param password 비밀번호
   * @returns 인증된 사용자 정보
   */
  async validate(email: string, password: string): Promise<any> {
    const user = await this.authService.validateUser(email, password);
    
    if (!user) {
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }
    
    return user;
  }
}