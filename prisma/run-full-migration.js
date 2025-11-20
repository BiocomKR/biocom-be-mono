const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function runMigration() {
  const sqlFile = path.join(__dirname, 'migrations/create_push_schedule_tables.sql');
  const sql = fs.readFileSync(sqlFile, 'utf-8');

  console.log('🚀 Creating push schedule and campaign tables...\n');

  try {
    // 전체 SQL을 한 번에 실행
    await prisma.$executeRawUnsafe(sql);
    console.log('✅ All tables and indexes created successfully!');
  } catch (error) {
    if (error.message.includes('already exists')) {
      console.log('⚠️  Tables already exist (skipped)');
    } else {
      console.error('❌ Migration failed:', error.message);
      process.exit(1);
    }
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
