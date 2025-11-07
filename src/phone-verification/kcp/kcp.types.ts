/**
 * NHN KCP 본인확인 HUB API 타입 정의
 */

// 통신사 코드
export enum TelecomCode {
  SKT = 'SKT', // SK텔레콤
  KTF = 'KTF', // KT
  LGT = 'LGT', // LGU+
  SKM = 'SKM', // SK텔레콤 알뜰폰
  KTM = 'KTM', // KT 알뜰폰
  LGM = 'LGM', // LGU+ 알뜰폰
}

// 요청 유형 코드
export enum TxType {
  IDENTITY_VERIFICATION = '2100', // 실명 확인
  SMS_SEND = '2200', // SMS 발송
  OTP_CONFIRM = '2300', // 인증번호 확인
  MVNO_INQUIRY = '2400', // MVNO 사업자조회
}

// 성별 코드
export enum SexCode {
  MALE = '01',
  FEMALE = '02',
}

// 내/외국인 코드
export enum LocalCode {
  LOCAL = '01', // 내국인
  FOREIGNER = '02', // 외국인
}

// 공통 요청 헤더
export interface KcpCommonRequest {
  site_cd: string; // 사이트 코드
  kcp_cert_info: string; // 서비스 인증서
  pay_method: 'CERT:PERSON'; // 고정값
}

// 실명 확인 요청
export interface KcpIdentityRequest extends KcpCommonRequest {
  kcp_sign_data: string; // 서명 데이터
  ordr_idxx: string; // 주문번호
  media_type: string; // 매체구분 (MC01: PC, MC02: 모바일)
  tx_type: TxType.IDENTITY_VERIFICATION;
  cert_type: '01'; // 인증유형 고정값
  phone_no: string; // 휴대폰번호
  comm_id: TelecomCode; // 통신사코드
  per_cert_no: string; // MVNO 거래번호 (알뜰폰이면 입력, 아니면 공백)
  birth_day: string; // 생년월일 (YYYYMMDD)
  user_name: string; // 명의자명
  local_code: LocalCode; // 내/외국인코드
  sex_code: SexCode; // 성별코드
  web_siteid: string; // 웹사이트 아이디
  kcp_web_yn: 'N'; // 표준인증창 사용여부 (고정값 N)
  cp_sms_msg: string; // CP지정 메시지
  cp_callback?: string; // CP 지정 callback 번호
}

// SMS 발송 요청
export interface KcpSmsSendRequest extends KcpCommonRequest {
  tx_type: TxType.SMS_SEND;
  per_cert_no: string; // 본인확인 거래번호
  comm_id: TelecomCode; // 통신사코드
  kcp_web_yn: 'N';
  cp_sms_msg: string;
  cp_callback?: string;
}

// 인증번호 확인 요청
export interface KcpOtpConfirmRequest extends KcpCommonRequest {
  tx_type: TxType.OTP_CONFIRM;
  per_cert_no: string; // 본인확인 거래번호
  comm_id: TelecomCode; // 통신사코드
  otp_no: string; // SMS 인증번호
  adl_agree_yn: 'Y' | 'N'; // 휴대폰 인증보호 수신동의
  kcp_web_yn: 'N';
}

// MVNO 사업자조회 요청
export interface KcpMvnoInquiryRequest extends KcpCommonRequest {
  kcp_sign_data: string;
  ordr_idxx: string;
  tx_type: TxType.MVNO_INQUIRY;
  cert_type: '01';
  phone_no: string;
  comm_id: TelecomCode.KTM | TelecomCode.LGM; // KTM, LGM만 가능
  user_name: string;
  local_code: LocalCode;
  sex_code: SexCode;
  birth_day: string;
  web_siteid: string;
  kcp_web_yn: 'N';
}

// 공통 응답
export interface KcpCommonResponse {
  res_cd: string; // 결과코드 (0000: 성공)
  res_msg: string; // 결과메시지
}

// 실명 확인 응답
export interface KcpIdentityResponse extends KcpCommonResponse {
  per_cert_no: string; // 본인확인 거래번호
  order_id: string; // 주문번호
  phone_no: string; // 휴대폰번호
  comm_id: TelecomCode;
  iden_only_yn: 'Y' | 'N';
  safe_guard_yn: 'Y' | 'N';
  usim_otp_yn: 'Y' | 'N';
  sms_snd_yn: 'Y' | 'N'; // SMS 발송여부
  cert_num_guard_yn: 'Y' | 'N';
  van_tx_id: string; // KCP Transaction ID
  auth_tx_id?: string; // 기관 Transaction ID
}

// SMS 발송 응답
export interface KcpSmsSendResponse extends KcpCommonResponse {
  per_cert_no: string;
  phone_no: string;
  comm_id: TelecomCode;
  sms_snd_yn: 'Y' | 'N';
  safe_guard_yn: 'Y' | 'N';
  usim_otp_yn: 'Y' | 'N';
  site_url: string;
}

// 인증번호 확인 응답 (최종 본인인증 완료)
export interface KcpOtpConfirmResponse extends KcpCommonResponse {
  per_cert_no: string;
  phone_no: string;
  comm_id: TelecomCode;
  CI: string; // 개인 고유 연계정보
  CI_URL: string; // URL 인코딩된 CI
  DI: string; // 업체별 중복가입 확인정보
  DI_URL: string; // URL 인코딩된 DI
}

// MVNO 사업자조회 응답
export interface KcpMvnoInquiryResponse extends KcpCommonResponse {
  per_cert_no: string; // MVNO 거래번호
  phone_no: string;
  comm_id: TelecomCode;
  mvno_name: string; // MVNO 사업자명
}

// 서명 생성용 데이터
export interface SignatureData {
  phone_no: string;
  birth_day: string;
  user_name: string;
  local_code: LocalCode;
  sex_code: SexCode;
}
