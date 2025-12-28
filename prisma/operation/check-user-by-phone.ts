import { PrismaClient } from '@prisma/client';
import { CryptoUtil } from '../../src/common/utils/crypto.util';

const prisma = new PrismaClient();
const phone = process.argv[2] || '01042306270';

async function check() {
  const encryptedMobile = CryptoUtil.encryptDeterministic(phone);
  console.log('검색할 번호:', phone);
  console.log('암호화된 번호:', encryptedMobile);

  const user = await prisma.user.findFirst({
    where: { mobile: encryptedMobile },
    select: { id: true, mobile: true, status: true, name: true }
  });

  if (user) {
    console.log('찾은 유저:', { ...user, decryptedMobile: CryptoUtil.decryptDeterministic(user.mobile) });
  } else {
    console.log('해당 번호의 유저를 찾을 수 없습니다.');
  }

  await prisma.$disconnect();
}
check();
