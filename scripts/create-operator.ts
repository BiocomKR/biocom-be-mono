/**
 * 운영자 계정 생성 스크립트
 *
 * 실행 방법:
 * npx ts-node scripts/create-operator.ts
 *
 * 또는 환경변수로 값 전달:
 * EMAIL=admin@biocom.com PASSWORD=password123 NAME=관리자 npx ts-node scripts/create-operator.ts
 */

import { PrismaClient, AccessTier } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import * as readline from 'readline';

const prisma = new PrismaClient();

async function prompt(question: string): Promise<string> {
  const rl = readline.createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  return new Promise((resolve) => {
    rl.question(question, (answer) => {
      rl.close();
      resolve(answer);
    });
  });
}

async function main() {
  console.log('=================================');
  console.log('  운영자 계정 생성 스크립트');
  console.log('=================================\n');

  // 환경변수 또는 프롬프트로 입력받기
  const email = process.env.EMAIL || (await prompt('이메일: '));
  const password = process.env.PASSWORD || (await prompt('비밀번호: '));
  const name = process.env.NAME || (await prompt('이름: '));
  const tierInput =
    process.env.ACCESS_TIER || (await prompt('등급 (SYSTEM/MANAGER/STAFF/VIEWER, 기본: SYSTEM): '));

  const accessTier = (tierInput.toUpperCase() as AccessTier) || 'SYSTEM';

  // 유효성 검사
  if (!email || !password || !name) {
    console.error('❌ 이메일, 비밀번호, 이름은 필수입니다.');
    process.exit(1);
  }

  if (!['SYSTEM', 'MANAGER', 'STAFF', 'VIEWER'].includes(accessTier)) {
    console.error('❌ 유효하지 않은 등급입니다. (SYSTEM/MANAGER/STAFF/VIEWER)');
    process.exit(1);
  }

  // 이메일 중복 체크
  const existing = await prisma.operator.findUnique({
    where: { email },
  });

  if (existing) {
    console.error(`❌ 이미 존재하는 이메일입니다: ${email}`);
    process.exit(1);
  }

  // 비밀번호 해싱
  const hashedPassword = await bcrypt.hash(password, 10);

  // 운영자 생성
  const operator = await prisma.operator.create({
    data: {
      email,
      password: hashedPassword,
      name,
      accessTier,
      isActive: true,
    },
  });

  console.log('\n✅ 운영자 계정이 생성되었습니다!\n');
  console.log('  ID:', operator.id);
  console.log('  이메일:', operator.email);
  console.log('  이름:', operator.name);
  console.log('  등급:', operator.accessTier);
  console.log('  생성일:', operator.createdAt);
  console.log('');
}

main()
  .catch((e) => {
    console.error('❌ 오류 발생:', e.message);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
