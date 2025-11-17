import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { getNowKST } from '../src/common/utils/kst-date.util';
import { CryptoUtil } from '../src/common/utils/crypto.util';

const prisma = new PrismaClient();

/**
 * 관리자 계정 생성 스크립트
 *
 * 실행 방법:
 * npx ts-node scripts/create-manager-account.ts
 */
async function createManagerAccount() {
  try {
    console.log('🔧 관리자 계정 생성 시작...\n');

    const email = 'manager@biocom.kr';
    const password = 'manager1234!';
    const name = '관리자';
    const mobile = '010-0000-0000';

    // 이미 존재하는지 확인
    const existing = await prisma.user.findFirst({
      where: { email }
    });

    if (existing) {
      console.log('⚠️  이미 존재하는 계정입니다.');
      console.log(`📧 이메일: ${email}`);
      console.log(`👤 이름: ${existing.name}`);
      console.log(`🔑 역할: ${existing.role}`);

      // MANAGER 권한으로 업데이트
      if (existing.role !== 'MANAGER') {
        await prisma.user.update({
          where: { id: existing.id },
          data: { role: 'MANAGER' }
        });
        console.log('✅ 권한을 MANAGER로 업데이트했습니다.\n');
      }
      return;
    }

    // 비밀번호 해싱
    const hashedPassword = await bcrypt.hash(password, 10);

    // 개인정보 암호화
    const encryptedName = CryptoUtil.encrypt(name);
    const encryptedMobile = CryptoUtil.encrypt(mobile);

    // 관리자 계정 생성
    const manager = await prisma.user.create({
      data: {
        email,
        password: hashedPassword,
        name: encryptedName,
        mobile: encryptedMobile,
        role: 'MANAGER',
        status: 'NEWCOMER',
        points: 0,
        isActive: true,
        createdAt: getNowKST()
      }
    });

    console.log('✅ 관리자 계정이 생성되었습니다!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('📧 이메일:', email);
    console.log('🔒 비밀번호:', password);
    console.log('👤 이름:', name);
    console.log('🔑 역할:', manager.role);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    console.log('⚠️  비밀번호를 안전하게 보관하세요!\n');

  } catch (error) {
    console.error('❌ 관리자 계정 생성 실패:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

createManagerAccount();
