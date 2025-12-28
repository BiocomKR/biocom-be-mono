import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();

async function main() {
  const logs = await prisma.userRecord.findMany({
    where: {
      userId: { in: [48, 50] },
      createdAt: { gte: new Date('2025-12-24'), lte: new Date('2025-12-26') }
    },
    orderBy: { id: 'desc' },
    take: 20,
    select: { id: true, userId: true, recordType: true, createdAt: true, updatedAt: true }
  });

  console.log('user_records (userId 48, 50):');
  for (const log of logs) {
    const created = log.createdAt.toISOString();
    const updated = log.updatedAt ? log.updatedAt.toISOString() : 'null';
    const isWeird = log.updatedAt && log.createdAt > log.updatedAt;
    console.log(`id: ${log.id}, userId: ${log.userId}, type: ${log.recordType}`);
    console.log(`  createdAt: ${created}`);
    console.log(`  updatedAt: ${updated}`);
    if (isWeird) console.log(`  ⚠️ createdAt > updatedAt (이상함)`);
    console.log('');
  }
}
main().finally(() => prisma.$disconnect());
