import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/services/prisma.service';
import * as bcrypt from 'bcrypt';
import { SignUpDto } from './dto/sign-up.dto';
import { SignInDto } from './dto/sign-in.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';

/**
 * 인증 서비스
 * 사용자 인증 및 JWT 토큰 관리를 담당
 */
@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
  ) {}

  /**
   * 회원가입
   * 
   * @param signUpDto 회원가입 정보
   * @returns 생성된 사용자 정보와 JWT 토큰
   */
  async signUp(signUpDto: SignUpDto) {
    const { email, password, nickname } = signUpDto;

    this.logger.log(`회원가입 시도: ${email}`);

    // 이메일 중복 검사
    const existingUser = await this.prisma.user.findUnique({
      where: { email },
    });

    if (existingUser) {
      this.logger.warn(`이미 존재하는 이메일: ${email}`);
      throw new ConflictException('이미 등록된 이메일입니다.');
    }

    // 패스워드 암호화
    const hashedPassword = await bcrypt.hash(password, 10);

    // 사용자 생성
    const user = await this.prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        nickname,
      },
      select: {
        id: true,
        email: true,
        nickname: true,
        createdAt: true,
      },
    });

    this.logger.log(`회원가입 성공: ${user.email} (ID: ${user.id})`);

    // JWT 토큰 생성
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);

    return {
      user,
      accessToken,
    };
  }

  /**
   * 로그인
   * 
   * @param signInDto 로그인 정보
   * @returns 사용자 정보와 JWT 토큰
   */
  async signIn(signInDto: SignInDto) {
    const { email, password } = signInDto;

    this.logger.log(`로그인 시도: ${email}`);

    // 사용자 조회
    const user = await this.prisma.user.findUnique({
      where: { email },
      select: {
        id: true,
        email: true,
        password: true,
        nickname: true,
        createdAt: true,
      },
    });

    if (!user) {
      this.logger.warn(`존재하지 않는 사용자: ${email}`);
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    // 패스워드 검증
    const isPasswordValid = await bcrypt.compare(password, user.password);

    if (!isPasswordValid) {
      this.logger.warn(`잘못된 비밀번호: ${email}`);
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    this.logger.log(`로그인 성공: ${user.email} (ID: ${user.id})`);

    // JWT 토큰 생성
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload);

    // 패스워드 제거
    const { password: _, ...userWithoutPassword } = user;

    return {
      user: userWithoutPassword,
      accessToken,
    };
  }

  /**
   * 사용자 검증 (LocalStrategy에서 사용)
   * 
   * @param email 이메일
   * @param password 비밀번호
   * @returns 검증된 사용자 정보
   */
  async validateUser(email: string, password: string): Promise<any> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (user && await bcrypt.compare(password, user.password)) {
      const { password: _, ...result } = user;
      return result;
    }

    return null;
  }

  /**
   * JWT 페이로드로부터 사용자 조회 (JwtStrategy에서 사용)
   * 
   * @param payload JWT 페이로드
   * @returns 사용자 정보
   */
  async validateJwtPayload(payload: JwtPayload) {
    const user = await this.prisma.user.findUnique({
      where: { id: payload.sub },
      select: {
        id: true,
        email: true,
        nickname: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('유효하지 않은 토큰입니다.');
    }

    return user;
  }
}