const { PrismaClient } = require('@prisma/client');

const prisma = new PrismaClient();

async function checkTables() {
  try {
    const result = await prisma.$queryRaw`
      SELECT table_name
      FROM information_schema.tables
      WHERE table_schema = 'public'
      AND table_name LIKE '%push%'
      ORDER BY table_name;
    `;

    console.log('📋 푸시 관련 테이블 목록:\n');
    result.forEach((row, index) => {
      console.log(`${index + 1}. ${row.table_name}`);
    });
  } catch (error) {
    console.error('❌ Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkTables();
