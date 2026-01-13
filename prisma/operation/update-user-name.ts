import { PrismaClient } from '@prisma/client';
import { CryptoUtil } from '../../src/common/utils/crypto.util';

const prisma = new PrismaClient();

async function main() {
  const targetName = '바이오컴';
  const newName = '앱심사관';

  console.log(`\n=== '${targetName}' → '${newName}' 이름 변경 스크립트 ===\n`);

  // 1. 모든 유저 조회 후 복호화해서 검색
  const users = await prisma.user.findMany({
    select: { id: true, name: true, mobile: true, email: true, status: true },
  });

  // 이름이 '바이오컴'인 유저 찾기
  const targetUsers = users.filter(u => {
    try {
      const decryptedName = CryptoUtil.decrypt(u.name);
      return decryptedName === targetName;
    } catch {
      return false;
    }
  });

  if (targetUsers.length === 0) {
    console.log(`'${targetName}' 이름을 가진 유저가 없습니다.`);
    return;
  }

  console.log(`'${targetName}' 유저 ${targetUsers.length}명 발견:\n`);
  for (const u of targetUsers) {
    const decryptedName = CryptoUtil.decrypt(u.name);
    const decryptedMobile = CryptoUtil.decryptDeterministic(u.mobile);
    console.log(`  - userId: ${u.id}, 이름: ${decryptedName}, 휴대폰: ${decryptedMobile}, 이메일: ${u.email || '없음'}, 상태: ${u.status}`);
  }

  // 2. 이름 변경
  const encryptedNewName = CryptoUtil.encrypt(newName);

  for (const u of targetUsers) {
    await prisma.user.update({
      where: { id: u.id },
      data: { name: encryptedNewName },
    });
    console.log(`\n✅ userId ${u.id}: '${targetName}' → '${newName}' 변경 완료`);
  }

  // 3. 변경 확인
  console.log('\n=== 변경 결과 확인 ===\n');
  const updatedUsers = await prisma.user.findMany({
    where: { id: { in: targetUsers.map(u => u.id) } },
    select: { id: true, name: true, mobile: true },
  });

  for (const u of updatedUsers) {
    const decryptedName = CryptoUtil.decrypt(u.name);
    const decryptedMobile = CryptoUtil.decryptDeterministic(u.mobile);
    console.log(`  - userId: ${u.id}, 이름: ${decryptedName}, 휴대폰: ${decryptedMobile}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
