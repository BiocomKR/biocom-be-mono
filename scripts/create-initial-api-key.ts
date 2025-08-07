import { PrismaClient } from '@prisma/client';
import { randomUUID } from 'crypto';

/**
 * 초기 API Key 생성 스크립트
 * 백오피스 연동을 위한 첫 번째 API Key를 생성
 * 
 * 사용법: npx ts-node scripts/create-initial-api-key.ts
 */
async function createInitialApiKey() {
  const prisma = new PrismaClient();

  try {
    console.log('🔑 초기 API Key 생성 시작...\n');

    // 이미 API Key가 있는지 확인
    const existingKeys = await prisma.apiKey.count();
    if (existingKeys > 0) {
      console.log('⚠️  이미 API Key가 존재합니다.');
      console.log('   기존 API Key를 사용하거나 관리 API를 통해 새로운 Key를 생성하세요.\n');
      
      const keys = await prisma.apiKey.findMany({
        where: { isActive: true },
        select: {
          id: true,
          name: true,
          key: true,
          createdAt: true,
        },
      });

      console.log('📋 활성화된 API Key 목록:');
      keys.forEach(key => {
        console.log(`   - ID: ${key.id}, 이름: ${key.name}`);
        console.log(`     Key: ${key.key}`);
        console.log(`     생성일: ${key.createdAt.toLocaleString('ko-KR')}\n`);
      });
      
      return;
    }

    // 새로운 API Key 생성
    const apiKey = await prisma.apiKey.create({
      data: {
        key: randomUUID(),
        name: '초기 백오피스 연동 키',
        description: '백오피스 시스템과의 초기 연동을 위한 API Key',
        isActive: true,
      },
    });

    console.log('✅ API Key가 성공적으로 생성되었습니다!\n');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log('  API Key 정보');
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━');
    console.log(`  ID: ${apiKey.id}`);
    console.log(`  이름: ${apiKey.name}`);
    console.log(`  설명: ${apiKey.description}`);
    console.log(`  Key: ${apiKey.key}`);
    console.log('━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━\n');
    
    console.log('⚠️  중요: 이 Key 값을 안전한 곳에 보관하세요!');
    console.log('   이 Key는 다시 확인할 수 없습니다.\n');
    
    console.log('📌 사용 방법:');
    console.log('   HTTP 요청 시 헤더에 다음을 추가하세요:');
    console.log(`   X-API-KEY: ${apiKey.key}\n`);
    
    console.log('🔧 관리 방법:');
    console.log('   - API Key 목록 조회: GET /management/api-keys');
    console.log('   - API Key 비활성화: PUT /management/api-keys/{id}/deactivate');
    console.log('   - 새 API Key 생성: POST /management/api-keys\n');

  } catch (error) {
    console.error('❌ API Key 생성 중 오류가 발생했습니다:', error);
  } finally {
    await prisma.$disconnect();
  }
}

// 스크립트 실행
createInitialApiKey();