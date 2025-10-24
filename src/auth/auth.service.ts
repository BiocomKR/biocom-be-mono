import { Injectable, UnauthorizedException, ConflictException, Logger } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/services/prisma.service';
import { ConfigService } from '../common/services/config.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { SignUpDto } from './dto/sign-up.dto';
import { SignInDto } from './dto/sign-in.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { UserSubscriptionStatus } from '../common/enums/user-subscription-status.enum';
import { getNowKST } from '../common/utils/kst-date.util';

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
    private readonly configService: ConfigService,
  ) {}

  /**
   * 회원가입
   * 
   * @param signUpDto 회원가입 정보
   * @returns 생성된 사용자 정보와 JWT 토큰
   */
  async signUp(signUpDto: SignUpDto) {
    const { email, password, name, mobile } = signUpDto;

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
        name,
        mobile,
        subscriptionStatus: UserSubscriptionStatus.NEWCOMER,
        createdAt: getNowKST(), // KST 시간으로 저장
      },
      select: {
        id: true,
        email: true,
        name: true,
        mobile: true,
        createdAt: true,
      },
    });

    this.logger.log(`회원가입 성공: ${user.email} (ID: ${user.id})`);

    // JWT 토큰 생성
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.jwt.accessTokenExpiresIn,
    });
    
    // Refresh Token 생성 및 저장
    const refreshToken = await this.createRefreshToken(user.id);

    return {
      user,
      accessToken,
      refreshToken,
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
    });

    if (!user) {
      this.logger.warn(`존재하지 않는 사용자: ${email}`);
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    // 계정 상태 체크
    if (!user.isActive) {
      this.logger.warn(`차단된 계정 로그인 시도: ${email}`);
      throw new UnauthorizedException('차단된 계정입니다. 고객센터에 문의하세요.');
    }

    if (user.deletedAt) {
      this.logger.warn(`탈퇴한 계정 로그인 시도: ${email}`);
      throw new UnauthorizedException('탈퇴한 계정입니다.');
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
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.jwt.accessTokenExpiresIn,
    });
    
    // Refresh Token 생성 및 저장
    const refreshToken = await this.createRefreshToken(user.id);

    // 클라이언트에 반환할 사용자 정보만 선택
    const userResponse = {
      id: user.id,
      email: user.email,
      name: user.name,
      mobile: user.mobile,
      createdAt: user.createdAt,
    };

    return {
      user: userResponse,
      accessToken,
      refreshToken,
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
        name: true,
        mobile: true,
        points: true,
        role: true,
        createdAt: true,
      },
    });

    if (!user) {
      throw new UnauthorizedException('유효하지 않은 토큰입니다.');
    }

    // req.user에 저장될 사용자 정보 (sub 추가)
    return {
      ...user,
      sub: user.id // JWT payload의 sub 필드와 일치시키기 위해 추가
    };
  }

  /**
   * Refresh Token 생성 및 저장
   * 
   * @param userId 사용자 ID
   * @returns 생성된 Refresh Token
   */
  private async createRefreshToken(userId: number): Promise<string> {
    // 고유한 토큰 생성
    const token = crypto.randomBytes(64).toString('hex');
    
    // 만료 시간 계산 (180일)
    const expiresAt = getNowKST();
    expiresAt.setDate(expiresAt.getDate() + 180);
    
    // 기존 Refresh Token 삭제 (사용자당 1개만 유지)
    await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });
    
    // 새로운 Refresh Token 저장
    await this.prisma.refreshToken.create({
      data: {
        token,
        userId,
        expiresAt,
        createdAt: getNowKST(),
      },
    });
    
    this.logger.log(`Refresh Token 생성: 사용자 ID ${userId}`);
    return token;
  }

  /**
   * Access Token 갱신
   * 
   * @param refreshToken Refresh Token
   * @returns 새로운 Access Token과 기존 Refresh Token
   */
  async refreshAccessToken(refreshToken: string) {
    this.logger.log(`토큰 갱신 시도`);
    
    // Refresh Token 조회
    const storedToken = await this.prisma.refreshToken.findUnique({
      where: { token: refreshToken },
      include: { user: true },
    });
    
    if (!storedToken) {
      this.logger.warn(`유효하지 않은 Refresh Token`);
      throw new UnauthorizedException('유효하지 않은 토큰입니다.');
    }
    
    // 만료 확인
    if (storedToken.expiresAt < getNowKST()) {
      this.logger.warn(`만료된 Refresh Token: 사용자 ID ${storedToken.userId}`);
      await this.prisma.refreshToken.delete({
        where: { id: storedToken.id },
      });
      throw new UnauthorizedException('토큰이 만료되었습니다. 다시 로그인해주세요.');
    }
    
    // 사용자 상태 확인
    const user = storedToken.user;
    if (!user.isActive) {
      this.logger.warn(`차단된 계정 토큰 갱신 시도: ${user.email}`);
      throw new UnauthorizedException('차단된 계정입니다. 고객센터에 문의하세요.');
    }
    
    if (user.deletedAt) {
      this.logger.warn(`탈퇴한 계정 토큰 갱신 시도: ${user.email}`);
      throw new UnauthorizedException('탈퇴한 계정입니다.');
    }
    
    // 새로운 Access Token 생성
    const payload: JwtPayload = { sub: user.id, email: user.email };
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.jwt.accessTokenExpiresIn,
    });
    
    this.logger.log(`토큰 갱신 성공: 사용자 ID ${user.id}`);
    
    return {
      accessToken,
      refreshToken, // 기존 Refresh Token 그대로 반환 (Fixed 방식)
    };
  }

  /**
   * 로그아웃
   * 
   * @param userId 사용자 ID
   */
  async logout(userId: number) {
    this.logger.log(`로그아웃 시도: 사용자 ID ${userId}`);
    
    // Refresh Token 삭제
    const result = await this.prisma.refreshToken.deleteMany({
      where: { userId },
    });
    
    this.logger.log(`로그아웃 성공: 사용자 ID ${userId}, 삭제된 토큰 수: ${result.count}`);
    
    return {
      message: '로그아웃되었습니다.',
    };
  }
}