import {
  Injectable,
  UnauthorizedException,
  ForbiddenException,
  ConflictException,
  Logger,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/services/prisma.service';
import { ConfigService } from '../common/services/config.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { SignInDto } from './dto/sign-in.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { getNowKST } from '../common/utils/kst-date.util';

// 계정 잠금 설정
const MAX_FAILED_ATTEMPTS = 5;
const LOCK_DURATION_MINUTES = 30;

/**
 * 인증 서비스 (운영자용)
 * 운영자 인증 및 JWT 토큰 관리를 담당
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
   * 운영자 로그인
   *
   * @param signInDto 로그인 정보
   * @param ip 클라이언트 IP
   * @param userAgent 클라이언트 User-Agent
   * @returns 운영자 정보와 JWT 토큰
   */
  async signIn(signInDto: SignInDto, ip?: string, userAgent?: string) {
    const { email, password } = signInDto;

    this.logger.log(`운영자 로그인 시도: ${email}`);

    // 운영자 조회 (부서 정보 포함)
    const operator = await this.prisma.operator.findUnique({
      where: { email },
      include: { department: true },
    });

    if (!operator) {
      this.logger.warn(`존재하지 않는 운영자: ${email}`);
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    // 계정 활성화 상태 체크
    if (!operator.isActive) {
      this.logger.warn(`비활성화된 운영자 로그인 시도: ${email}`);
      await this.logAuthAction(operator.id, 'LOGIN_FAIL_INACTIVE', ip, userAgent);
      throw new UnauthorizedException('비활성화된 계정입니다. 관리자에게 문의하세요.');
    }

    // 계정 잠금 상태 체크
    if (operator.lockedUntil) {
      if (operator.lockedUntil > getNowKST()) {
        const remainingMinutes = Math.ceil(
          (operator.lockedUntil.getTime() - Date.now()) / 60000,
        );
        this.logger.warn(`잠긴 계정 로그인 시도: ${email}`);
        await this.logAuthAction(operator.id, 'LOGIN_FAIL_LOCKED', ip, userAgent);
        throw new ForbiddenException(
          `계정이 잠겼습니다. ${remainingMinutes}분 후 재시도하세요.`,
        );
      }
      // 잠금 시간 지남 → 자동 해제
      await this.prisma.operator.update({
        where: { id: operator.id },
        data: { lockedUntil: null, failedAttempts: 0 },
      });
    }

    // 비밀번호 검증
    const isPasswordValid = await bcrypt.compare(password, operator.password);

    if (!isPasswordValid) {
      this.logger.warn(`잘못된 비밀번호: ${operator.name}`);
      await this.handleFailedLogin(operator.id, ip, userAgent);
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    // 로그인 성공 처리
    await this.prisma.operator.update({
      where: { id: operator.id },
      data: {
        failedAttempts: 0,
        lockedUntil: null,
        lastLoginAt: getNowKST(),
      },
    });

    await this.logAuthAction(operator.id, 'LOGIN_SUCCESS', ip, userAgent);

    this.logger.log(`운영자 로그인 성공: ${operator.name} (ID: ${operator.id})`);

    // JWT 토큰 생성
    const payload: JwtPayload = {
      sub: operator.id,
      name: operator.name,
      accessTier: operator.accessTier,
    };
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.jwt.accessTokenExpiresIn as any,
    });

    // Refresh Token 생성 및 저장
    const refreshToken = await this.createRefreshToken(operator.id);

    // 응답 데이터
    const operatorResponse = {
      id: operator.id,
      email: operator.email,
      name: operator.name,
      accessTier: operator.accessTier,
      department: operator.department
        ? {
            id: operator.department.id,
            name: operator.department.name,
            code: operator.department.code,
            menuCodes: operator.department.menuCodes,
          }
        : null,
    };

    return {
      operator: operatorResponse,
      accessToken,
      refreshToken,
    };
  }

  /**
   * 로그인 실패 처리
   */
  private async handleFailedLogin(
    operatorId: number,
    ip?: string,
    userAgent?: string,
  ) {
    const operator = await this.prisma.operator.findUnique({
      where: { id: operatorId },
    });

    const failedAttempts = (operator?.failedAttempts || 0) + 1;
    const updateData: any = { failedAttempts };

    // 최대 실패 횟수 도달 시 계정 잠금
    if (failedAttempts >= MAX_FAILED_ATTEMPTS) {
      updateData.lockedUntil = new Date(
        Date.now() + LOCK_DURATION_MINUTES * 60 * 1000,
      );
      this.logger.warn(
        `운영자 계정 잠금: ID ${operatorId} (${failedAttempts}회 실패)`,
      );
    }

    await this.prisma.operator.update({
      where: { id: operatorId },
      data: updateData,
    });

    await this.logAuthAction(operatorId, 'LOGIN_FAIL', ip, userAgent);
  }

  /**
   * 인증 로그 기록
   */
  private async logAuthAction(
    operatorId: number | null,
    action: string,
    ip?: string,
    userAgent?: string,
    path: string = '/api/auth/signin',
  ) {
    await this.prisma.operatorActivityLog.create({
      data: {
        operatorId,
        method: 'POST',
        path,
        action,
        statusCode: action === 'LOGIN_SUCCESS' ? 200 : 401,
        ip,
        userAgent,
        duration: 0,
        createdAt: getNowKST(),
      },
    });
  }

  /**
   * JWT 페이로드로부터 운영자 조회 (JwtStrategy에서 사용)
   *
   * @param payload JWT 페이로드
   * @returns 운영자 정보
   */
  async validateJwtPayload(payload: JwtPayload) {
    const operator = await this.prisma.operator.findUnique({
      where: { id: payload.sub },
      include: { department: true },
    });

    if (!operator) {
      throw new UnauthorizedException('유효하지 않은 토큰입니다.');
    }

    if (!operator.isActive) {
      throw new UnauthorizedException('비활성화된 계정입니다.');
    }

    // req.user에 저장될 운영자 정보
    return {
      id: operator.id,
      email: operator.email,
      name: operator.name,
      accessTier: operator.accessTier,
      department: operator.department,
      sub: operator.id,
    };
  }

  /**
   * Refresh Token 생성 및 저장
   *
   * @param operatorId 운영자 ID
   * @returns 생성된 Refresh Token
   */
  private async createRefreshToken(operatorId: number): Promise<string> {
    // 고유한 토큰 생성
    const token = crypto.randomBytes(64).toString('hex');

    // 만료 시간 계산 (7일 - 운영자는 앱보다 짧게)
    const expiresAt = getNowKST();
    expiresAt.setDate(expiresAt.getDate() + 7);

    // 기존 Refresh Token 삭제 (운영자당 1개만 유지)
    await this.prisma.operatorRefreshToken.deleteMany({
      where: { operatorId },
    });

    // 새로운 Refresh Token 저장
    await this.prisma.operatorRefreshToken.create({
      data: {
        token,
        operatorId,
        expiresAt,
        createdAt: getNowKST(),
      },
    });

    this.logger.log(`운영자 Refresh Token 생성: ID ${operatorId}`);
    return token;
  }

  /**
   * Access Token 갱신
   *
   * @param refreshToken Refresh Token
   * @returns 새로운 Access Token과 Refresh Token
   */
  async refreshAccessToken(refreshToken: string) {
    this.logger.log(`운영자 토큰 갱신 시도`);

    // Refresh Token 조회
    const storedToken = await this.prisma.operatorRefreshToken.findUnique({
      where: { token: refreshToken },
      include: {
        operator: {
          include: { department: true },
        },
      },
    });

    if (!storedToken) {
      this.logger.warn(`유효하지 않은 Refresh Token`);
      throw new UnauthorizedException('유효하지 않은 토큰입니다.');
    }

    // 만료 확인
    if (storedToken.expiresAt < getNowKST()) {
      this.logger.warn(`만료된 Refresh Token: 운영자 ID ${storedToken.operatorId}`);
      await this.prisma.operatorRefreshToken.delete({
        where: { id: storedToken.id },
      });
      throw new UnauthorizedException('토큰이 만료되었습니다. 다시 로그인해주세요.');
    }

    // 운영자 상태 확인
    const operator = storedToken.operator;
    if (!operator.isActive) {
      this.logger.warn(`비활성화된 운영자 토큰 갱신 시도: ${operator.name}`);
      throw new UnauthorizedException('비활성화된 계정입니다.');
    }

    // 새로운 Access Token 생성
    const payload: JwtPayload = {
      sub: operator.id,
      name: operator.name,
      accessTier: operator.accessTier,
    };
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.jwt.accessTokenExpiresIn as any,
    });

    // Refresh Token도 새로 발급 (Rotation)
    const newRefreshToken = await this.createRefreshToken(operator.id);

    this.logger.log(`운영자 토큰 갱신 성공: ID ${operator.id}`);

    return {
      accessToken,
      refreshToken: newRefreshToken,
    };
  }

  /**
   * [개발용] 유저 ID로 액세스 토큰 발급
   * 비밀번호 검증 없이 유저 ID만으로 토큰 발급
   *
   * @param userId 유저 ID
   * @returns 유저 정보와 JWT 토큰
   */
  async devLoginByUserId(userId: number) {
    this.logger.log(`[DEV] 유저 토큰 발급 시도 - ID: ${userId}`);

    // 유저 조회
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        name: true,
        mobile: true,
        status: true,
      },
    });

    if (!user) {
      this.logger.warn(`[DEV] 존재하지 않는 유저: ${userId}`);
      throw new UnauthorizedException('유저를 찾을 수 없습니다.');
    }

    // JWT 토큰 생성 (biocom-api와 동일한 payload 구조)
    const payload = {
      sub: user.id,
      name: user.name,
    };
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.jwt.accessTokenExpiresIn as any,
    });

    // Refresh Token 생성 및 저장
    const refreshToken = await this.createUserRefreshToken(user.id);

    this.logger.log(`[DEV] 유저 토큰 발급 성공 - ID: ${userId}, 이름: ${user.name}`);

    return {
      user: {
        id: user.id,
        name: user.name,
        mobile: user.mobile,
        status: user.status,
      },
      accessToken,
      refreshToken,
    };
  }

  /**
   * [개발용] 유저 Refresh Token 생성 및 저장
   */
  private async createUserRefreshToken(userId: number): Promise<string> {
    const token = crypto.randomBytes(64).toString('hex');

    const expiresAt = getNowKST();
    expiresAt.setDate(expiresAt.getDate() + 30); // 유저는 30일

    // 기존 Refresh Token 삭제
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

    return token;
  }

  /**
   * 로그아웃
   *
   * @param operatorId 운영자 ID
   * @param ip 클라이언트 IP
   * @param userAgent 클라이언트 User-Agent
   */
  async logout(operatorId: number, ip?: string, userAgent?: string) {
    this.logger.log(`운영자 로그아웃 시도: ID ${operatorId}`);

    // Refresh Token 삭제
    const result = await this.prisma.operatorRefreshToken.deleteMany({
      where: { operatorId },
    });

    await this.logAuthAction(operatorId, 'LOGOUT', ip, userAgent, '/api/auth/logout');

    this.logger.log(
      `운영자 로그아웃 성공: ID ${operatorId}, 삭제된 토큰 수: ${result.count}`,
    );

    return {
      message: '로그아웃되었습니다.',
    };
  }
}
