import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('🔨 Creating push_notification_logs table...');

  try {
    // 테이블 생성
    await prisma.$executeRawUnsafe(`
      CREATE TABLE IF NOT EXISTS public.push_notification_logs (
        id SERIAL PRIMARY KEY,
        campaign_id INTEGER,
        user_id INTEGER NOT NULL,
        push_token_id INTEGER,
        title VARCHAR(255) NOT NULL,
        body TEXT NOT NULL,
        image_url VARCHAR(500),
        data JSONB,
        type VARCHAR(50) NOT NULL,
        success BOOLEAN NOT NULL DEFAULT true,
        message_id VARCHAR(255),
        error_code VARCHAR(100),
        error_message TEXT,
        sent_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
        read_at TIMESTAMP(3),
        clicked_at TIMESTAMP(3),
        created_at TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

        CONSTRAINT fk_user FOREIGN KEY (user_id) REFERENCES public.users(id) ON DELETE CASCADE,
        CONSTRAINT fk_push_token FOREIGN KEY (push_token_id) REFERENCES public.push_tokens(id) ON DELETE SET NULL
      );
    `);
    console.log('✅ Table created successfully');

    // 인덱스 생성
    console.log('🔨 Creating indexes...');

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_push_logs_user_id ON public.push_notification_logs(user_id);
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_push_logs_sent_at ON public.push_notification_logs(sent_at DESC);
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_push_logs_type ON public.push_notification_logs(type);
    `);

    await prisma.$executeRawUnsafe(`
      CREATE INDEX IF NOT EXISTS idx_push_logs_success ON public.push_notification_logs(success);
    `);

    console.log('✅ Indexes created successfully');
    console.log('🎉 Migration completed!');
  } catch (error) {
    console.error('❌ Error:', error);
    process.exit(1);
  } finally {
    await prisma.$disconnect();
  }
}

main();
