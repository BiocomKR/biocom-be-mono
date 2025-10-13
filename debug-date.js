const { PrismaClient } = require('@prisma/client');

async function debugDate() {
  const prisma = new PrismaClient();
  
  try {
    const date = "2025-09-14";
    const parsedDate = new Date(date);
    
    console.log('입력 날짜:', date);
    console.log('new Date(date):', parsedDate);
    console.log('ISO String:', parsedDate.toISOString());
    
    // 실제 중복 체크 쿼리와 동일하게 실행
    const existingRecord = await prisma.userRecord.findFirst({
      where: {
        userId: 2,
        recordCode: 'BEAUTY',
        date: parsedDate,
      },
    });
    
    console.log('중복 체크 결과:', existingRecord ? '존재함' : '없음');
    
    if (existingRecord) {
      console.log('찾은 기록:', {
        id: existingRecord.id,
        date: existingRecord.date.toISOString(),
        recordCode: existingRecord.recordCode
      });
    }
    
  } catch (error) {
    console.error('에러:', error);
  } finally {
    await prisma.$disconnect();
  }
}

debugDate();