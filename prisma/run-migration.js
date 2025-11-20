const { PrismaClient } = require('@prisma/client');
const fs = require('fs');
const path = require('path');

const prisma = new PrismaClient();

async function runMigration() {
  const sqlFile = path.join(__dirname, 'migrations/manual_enhance_push_schedule.sql');
  const sql = fs.readFileSync(sqlFile, 'utf-8');

  console.log('🚀 Starting migration...\n');

  try {
    // SQL을 개별 명령으로 분리하여 실행
    const commands = sql
      .split(';')
      .map(cmd => cmd.trim())
      .filter(cmd => cmd.length > 0 && !cmd.startsWith('--'));

    for (let i = 0; i < commands.length; i++) {
      const command = commands[i];
      console.log(`Executing command ${i + 1}/${commands.length}...`);

      try {
        await prisma.$executeRawUnsafe(command);
        console.log(`✅ Success\n`);
      } catch (error) {
        // "already exists" 에러는 무시 (이미 컬럼/인덱스가 있는 경우)
        if (error.message.includes('already exists') || error.message.includes('duplicate')) {
          console.log(`⚠️  Already exists (skipped)\n`);
        } else {
          console.error(`❌ Error: ${error.message}\n`);
          throw error;
        }
      }
    }

    console.log('✅ Migration completed successfully!');
  } catch (error) {
    console.error('❌ Migration failed:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

runMigration();
