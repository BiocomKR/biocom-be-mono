import { PrismaClient } from '@prisma/client';
const prisma = new PrismaClient();
async function main() {
  const data = await prisma.$queryRaw`
    SELECT 
      hta.health_type,
      hta.animal_name,
      htap.type,
      htap.priority,
      htap.keyword,
      p.name as product_name
    FROM health_type_animal_products htap
    JOIN health_type_animals hta ON htap.health_type_animal_id = hta.id
    JOIN products p ON htap.product_id = p.id
    WHERE htap.type = 'SUPPLEMENT'
    ORDER BY hta.health_type, htap.priority
  `;
  console.log(JSON.stringify(data, null, 2));
}
main().finally(() => prisma.$disconnect());
