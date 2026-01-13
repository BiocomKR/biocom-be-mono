import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';

const prisma = new PrismaClient();

async function main() {
  console.log('📦 domain_knowledge_embeddings 데이터 백업 시작...');

  // Raw query로 데이터 조회 (vector 타입 포함)
  const data = await prisma.$queryRaw`
    SELECT id, content, metadata, embedding::text, created_at, updated_at
    FROM domain_knowledge_embeddings
  `;

  console.log(`✅ ${(data as any[]).length}개 레코드 조회됨`);

  // JSON 파일로 저장
  const backupPath = 'prisma/operation/embeddings-backup.json';
  fs.writeFileSync(backupPath, JSON.stringify(data, null, 2));
  console.log(`💾 백업 완료: ${backupPath}`);
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
