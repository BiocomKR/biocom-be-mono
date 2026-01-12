/**
 * 앱 심사용 테스트 계정 생성 스크립트
 *
 * 사용법:
 *   npx ts-node prisma/operation/create-test-account.ts
 *
 * 계정 정보:
 *   - 전화번호: 010-0112-0112
 *   - OTP: 250519
 *   - 생년월일: 900519
 *   - 이름: 앱심사관
 */

import { PrismaClient } from '@prisma/client';
import { CryptoUtil } from '../../src/common/utils/crypto.util';

const prisma = new PrismaClient();

async function createTestAccount() {
  const testUser = {
    mobile: '01001120112',
    name: '뉴커머',
    birthDate: '19900519', // YYYYMMDD 형식
    sex: '01', // 남성
    telecom: 'SKT',
    isTester: true,
  };

  console.log('='.repeat(60));
  console.log('앱 심사용 테스트 계정 생성');
  console.log('='.repeat(60));
  console.log(`전화번호: ${testUser.mobile}`);
  console.log(`이름: ${testUser.name}`);
  console.log(`생년월일: ${testUser.birthDate}`);
  console.log(`OTP: 250519`);
  console.log('='.repeat(60));

  try {
    // 암호화된 mobile로 기존 계정 확인
    const encryptedMobile = CryptoUtil.encryptDeterministic(testUser.mobile);

    const existingUser = await prisma.user.findFirst({
      where: { mobile: encryptedMobile },
    });

    if (existingUser) {
      console.log(`\n기존 계정이 존재합니다. ID: ${existingUser.id}`);
      console.log('기존 계정을 삭제하고 새로 생성합니다...');

      // 관련 데이터 삭제
      await prisma.userConsent.deleteMany({ where: { userId: existingUser.id } });
      await prisma.refreshToken.deleteMany({ where: { userId: existingUser.id } });
      await prisma.user.delete({ where: { id: existingUser.id } });
      console.log('기존 계정 삭제 완료');
    }

    // 새 계정 생성 (암호화 적용)
    const now = new Date();
    const user = await prisma.user.create({
      data: {
        email: null,
        password: null,
        name: CryptoUtil.encrypt(testUser.name), // 이름 암호화 (GCM)
        mobile: CryptoUtil.encryptDeterministic(testUser.mobile), // 휴대폰 암호화 (CBC - 검색용)
        birthDate: testUser.birthDate,
        telecom: testUser.telecom,
        sex: testUser.sex,
        localCode: '01', // 내국인
        status: 'NEWCOMER',
        isActive: true,
        isTester: testUser.isTester,
        createdAt: now,
      },
    });

    console.log(`\n새 계정 생성 완료!`);
    console.log(`User ID: ${user.id}`);

    // 필수 약관 동의 처리
    const requiredConsents = await prisma.consent.findMany({
      where: {
        isRequired: true,
        isActive: true,
        category: 'SIGNUP',
        deletedAt: null,
      },
    });

    for (const consent of requiredConsents) {
      await prisma.userConsent.create({
        data: {
          userId: user.id,
          consentId: consent.id,
          isAgreed: true,
          agreedAt: now,
          createdAt: now,
        },
      });
    }

    console.log(`약관 동의 처리 완료: ${requiredConsents.length}개`);

    console.log('\n' + '='.repeat(60));
    console.log('테스트 계정 생성 완료!');
    console.log('='.repeat(60));
    console.log('\n로그인 방법:');
    console.log('1. 앱에서 전화번호 입력: 010-0112-0112');
    console.log('2. OTP 입력: 250519');
    console.log('='.repeat(60));

  } catch (error) {
    console.error('계정 생성 실패:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createTestAccount();
