import { PrismaClient } from '@prisma/client';
import { CryptoUtil } from '../../src/common/utils/crypto.util';

const prisma = new PrismaClient();

async function main() {
  const users = await prisma.user.findMany({
    where: { id: { in: [48, 50, 45] } },
    select: { id: true, name: true, mobile: true, email: true, status: true, createdAt: true },
  });

  console.log('=== 사용자 정보 (userId 45, 48, 50) ===\n');
  for (const u of users) {
    const decryptedName = CryptoUtil.decrypt(u.name);
    const decryptedMobile = CryptoUtil.decryptDeterministic(u.mobile);
    console.log(`userId: ${u.id}`);
    console.log(`  이름: ${decryptedName}`);
    console.log(`  휴대폰: ${decryptedMobile}`);
    console.log(`  이메일: ${u.email || '없음'}`);
    console.log(`  상태: ${u.status}`);
    console.log(`  가입일: ${u.createdAt.toISOString()}`);
    console.log('');
  }
}

main().finally(() => prisma.$disconnect());
