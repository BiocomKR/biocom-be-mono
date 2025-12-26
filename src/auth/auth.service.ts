import { Injectable, UnauthorizedException, ConflictException, Logger, NotFoundException, BadRequestException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../common/services/prisma.service';
import { ConfigService } from '../common/services/config.service';
import * as bcrypt from 'bcrypt';
import * as crypto from 'crypto';
import { SignUpDto } from './dto/sign-up.dto';
import { SignInDto } from './dto/sign-in.dto';
import { PhoneLoginDto } from './dto/phone-login.dto';
import { PhoneRegisterDto, PhoneRegisterTestDto } from './dto/phone-register.dto';
import { PhoneRequestDto } from './dto/phone-request.dto';
import { JwtPayload } from './interfaces/jwt-payload.interface';
import { UserSubscriptionStatus } from '../common/enums/user-subscription-status.enum';
import { getNowKST } from '../common/utils/kst-date.util';
import { PhoneVerificationService } from '../phone-verification/phone-verification.service';

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
    private readonly phoneVerificationService: PhoneVerificationService,
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
    const existingUser = await this.prisma.user.findFirst({
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
        status: UserSubscriptionStatus.NEWCOMER,
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
    const payload: JwtPayload = { sub: user.id, name: user.name };
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.jwt.accessTokenExpiresIn as any,
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
    const user = await this.prisma.user.findFirst({
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
      this.logger.warn(`잘못된 비밀번호: ${user.name}`);
      throw new UnauthorizedException('이메일 또는 비밀번호가 올바르지 않습니다.');
    }

    this.logger.log(`로그인 성공: ${user.name} (ID: ${user.id})`);

    // JWT 토큰 생성
    const payload: JwtPayload = { sub: user.id, name: user.name };
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.jwt.accessTokenExpiresIn as any,
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
   * 휴대폰 본인인증 검증
   * 본인인증이 완료되었고 유효한지 확인
   *
   * @param certNumber 본인인증 거래번호
   * @param mobile 휴대폰 번호
   * @throws UnauthorizedException 본인인증이 유효하지 않은 경우
   */
  private async validatePhoneVerification(certNumber: string, mobile: string): Promise<void> {
    // phone_verification_logs 테이블에서 본인인증 내역 조회
    const verificationLog = await this.prisma.phoneVerificationLog.findUnique({
      where: { certNumber },
    });

    // 1. 본인인증 내역이 없는 경우
    if (!verificationLog) {
      this.logger.warn(`본인인증 내역 없음: certNumber=${certNumber}`);
      throw new UnauthorizedException('본인인증 정보를 찾을 수 없습니다. 본인인증을 먼저 진행해주세요.');
    }

    // 2. 본인인증이 완료되지 않은 경우 (VERIFIED 상태가 아님)
    if (verificationLog.verificationStatus !== 'COMPLETED' || verificationLog.step !== 'VERIFIED') {
      this.logger.warn(`본인인증 미완료: certNumber=${certNumber}, status=${verificationLog.verificationStatus}`);
      throw new UnauthorizedException('본인인증이 완료되지 않았습니다. 인증번호 확인을 완료해주세요.');
    }

    // 3. 휴대폰 번호가 일치하지 않는 경우
    // verificationLog.mobile은 Prisma Extension에서 자동 복호화됨 (평문)
    if (verificationLog.mobile !== mobile) {
      this.logger.warn(`휴대폰 번호 불일치: certNumber=${certNumber}, log=${verificationLog.mobile}, request=${mobile}`);
      throw new UnauthorizedException('본인인증 정보와 휴대폰 번호가 일치하지 않습니다.');
    }

    // 4. 본인인증 유효시간 확인 (10분)
    const now = getNowKST();
    const verifiedAt = verificationLog.updatedAt || verificationLog.createdAt;
    const diffMinutes = Math.floor((now.getTime() - verifiedAt.getTime()) / 1000 / 60);

    if (diffMinutes > 10) {
      this.logger.warn(`본인인증 시간 만료: certNumber=${certNumber}, ${diffMinutes}분 경과`);
      throw new UnauthorizedException('본인인증 유효시간이 만료되었습니다. 다시 인증해주세요.');
    }

    this.logger.log(`본인인증 검증 성공: certNumber=${certNumber}, mobile=${mobile}`);
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
      this.logger.warn(`차단된 계정 토큰 갱신 시도: ${user.name}`);
      throw new UnauthorizedException('차단된 계정입니다. 고객센터에 문의하세요.');
    }
    
    if (user.deletedAt) {
      this.logger.warn(`탈퇴한 계정 토큰 갱신 시도: ${user.name}`);
      throw new UnauthorizedException('탈퇴한 계정입니다.');
    }
    
    // 새로운 Access Token 생성
    const payload: JwtPayload = { sub: user.id, name: user.name };
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.jwt.accessTokenExpiresIn as any,
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

  /**
   * 휴대폰 번호로 로그인
   * 휴대폰 본인인증 완료 후 호출
   *
   * @param phoneLoginDto 휴대폰 로그인 정보
   * @returns 사용자 정보와 JWT 토큰
   */
  async phoneLogin(phoneLoginDto: PhoneLoginDto) {
    const { certNumber, mobile } = phoneLoginDto;

    this.logger.log(`휴대폰 로그인 시도: ${mobile}`);

    // 1. 본인인증 검증
    await this.validatePhoneVerification(certNumber, mobile);

    // 2. 휴대폰 번호로 사용자 조회
    const user = await this.prisma.user.findFirst({
      where: { mobile },
    });

    if (!user) {
      this.logger.warn(`존재하지 않는 사용자: ${mobile}`);
      throw new UnauthorizedException('등록되지 않은 휴대폰 번호입니다. 회원가입을 먼저 진행해주세요.');
    }

    // 계정 상태 체크
    if (!user.isActive) {
      this.logger.warn(`차단된 계정 로그인 시도: ${mobile}`);
      throw new UnauthorizedException('차단된 계정입니다. 고객센터에 문의하세요.');
    }

    if (user.deletedAt) {
      this.logger.warn(`탈퇴한 계정 로그인 시도: ${mobile}`);
      throw new UnauthorizedException('탈퇴한 계정입니다.');
    }

    this.logger.log(`휴대폰 로그인 성공: ${mobile} (ID: ${user.id})`);

    // JWT 토큰 생성
    const payload: JwtPayload = { sub: user.id, name: user.name };
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.jwt.accessTokenExpiresIn as any,
    });

    // Refresh Token 생성 및 저장
    const refreshToken = await this.createRefreshToken(user.id);

    // 클라이언트에 반환할 사용자 정보만 선택
    const userResponse = {
      id: user.id,
      // email: user.email,
      name: user.name,
      mobile: user.mobile,
      birthDate: user.birthDate,
      telecom: user.telecom,
      createdAt: user.createdAt,
    };

    return {
      user: userResponse,
      accessToken,
      refreshToken,
    };
  }

  /**
   * 휴대폰 회원가입
   * 휴대폰 본인인증 완료 후 호출
   *
   * @param phoneRegisterDto 회원가입 정보
   * @returns 생성된 사용자 정보와 JWT 토큰
   */
  async phoneRegister(phoneRegisterDto: PhoneRegisterDto) {
    const {
      certNumber,
      name,
      birthDate,
      telecom,
      mobile,
      sex,
      localCode,
      consents,
    } = phoneRegisterDto;

    this.logger.log(`휴대폰 회원가입 시도: ${mobile}`);

    // 1. 본인인증 검증
    await this.validatePhoneVerification(certNumber, mobile);

    // 2. 약관 동의 검증 (consents가 있을 때만)
    if (consents && consents.length > 0) {
      // 활성화된 필수 약관 조회 (SIGNUP 카테고리)
      const requiredConsents = await this.prisma.consent.findMany({
        where: {
          isRequired: true,
          isActive: true,
          category: 'SIGNUP',
          deletedAt: null,
        },
      });

      // 필수 약관 동의 검증
      for (const required of requiredConsents) {
        const userConsent = consents.find(c => c.consentId === required.id);

        if (!userConsent || !userConsent.isAgreed) {
          this.logger.warn(`필수 약관 미동의: ${mobile}, 약관: ${required.title}`);
          throw new ConflictException(`필수 약관 '${required.title}'에 동의해야 합니다.`);
        }
      }

      // 전달된 consentId가 실제 존재하는지 검증
      const consentIds = consents.map(c => c.consentId);
      const existingConsents = await this.prisma.consent.findMany({
        where: {
          id: { in: consentIds },
          isActive: true,
          deletedAt: null,
        },
      });

      if (existingConsents.length !== consentIds.length) {
        this.logger.warn(`유효하지 않은 약관 ID: ${mobile}`);
        throw new BadRequestException('유효하지 않은 약관 ID가 포함되어 있습니다.');
      }
    }

    // 5. 휴대폰 번호 중복 검사
    const existingUser = await this.prisma.user.findFirst({
      where: { mobile },
    });

    if (existingUser) {
      this.logger.warn(`이미 존재하는 휴대폰 번호: ${mobile}`);
      throw new ConflictException('이미 등록된 휴대폰 번호입니다.');
    }

    // 6. 사용자 생성 및 약관 동의 기록 (트랜잭션)
    const now = getNowKST();
    const user = await this.prisma.$transaction(async (tx) => {
      // 사용자 생성
      const newUser = await tx.user.create({
        data: {
          email: null,
          password: null,
          name,
          mobile,
          birthDate,
          telecom,
          sex,
          localCode,
          status: UserSubscriptionStatus.NEWCOMER,
          createdAt: now,
        },
        select: {
          id: true,
          name: true,
          mobile: true,
          birthDate: true,
          telecom: true,
          sex: true,
          localCode: true,
          createdAt: true,
        },
      });

      // 동의한 약관만 저장 (consents가 있을 때만)
      // 프론트에서 동의한 항목만 전송하므로 isAgreed는 항상 true
      if (consents && consents.length > 0) {
        for (const consent of consents) {
          await tx.userConsent.create({
            data: {
              userId: newUser.id,
              consentId: consent.consentId,
              isAgreed: true, // 동의한 항목만 전송받으므로 항상 true
              agreedAt: now,
            },
          });
        }
      }

      return newUser;
    });

    this.logger.log(`휴대폰 회원가입 성공: ${user.mobile} (ID: ${user.id})`);

    // JWT 토큰 생성
    const payload: JwtPayload = { sub: user.id, name: user.name };
    const accessToken = this.jwtService.sign(payload, {
      expiresIn: this.configService.jwt.accessTokenExpiresIn as any,
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
   * 휴대폰 간편 인증 요청
   * 통신사 + 휴대폰번호로 사용자 조회 후 본인인증 시작
   *
   * @param phoneRequestDto 통신사, 휴대폰 번호
   * @returns 본인인증 거래번호 (certNumber)
   */
  async phoneRequest(phoneRequestDto: PhoneRequestDto) {
    const { telecom, mobile } = phoneRequestDto;

    this.logger.log(`휴대폰 간편 인증 요청: ${mobile}`);

    // 1. 휴대폰 번호로 사용자 조회 (Prisma Extension이 자동으로 암호화하여 검색)
    const user = await this.prisma.user.findFirst({
      where: { mobile },
      select: {
        id: true,
        name: true,
        birthDate: true,
        sex: true,
        localCode: true,
      },
    });

    // 2. 사용자가 없으면 에러
    if (!user) {
      this.logger.warn(`미가입 사용자: ${mobile}`);
      throw new NotFoundException('등록되지 않은 휴대폰 번호입니다. 회원가입을 먼저 진행해주세요.');
    }

    // 3. 사용자 정보로 본인인증 요청 (내부 호출)
    this.logger.log(`사용자 정보 조회 완료: ${user.name}, 본인인증 요청 시작`);

    const verificationResult = await this.phoneVerificationService.requestVerification({
      mobile,
      userName: user.name,
      birthDay: user.birthDate || '',
      telecom: telecom as any, // TelecomCode 타입으로 전달
      sex: user.sex || '01', // 기본값: 남자
      localCode: user.localCode || '01', // 기본값: 내국인
    });

    this.logger.log(`본인인증 요청 완료: certNumber=${verificationResult.certNumber}`);

    return {
      certNumber: verificationResult.certNumber,
      message: verificationResult.message,
    };
  }



  //--------------------- TEST ---------------------
  /**
   * 테스트용 사전 회원 등록 (배열로 다수 등록)
   * 운영 DB에 사전 회원 정보 강제 등록
   *
   * @param users 회원 정보 배열
   * @returns 생성된 사용자 목록
   */
  async phoneRegisterTest(users: PhoneRegisterTestDto[]) {
    this.logger.log(`[테스트] 사전 회원 등록 시작: ${users.length}명`);

    const results = [];
    const now = getNowKST();

    for (const userDto of users) {
      const { name, mobile, birthDate, sex, telecom } = userDto;

      try {
        // 사용자 생성 (트랜잭션)
        const user = await this.prisma.$transaction(async (tx) => {
          const newUser = await tx.user.create({
            data: {
              email: null,
              password: null,
              name,
              mobile,
              birthDate,
              telecom,
              sex,
              localCode: '01', // 내국인 고정
              status: UserSubscriptionStatus.NEWCOMER,
              createdAt: now,
            },
            select: {
              id: true,
              name: true,
              mobile: true,
              birthDate: true,
              telecom: true,
              sex: true,
              createdAt: true,
            },
          });

          // 약관 동의 일괄 등록 (1~8번)
          for (let i = 1; i <= 8; i++) {
            await tx.userConsent.create({
              data: {
                userId: newUser.id,
                consentId: i,
                isAgreed: true,
                agreedAt: now,
                createdAt: now,
              },
            });
          }

          return newUser;
        });

        this.logger.log(`[테스트] 회원 등록 성공: ${user.name} (${user.mobile})`);
        results.push({ success: true, user });
      } catch (error) {
        this.logger.error(`[테스트] 회원 등록 실패: ${name} (${mobile}) - ${error.message}`);
        results.push({ success: false, name, mobile, error: error.message });
      }
    }

    this.logger.log(`[테스트] 사전 회원 등록 완료: 성공 ${results.filter(r => r.success).length}명 / 전체 ${users.length}명`);

    return results;
  }
}