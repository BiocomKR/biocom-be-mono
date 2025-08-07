import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function checkApiKey() {
  try {
    // API Key 목록 조회
    const apiKeys = await prisma.apiKey.findMany();
    console.log('현재 API Key 목록:');
    console.log(apiKeys);

    // 테스트용 API Key가 없으면 생성
    if (apiKeys.length === 0) {
      const newKey = await prisma.apiKey.create({
        data: {
          name: '테스트 API Key',
          key: 'test-api-key-12345',
          description: '통합 테스트용 API Key',
          isActive: true,
        },
      });
      console.log('\n새 API Key 생성됨:');
      console.log(newKey);
    }
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await prisma.$disconnect();
  }
}

checkApiKey();