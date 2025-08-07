import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function addMissionTypeColumn() {
  try {
    console.log('missions 테이블에 type 컬럼 추가 중...');
    
    // Raw SQL로 컬럼 추가
    await prisma.$executeRaw`
      ALTER TABLE missions 
      ADD COLUMN IF NOT EXISTS type VARCHAR(20) DEFAULT 'DAILY';
    `;
    
    console.log('✅ type 컬럼이 성공적으로 추가되었습니다.');
    
    // 인덱스 추가
    await prisma.$executeRaw`
      CREATE INDEX IF NOT EXISTS "missions_type_is_active_idx" 
      ON missions(type, is_active);
    `;
    
    console.log('✅ 인덱스가 성공적으로 추가되었습니다.');
    
    // 현재 미션들 확인
    const missions = await prisma.mission.findMany({
      select: {
        id: true,
        name: true,
        type: true
      },
      take: 5
    });
    
    console.log('\n현재 미션 목록 (최대 5개):');
    missions.forEach(m => {
      console.log(`- ID: ${m.id}, 이름: ${m.name}, 타입: ${m.type || 'DAILY'}`);
    });
    
  } catch (error) {
    console.error('❌ 에러 발생:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

// 스크립트 실행
addMissionTypeColumn()
  .then(() => {
    console.log('\n✅ 마이그레이션 완료!');
    process.exit(0);
  })
  .catch((err) => {
    console.error('\n❌ 마이그레이션 실패:', err);
    process.exit(1);
  });