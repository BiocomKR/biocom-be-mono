import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

async function main() {
  console.log('📦 domain_knowledge_embeddings 데이터 복원 시작...');

  // CSV 파일 읽기
  const csvPath = '/tmp/embeddings_full.csv';
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n');

  // 헤더 제거
  const header = lines[0];
  const dataLines = lines.slice(1).filter(line => line.trim());

  console.log(`📊 총 ${dataLines.length}개 레코드 복원 예정`);

  for (let i = 0; i < dataLines.length; i++) {
    const line = dataLines[i];

    // CSV 파싱 (복잡한 경우 csv-parser 라이브러리 사용 권장)
    // 간단히 첫 번째 콤마로 분리
    const match = line.match(/^(\d+),"(.*)","(.*)","(\[.*\])","(.*)","(.*)"$/s);

    if (!match) {
      console.log(`⚠️ 파싱 실패: 라인 ${i + 1}`);
      continue;
    }

    const [, id, content, metadata, embedding, createdAt, updatedAt] = match;

    try {
      await prisma.$executeRawUnsafe(`
        INSERT INTO domain_knowledge_embeddings (id, content, metadata, embedding, created_at, updated_at)
        VALUES ($1, $2, $3::jsonb, $4::vector, $5::timestamp, $6::timestamp)
        ON CONFLICT (id) DO UPDATE SET
          content = EXCLUDED.content,
          metadata = EXCLUDED.metadata,
          embedding = EXCLUDED.embedding,
          updated_at = EXCLUDED.updated_at
      `, parseInt(id), content, metadata || null, embedding, createdAt || null, updatedAt || null);

      console.log(`✅ ${i + 1}/${dataLines.length} 복원 완료 (id: ${id})`);
    } catch (error) {
      console.error(`❌ 복원 실패 (id: ${id}):`, error.message);
    }
  }

  // 시퀀스 재설정
  await prisma.$executeRaw`SELECT setval('domain_knowledge_embeddings_id_seq', (SELECT MAX(id) FROM domain_knowledge_embeddings))`;

  console.log('🎉 복원 완료!');
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
