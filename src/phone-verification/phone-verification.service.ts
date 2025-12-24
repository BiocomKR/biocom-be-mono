import {
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../common/services/prisma.service';
import { getNowKST } from '../common/utils/kst-date.util';
import {
  RequestVerificationDto,
  RequestVerificationResponseDto,
  VerifyOtpDto,
  VerifyOtpResponseDto,
} from './dto';
import { KcpApiService } from './kcp/kcp-api.service';
import { KcpSignatureService } from './kcp/kcp-signature.service';
import {
  KcpIdentityRequest,
  KcpSmsSendRequest,
  TelecomCode,
  TxType,
} from './kcp/kcp.types';

/**
 * 본인인증 단계 enum
 */
export enum VerificationStep {
  /** 실명 확인 완료 */
  IDENTITY = 'IDENTITY',
  /** SMS 발송 완료 */
  SMS_SENT = 'SMS_SENT',
  /** 인증 완료 */
  VERIFIED = 'VERIFIED',
}

/**
 * 본인인증 상태 enum
 */
export enum VerificationStatus {
  /** 대기중 */
  PENDING = 'PENDING',
  /** 완료 */
  COMPLETED = 'COMPLETED',
  /** 실패 */
  FAILED = 'FAILED',
}

/**
 * 휴대폰 본인인증 서비스
 * - requestVerification: KCP 1단계(실명확인) + 2단계(SMS발송) 자동 연속 처리
 * - verifyOtp: KCP 3단계(OTP확인) 처리
 */
@Injectable()
export class PhoneVerificationService {
  private readonly logger = new Logger(PhoneVerificationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly kcpApiService: KcpApiService,
    private readonly kcpSignatureService: KcpSignatureService,
    private readonly configService: ConfigService,
  ) {}

  /**
   * 본인인증 요청 (KCP 1단계 + 2단계 자동 처리)
   * 1. KCP 1단계(실명확인) API 호출
   * 2. 응답 받은 per_cert_no를 DB에 저장
   * 3. KCP 2단계(SMS발송) API 호출 (per_cert_no 바인딩)
   * 4. per_cert_no 반환 (클라이언트가 3단계에서 사용)
   */
  async requestVerification(
    dto: RequestVerificationDto,
  ): Promise<RequestVerificationResponseDto> {
    this.logger.log(`🚀 본인인증 요청 시작 - 이름: ${dto.userName}`);

    // 주문번호 생성
    const orderId = this.generateOrderId();

    // MVNO(알뜰폰) 처리
    let perCertNo = '';
    if (dto.telecom === TelecomCode.KTM || dto.telecom === TelecomCode.LGM) {
      perCertNo = await this.handleMvno(dto, orderId);
    }

    // === 1단계: 실명 확인 ===
    this.logger.log('📝 1단계: 실명 확인 API 호출');

    const signatureData = this.kcpSignatureService.generateIdentitySignature({
      phone_no: dto.mobile,
      birth_day: dto.birthDay,
      user_name: dto.userName,
      local_code: dto.localCode,
      sex_code: dto.sex,
    });

    const step1Request: KcpIdentityRequest = {
      site_cd: this.configService.get<string>('KCP_SITE_CODE')!,
      kcp_cert_info: this.getKcpCertInfo(),
      kcp_sign_data: signatureData,
      pay_method: 'CERT:PERSON',
      ordr_idxx: orderId,
      media_type: 'MC01',
      tx_type: TxType.IDENTITY_VERIFICATION,
      cert_type: '01',
      phone_no: dto.mobile,
      comm_id: dto.telecom,
      per_cert_no: perCertNo,
      birth_day: dto.birthDay,
      user_name: dto.userName,
      local_code: dto.localCode,
      sex_code: dto.sex,
      web_siteid: this.configService.get<string>('KCP_WEB_SITE_ID')!,
      kcp_web_yn: 'N',
      cp_sms_msg: '[바이오컴]인증번호는[000000]입니다',
      cp_callback: this.configService.get<string>('KCP_CALLBACK_NUMBER'),
    };

    const step1Response = await this.kcpApiService.verifyIdentity(step1Request);
    this.logger.log(`✅ 1단계 성공 - per_cert_no: ${step1Response.per_cert_no}`);

    // === DB 저장 (1단계 응답값) ===
    try {
      await this.saveLog({
        certNumber: step1Response.per_cert_no,
        orderId: orderId,
        mobile: dto.mobile,
        userName: dto.userName,
        birthDay: dto.birthDay,
        telecom: dto.telecom,
        sex: dto.sex,
        step: VerificationStep.IDENTITY,
        vanTxId: step1Response.van_tx_id,
        smsSndYn: step1Response.sms_snd_yn,
        idenOnlyYn: step1Response.iden_only_yn,
        safeGuardYn: step1Response.safe_guard_yn,
        usimOtpYn: step1Response.usim_otp_yn,
        certNumGuardYn: step1Response.cert_num_guard_yn,
        authTxId: step1Response.auth_tx_id,
      });
      this.logger.log('✅ DB 저장 완료');
    } catch (error) {
      this.logger.error('❌ DB 저장 실패:', error);
      throw error;
    }

    // === 2단계: SMS 발송 ===
    this.logger.log('📱 2단계: SMS 발송 API 호출');

    const step2Request: KcpSmsSendRequest = {
      site_cd: this.configService.get<string>('KCP_SITE_CODE')!,
      kcp_cert_info: this.getKcpCertInfo(),
      pay_method: 'CERT:PERSON',
      tx_type: TxType.SMS_SEND,
      per_cert_no: step1Response.per_cert_no, // 1단계에서 받은 값 바인딩
      comm_id: dto.telecom,
      kcp_web_yn: 'N',
      cp_sms_msg: '[바이오컴]인증번호는[000000]입니다',
      cp_callback: this.configService.get<string>('KCP_CALLBACK_NUMBER'),
    };

    const step2Response = await this.kcpApiService.sendSms(step2Request);
    this.logger.log(`✅ 2단계 성공 - SMS 발송: ${step2Response.sms_snd_yn}`);

    // DB 업데이트 (SMS 발송 완료)
    await this.prisma.phoneVerificationLog.updateMany({
      where: { certNumber: step1Response.per_cert_no },
      data: {
        step: VerificationStep.SMS_SENT,
        updatedAt: getNowKST(),
      },
    });

    this.logger.log('🎉 본인인증 요청 완료 (1단계 + 2단계)');

    return {
      certNumber: step1Response.per_cert_no,
      message: 'SMS가 발송되었습니다. 인증번호를 확인해주세요.',
    };
  }

  /**
   * 인증번호 검증 (KCP 3단계 처리)
   * 1. KCP 3단계(OTP확인) API 호출
   * 2. CI/DI 값 DB 저장
   * 3. CI/DI 반환
   */
  async verifyOtp(dto: VerifyOtpDto): Promise<VerifyOtpResponseDto> {
    this.logger.log('='.repeat(80));
    this.logger.log('🔐 인증번호 검증 시작');
    this.logger.log(`📋 거래번호: ${dto.certNumber}`);
    this.logger.log(`🔢 입력한 OTP: ${dto.otpNumber}`);
    this.logger.log('='.repeat(80));

    // 로그 조회
    const log = await this.prisma.phoneVerificationLog.findFirst({
      where: { certNumber: dto.certNumber },
    });

    if (!log) {
      throw new NotFoundException(
        '본인확인 거래번호를 찾을 수 없습니다. 먼저 본인인증 요청 API를 호출해주세요.',
      );
    }

    this.logger.log(`📝 DB에서 찾은 로그:`);
    this.logger.log(`  - certNumber: ${log.certNumber}`);
    this.logger.log(`  - mobile: ${log.mobile}`);
    this.logger.log(`  - userName: ${log.userName}`);
    this.logger.log(`  - telecom: ${log.telecom}`);

    // === 3단계: 인증번호 확인 ===
    const step3Request = {
      site_cd: this.configService.get<string>('KCP_SITE_CODE')!,
      kcp_cert_info: this.getKcpCertInfo(),
      pay_method: 'CERT:PERSON' as const,
      tx_type: TxType.OTP_CONFIRM as TxType.OTP_CONFIRM,
      per_cert_no: dto.certNumber,
      comm_id: log.telecom as any,
      otp_no: dto.otpNumber,
      adl_agree_yn: 'Y' as const,
      kcp_web_yn: 'N' as const,
    };

    this.logger.log('📤 KCP API 요청:');
    this.logger.log(`  - per_cert_no: ${step3Request.per_cert_no}`);
    this.logger.log(`  - otp_no: ${step3Request.otp_no}`);

    const response = await this.kcpApiService.confirmOtp(step3Request);
    this.logger.log('✅ 3단계 성공 - CI/DI 획득');

    // DB 업데이트 (CI/DI 저장)
    await this.prisma.phoneVerificationLog.update({
      where: { id: log.id },
      data: {
        ci: response.CI,
        di: response.DI,
        step: VerificationStep.VERIFIED,
        verificationStatus: VerificationStatus.COMPLETED,
        updatedAt: getNowKST(),
      },
    });

    this.logger.log('🎉 본인인증 완료');

    return {
      success: true,
      ci: response.CI,
      di: response.DI,
      message: '본인인증이 완료되었습니다.',
    };
  }

  /**
   * MVNO(알뜰폰) 사업자 조회
   * KTM, LGM만 해당
   */
  private async handleMvno(
    dto: RequestVerificationDto,
    orderId: string,
  ): Promise<string> {
    this.logger.log(`MVNO 사업자조회 시작 - 통신사: ${dto.telecom}`);

    const signatureData = this.kcpSignatureService.generateIdentitySignature({
      phone_no: dto.mobile,
      birth_day: dto.birthDay,
      user_name: dto.userName,
      local_code: dto.localCode,
      sex_code: dto.sex,
    });

    const mvnoRequest = {
      site_cd: this.configService.get<string>('KCP_SITE_CODE')!,
      kcp_cert_info: this.getKcpCertInfo(),
      kcp_sign_data: signatureData,
      pay_method: 'CERT:PERSON' as const,
      ordr_idxx: orderId,
      tx_type: TxType.MVNO_INQUIRY as TxType.MVNO_INQUIRY,
      cert_type: '01' as const,
      phone_no: dto.mobile,
      comm_id: dto.telecom as TelecomCode.KTM | TelecomCode.LGM,
      user_name: dto.userName,
      local_code: dto.localCode,
      sex_code: dto.sex,
      birth_day: dto.birthDay,
      web_siteid: this.configService.get<string>('KCP_WEB_SITE_ID')!,
      kcp_web_yn: 'N' as const,
    };

    const response = await this.kcpApiService.inquireMvno(mvnoRequest);

    this.logger.log(
      `MVNO 사업자조회 완료 - 사업자: ${response.mvno_name}, 거래번호: ${response.per_cert_no}`,
    );

    return response.per_cert_no;
  }

  /**
   * 주문번호 생성 (유니크)
   */
  private generateOrderId(): string {
    const timestamp = Date.now();
    const random = Math.floor(Math.random() * 10000);
    return `BIOCOM${timestamp}${random}`;
  }

  /**
   * KCP 인증서 파일 내용 읽기
   * kcp_cert_info는 PEM 인증서를 "직렬화"하여 전달
   * 직렬화: \r\n을 \n으로 정규화 (PEM 형식 유지)
   */
  private getKcpCertInfo(): string {
    const certPath = this.configService.get<string>('KCP_CERT_INFO');
    if (!certPath) {
      throw new NotFoundException(
        'KCP 서비스 인증서가 설정되지 않았습니다. 환경변수를 확인해주세요.',
      );
    }

    try {
      const fs = require('fs');
      let certPem = fs.readFileSync(certPath, 'utf8');

      // 직렬화: \r\n을 \n으로 정규화
      certPem = certPem.replace(/\r\n/g, '\n');
      certPem = certPem.trim();

      return certPem;
    } catch (error) {
      this.logger.error('❌ KCP 인증서 파일 읽기 실패:', error);
      throw new Error('KCP 인증서 파일을 읽을 수 없습니다.');
    }
  }

  /**
   * 본인인증 로그 저장
   */
  private async saveLog(data: {
    certNumber: string;
    orderId?: string;
    mobile: string;
    userName: string;
    birthDay: string;
    telecom: string;
    sex: string;
    step: VerificationStep;
    vanTxId?: string;
    smsSndYn?: string;
    idenOnlyYn?: string;
    safeGuardYn?: string;
    usimOtpYn?: string;
    certNumGuardYn?: string;
    authTxId?: string;
  }): Promise<void> {
    const now = getNowKST();

    await this.prisma.phoneVerificationLog.create({
      data: {
        certNumber: data.certNumber,
        orderId: data.orderId,
        mobile: data.mobile,
        userName: data.userName,
        birthDay: data.birthDay,
        telecom: data.telecom,
        sex: data.sex,
        vanTxId: data.vanTxId,
        smsSndYn: data.smsSndYn,
        idenOnlyYn: data.idenOnlyYn,
        safeGuardYn: data.safeGuardYn,
        usimOtpYn: data.usimOtpYn,
        certNumGuardYn: data.certNumGuardYn,
        authTxId: data.authTxId,
        step: data.step,
        verificationStatus: VerificationStatus.PENDING,
        createdAt: now,
        updatedAt: now,
      },
    });
  }
}
