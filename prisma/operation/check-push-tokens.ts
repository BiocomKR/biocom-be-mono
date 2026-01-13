import { PrismaClient } from '@prisma/client';

// 프로덕션 DB 연결 (Cloud SQL Proxy: 127.0.0.1:5432)
const prisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://biocom:qkdldhzjaProdelql0519@34.64.51.209:5432/biocom',
    },
  },
});

async function main() {
  // push_tokens 테이블의 marketing_enabled, night_push_enabled 값 조회
  const result = await prisma.$queryRaw`
    SELECT
      user_id,
      marketing_enabled,
      night_push_enabled,
      is_active
    FROM push_tokens
    WHERE marketing_enabled IS NOT NULL
       OR night_push_enabled IS NOT NULL
    ORDER BY user_id
    LIMIT 20
  `;

  console.log('=== push_tokens 테이블 데이터 (상위 20개) ===');
  console.log(JSON.stringify(result, null, 2));

  // 통계
  const stats = await prisma.$queryRaw`
    SELECT
      COUNT(*) as total,
      COUNT(marketing_enabled) as marketing_count,
      COUNT(night_push_enabled) as night_push_count,
      SUM(CASE WHEN marketing_enabled = true THEN 1 ELSE 0 END) as marketing_true,
      SUM(CASE WHEN night_push_enabled = true THEN 1 ELSE 0 END) as night_push_true
    FROM push_tokens
  `;

  console.log('\n=== 통계 ===');
  console.log(JSON.stringify(stats, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
