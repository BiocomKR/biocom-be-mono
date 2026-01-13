import { PrismaClient } from '@prisma/client';

// 운영 DB (PostgreSQL)
const prodPrisma = new PrismaClient({
  datasources: {
    db: {
      url: 'postgresql://biocom:Biocom2024!@34.64.118.209:5432/biocom'
    }
  }
});

async function main() {
  const missions = await prodPrisma.mission.findMany({
    orderBy: { sortOrder: 'asc' }
  });

  console.log('운영 DB missions sortOrder:');
  missions.forEach(m => {
    console.log(`id: ${m.id}, sortOrder: ${m.sortOrder}, recordType: ${m.recordType}, name: ${m.name}`);
  });
}

main().finally(() => prodPrisma.$disconnect());
