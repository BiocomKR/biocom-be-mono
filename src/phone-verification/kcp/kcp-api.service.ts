import { HttpService } from '@nestjs/axios';
import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { firstValueFrom } from 'rxjs';
import {
  KcpCommonResponse,
  KcpIdentityRequest,
  KcpIdentityResponse,
  KcpMvnoInquiryRequest,
  KcpMvnoInquiryResponse,
  KcpOtpConfirmRequest,
  KcpOtpConfirmResponse,
  KcpSmsSendRequest,
  KcpSmsSendResponse,
} from './kcp.types';

/**
 * NHN KCP API 통신 서비스
 * 본인확인 HUB API와 통신하는 서비스
 */
@Injectable()
export class KcpApiService {
  private readonly logger = new Logger(KcpApiService.name);
  private readonly baseUrl: string;
  private readonly timeout = 10000; // 10초 타임아웃

  constructor(
    private readonly httpService: HttpService,
    private readonly configService: ConfigService,
  ) {
    // 테스트/운영 환경에 따른 URL 설정
    const isProduction = this.configService.get('NODE_ENV') === 'prod';

    // TODO: 형님, KCP 담당자에게 환경 확인 필요!
    // 임시로 운영 서버로 테스트 (실제 SMS 발송됨 주의!)
    this.baseUrl = 'https://spl.kcp.co.kr'; // 운영 서버
    // this.baseUrl = isProduction
    //   ? 'https://spl.kcp.co.kr'
    //   : 'https://stg-spl.kcp.co.kr';

    this.logger.log(`⚠️  KCP API 서버 (임시 운영): ${this.baseUrl}`);
  }

  /**
   * 실명 확인 API 호출 (tx_type: 2100)
   * 본인 정보 검증 + 거래번호 발급 + SMS 전송(SK/KT)
   */
  async verifyIdentity(
    request: KcpIdentityRequest,
  ): Promise<KcpIdentityResponse> {
    const url = `${this.baseUrl}/gw/hub/v1/cert`;

    this.logger.log('='.repeat(80));
    this.logger.log('🚀 KCP API 실명 확인 요청 시작');
    this.logger.log('='.repeat(80));
    this.logger.log(`📞 전화번호: ${request.phone_no}`);
    this.logger.log(`👤 이름: ${request.user_name}`);
    this.logger.log(`🎂 생년월일: ${request.birth_day}`);
    this.logger.log(`📡 통신사: ${request.comm_id}`);
    this.logger.log(`🆔 사이트코드: ${request.site_cd}`);
    this.logger.log(`🌐 WEB_SITE_ID: ${request.web_siteid}`);
    this.logger.log(`📋 주문번호: ${request.ordr_idxx}`);
    this.logger.log(`📄 kcp_cert_info 길이: ${request.kcp_cert_info?.length || 0}자`);
    this.logger.log(`🔐 kcp_sign_data 길이: ${request.kcp_sign_data?.length || 0}자`);
    this.logger.log(`🔒 kcp_cert_info 앞 100자: ${request.kcp_cert_info?.substring(0, 100)}...`);
    this.logger.log('='.repeat(80));

    try {
      const response = await firstValueFrom(
        this.httpService.post<KcpIdentityResponse>(url, request, {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      );

      this.checkResponse(response.data);
      this.logger.log(
        `실명 확인 성공 - 거래번호: ${response.data.per_cert_no}`,
      );

      return response.data;
    } catch (error) {
      this.logger.error('❌ 실명 확인 실패');
      this.logger.error('에러 메시지:', error.message);
      this.logger.error('에러 코드:', error.code);

      if (error.response) {
        this.logger.error('HTTP Status:', error.response.status);
        this.logger.error('KCP API 전체 응답:', JSON.stringify(error.response.data, null, 2));
      }

      // 요청 데이터도 다시 한번 출력
      this.logger.error('🔍 실패한 요청 데이터:', JSON.stringify(request, null, 2));

      throw new Error(`본인 정보 확인에 실패했습니다: ${error.message}`);
    }
  }

  /**
   * SMS 발송 API 호출 (tx_type: 2200)
   * 인증번호 SMS 전송 또는 재전송
   */
  async sendSms(request: KcpSmsSendRequest): Promise<KcpSmsSendResponse> {
    const url = `${this.baseUrl}/gw/hub/v1/cert`;

    this.logger.log(`SMS 발송 요청 - 거래번호: ${request.per_cert_no}`);

    try {
      const response = await firstValueFrom(
        this.httpService.post<KcpSmsSendResponse>(url, request, {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      );

      this.checkResponse(response.data);
      this.logger.log(
        `SMS 발송 성공 - sms_snd_yn: ${response.data.sms_snd_yn}`,
      );

      return response.data;
    } catch (error) {
      this.logger.error('SMS 발송 실패:', error);
      throw new Error('인증번호 전송에 실패했습니다.');
    }
  }

  /**
   * 인증번호 확인 API 호출 (tx_type: 2300)
   * 최종 본인인증 완료 → CI/DI 획득
   */
  async confirmOtp(
    request: KcpOtpConfirmRequest,
  ): Promise<KcpOtpConfirmResponse> {
    const url = `${this.baseUrl}/gw/hub/v1/cert`;

    this.logger.log(
      `인증번호 확인 요청 - 거래번호: ${request.per_cert_no}, OTP: ${request.otp_no}`,
    );

    try {
      const response = await firstValueFrom(
        this.httpService.post<KcpOtpConfirmResponse>(url, request, {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      );

      this.checkResponse(response.data);
      this.logger.log('본인인증 완료 - CI/DI 발급 성공');

      return response.data;
    } catch (error) {
      this.logger.error('인증번호 확인 실패:', error);
      throw new Error('인증번호가 일치하지 않습니다.');
    }
  }

  /**
   * MVNO 사업자조회 API 호출 (tx_type: 2400)
   * 알뜰폰(KTM, LGM) 사업자 조회
   */
  async inquireMvno(
    request: KcpMvnoInquiryRequest,
  ): Promise<KcpMvnoInquiryResponse> {
    const url = `${this.baseUrl}/gw/hub/v1/cert`;

    this.logger.log(
      `MVNO 사업자조회 요청 - 전화번호: ${request.phone_no}, 통신사: ${request.comm_id}`,
    );

    try {
      const response = await firstValueFrom(
        this.httpService.post<KcpMvnoInquiryResponse>(url, request, {
          timeout: this.timeout,
          headers: {
            'Content-Type': 'application/json',
          },
        }),
      );

      this.checkResponse(response.data);
      this.logger.log(
        `MVNO 사업자조회 성공 - 거래번호: ${response.data.per_cert_no}`,
      );

      return response.data;
    } catch (error) {
      this.logger.error('MVNO 사업자조회 실패:', error);
      throw new Error('알뜰폰 사업자 조회에 실패했습니다.');
    }
  }

  /**
   * 응답 코드 검증
   * res_cd가 "0000"이 아니면 에러
   */
  private checkResponse(response: KcpCommonResponse): void {
    if (response.res_cd !== '0000') {
      this.logger.error(
        `KCP API 오류 - 코드: ${response.res_cd}, 메시지: ${response.res_msg}`,
      );
      throw new Error(`본인인증 처리 실패: ${response.res_msg}`);
    }
  }
}
