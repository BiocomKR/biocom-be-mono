import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function initApiKey() {
  try {
    // 기존 API 키 확인
    const existingKey = await prisma.apiKey.findFirst({
      where: { key: 'test-api-key-123' }
    });

    if (!existingKey) {
      // 새 API 키 생성
      const newKey = await prisma.apiKey.create({
        data: {
          key: 'test-api-key-123',
          name: '테스트 API Key',
          description: '개발 테스트용 API Key',
          isActive: true,
        }
      });
      console.log('API 키가 생성되었습니다:', newKey.key);
    } else {
      console.log('API 키가 이미 존재합니다:', existingKey.key);
      console.log('활성화 상태:', existingKey.isActive);
    }
  } catch (error) {
    console.error('API 키 초기화 실패:', error);
  } finally {
    await prisma.$disconnect();
  }
}

initApiKey();