import { PrismaClient } from '@prisma/client';
import * as fs from 'fs';
import * as path from 'path';

const prisma = new PrismaClient();

function normalize(name: string): string {
  return name.replace(/[\s&·\-_()[\]]/g, '').toLowerCase();
}

async function main() {
  // CSV 파일 읽기
  const csvPath = path.join(__dirname, '../../../맞춤솔루션문서/상품_활성화_상품.csv');
  const csvContent = fs.readFileSync(csvPath, 'utf-8');
  const lines = csvContent.split('\n').slice(1); // 헤더 제외

  const csvProducts: { name: string; normalized: string }[] = [];
  for (const line of lines) {
    if (!line.trim()) continue;
    const match = line.match(/^(\d+),([^,]+)/);
    if (match) {
      const name = match[2].trim();
      csvProducts.push({ name, normalized: normalize(name) });
    }
  }

  // DB 상품 조회
  const dbProducts = await prisma.product.findMany({
    where: { status: 'ACTIVE' },
    select: { id: true, name: true },
    orderBy: { id: 'asc' }
  });

  const dbMap = new Map<string, typeof dbProducts>();
  for (const p of dbProducts) {
    const key = normalize(p.name);
    if (!dbMap.has(key)) dbMap.set(key, []);
    dbMap.get(key)!.push(p);
  }

  console.log('=== CSV vs DB 상품명 비교 ===\n');
  console.log(`CSV 상품 수: ${csvProducts.length}`);
  console.log(`DB 활성 상품 수: ${dbProducts.length}\n`);

  // CSV에 있는데 DB에 없는 상품
  console.log('=== CSV에 있는데 DB에 없는 상품 ===');
  let notInDb = 0;
  for (const csv of csvProducts) {
    if (!dbMap.has(csv.normalized)) {
      notInDb++;
      console.log(`  "${csv.name}"`);
    }
  }
  if (notInDb === 0) console.log('  없음');
  console.log(`총 ${notInDb}개\n`);

  // CSV와 DB에서 이름이 다른 상품 (정규화하면 같은데 원본이 다른 경우)
  console.log('=== 이름 형식이 다른 상품 (동일 상품으로 추정) ===');
  let diffFormat = 0;
  for (const csv of csvProducts) {
    const dbItems = dbMap.get(csv.normalized);
    if (dbItems) {
      for (const db of dbItems) {
        if (db.name !== csv.name) {
          diffFormat++;
          console.log(`  CSV: "${csv.name}"`);
          console.log(`  DB:  ID ${db.id} "${db.name}"`);
          console.log('');
        }
      }
    }
  }
  if (diffFormat === 0) console.log('  없음');
  console.log(`총 ${diffFormat}개\n`);

  await prisma.$disconnect();
}

main();
