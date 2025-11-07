/**
 * KCP API 직접 호출 테스트 스크립트
 * - 우리 서버를 거치지 않고 KCP API를 직접 호출하여 요청 데이터 검증
 */

const fs = require('fs');
const crypto = require('crypto');
const axios = require('axios');
require('dotenv').config();

// 환경 변수
const SITE_CODE = process.env.KCP_SITE_CODE;
const WEB_SITE_ID = process.env.KCP_WEB_SITE_ID;
const CERT_PATH = process.env.KCP_CERT_INFO;
const PRIVATE_KEY_PATH = process.env.KCP_PRIVATE_KEY_PATH;
const PRIVATE_KEY_PASSWORD = process.env.KCP_PRIVATE_KEY_PASSWORD;
const CALLBACK_NUMBER = process.env.KCP_CALLBACK_NUMBER;

// 개인키 로드
const privateKey = fs.readFileSync(PRIVATE_KEY_PATH, 'utf8');

// 인증서 직렬화 (라인 정규화)
let certPem = fs.readFileSync(CERT_PATH, 'utf8');
certPem = certPem.replace(/\r\n/g, '\n').trim();

// 서명 생성 함수
function generateSignature(data) {
  const targetData = `${data.phone_no}^${data.birth_day}^${data.user_name}^${data.comm_id}^${data.sex_code}`;
  console.log('📝 서명 대상 데이터:', targetData);

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(targetData, 'utf8');
  sign.end();

  const signature = sign.sign({
    key: privateKey,
    passphrase: PRIVATE_KEY_PASSWORD,
  }, 'base64');

  console.log('🔐 생성된 서명:', signature.substring(0, 50) + '...');
  return signature;
}

// OTP 확인 서명 생성 함수
function generateOtpSignature(data) {
  const targetData = `${data.per_cert_no}^${data.cert_otp_no}`;
  console.log('📝 OTP 서명 대상 데이터:', targetData);

  const sign = crypto.createSign('RSA-SHA256');
  sign.update(targetData, 'utf8');
  sign.end();

  const signature = sign.sign({
    key: privateKey,
    passphrase: PRIVATE_KEY_PASSWORD,
  }, 'base64');

  console.log('🔐 생성된 서명:', signature.substring(0, 50) + '...');
  return signature;
}

// 1단계: 실명 확인
async function verifyIdentity() {
  console.log('\n========== 1단계: 실명 확인 ==========');

  const requestData = {
    site_cd: SITE_CODE,                              // site_code → site_cd
    kcp_cert_info: certPem,
    pay_method: 'CERT:PERSON',                       // 필수!
    ordr_idxx: 'TEST' + Date.now(),                  // 필수! 주문번호
    media_type: 'MC01',                              // 필수! 매체구분
    tx_type: '2100',
    cert_type: '01',                                 // 필수! 인증방식
    phone_no: '01056060746',
    comm_id: 'SKT',                                  // local_code → comm_id
    per_cert_no: '',
    birth_day: '19780519',
    user_name: '최대길',
    local_code: '01',                                // 지역코드 (01:내국인, 02:외국인)
    sex_code: '01',
    web_siteid: WEB_SITE_ID,
    kcp_web_yn: 'N',                                 // 필수! 웹사이트여부
    cp_sms_msg: '[바이옴] 본인인증 번호는 [000000]입니다',  // 필수! SMS 메시지
    cp_callback: CALLBACK_NUMBER,
  };

  // 서명 생성
  requestData.kcp_sign_data = generateSignature(requestData);

  console.log('\n📤 요청 데이터:');
  console.log(JSON.stringify({
    ...requestData,
    kcp_cert_info: requestData.kcp_cert_info.substring(0, 50) + '...',
    kcp_sign_data: requestData.kcp_sign_data.substring(0, 50) + '...',
  }, null, 2));

  try {
    const response = await axios.post(
      'https://spl.kcp.co.kr/gw/hub/v1/cert',
      new URLSearchParams(requestData).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000,
      }
    );

    console.log('\n✅ 응답 성공:');
    console.log(JSON.stringify(response.data, null, 2));

    return response.data;
  } catch (error) {
    console.error('\n❌ 요청 실패:');
    if (error.response) {
      console.error('상태 코드:', error.response.status);
      console.error('응답 데이터:', error.response.data);
    } else {
      console.error('에러 메시지:', error.message);
    }
    throw error;
  }
}

// 3단계: OTP 확인
async function confirmOtp(perCertNo, otpNumber) {
  console.log('\n========== 3단계: OTP 확인 ==========');

  const requestData = {
    site_cd: SITE_CODE,                              // site_code → site_cd
    kcp_cert_info: certPem,
    pay_method: 'CERT:PERSON',                       // 필수!
    tx_type: '2300',
    per_cert_no: perCertNo,
    cert_otp_no: otpNumber,
    web_siteid: WEB_SITE_ID,
  };

  // 서명 생성
  requestData.kcp_sign_data = generateOtpSignature(requestData);

  console.log('\n📤 요청 데이터:');
  console.log(JSON.stringify({
    ...requestData,
    kcp_cert_info: requestData.kcp_cert_info.substring(0, 50) + '...',
    kcp_sign_data: requestData.kcp_sign_data.substring(0, 50) + '...',
  }, null, 2));

  try {
    const response = await axios.post(
      'https://spl.kcp.co.kr/gw/hub/v1/cert',
      new URLSearchParams(requestData).toString(),
      {
        headers: {
          'Content-Type': 'application/x-www-form-urlencoded',
        },
        timeout: 10000,
      }
    );

    console.log('\n✅ 응답 성공:');
    console.log(JSON.stringify(response.data, null, 2));

    return response.data;
  } catch (error) {
    console.error('\n❌ 요청 실패:');
    if (error.response) {
      console.error('상태 코드:', error.response.status);
      console.error('응답 데이터:', error.response.data);
    } else {
      console.error('에러 메시지:', error.message);
    }
    throw error;
  }
}

// 메인 실행
async function main() {
  try {
    // 1단계 실행
    const identityResult = await verifyIdentity();

    // per_cert_no 추출
    const perCertNo = identityResult.per_cert_no;
    console.log('\n🔑 발급된 인증번호:', perCertNo);

    // OTP 입력 대기
    console.log('\n📱 SMS로 받은 OTP 번호를 입력하세요:');
    console.log('   node test-kcp-direct.js confirm <per_cert_no> <otp_number>');

  } catch (error) {
    console.error('\n💥 테스트 실패:', error.message);
    process.exit(1);
  }
}

// CLI 인터페이스
const command = process.argv[2];
const perCertNo = process.argv[3];
const otpNumber = process.argv[4];

if (command === 'confirm' && perCertNo && otpNumber) {
  confirmOtp(perCertNo, otpNumber);
} else {
  main();
}
