import neo4j from 'neo4j-driver';

const NEO4J_URI = 'neo4j+s://27c48749.databases.neo4j.io';
const NEO4J_USERNAME = 'neo4j';
const NEO4J_PASSWORD = 'jqlf6TctHvZk2N4Rc8_Rj_8RUf614PVQz4VPr5F7KjE';

async function checkAllUsers() {
  const driver = neo4j.driver(
    NEO4J_URI,
    neo4j.auth.basic(NEO4J_USERNAME, NEO4J_PASSWORD)
  );

  const session = driver.session();

  try {
    console.log('🔍 모든 User 노드 확인...\n');

    const result = await session.run(`
      MATCH (u:User)
      RETURN u.chart_id AS chartId,
             u.name AS name,
             u.created_at AS createdAt
      ORDER BY u.created_at DESC
    `);

    console.log(`✅ 총 ${result.records.length}개의 User 노드\n`);

    result.records.forEach((record, index) => {
      const chartId = record.get('chartId');
      const name = record.get('name');
      const createdAt = record.get('createdAt');

      console.log(`${index + 1}. chart_id: ${chartId}`);
      console.log(`   name: ${name || 'N/A'}`);
      console.log(`   created: ${createdAt ? createdAt.toString() : 'N/A'}`);
      console.log('');
    });

    // 각 User의 Beauty 노드 개수 확인
    console.log('\n📊 각 User별 Beauty 노드 개수:\n');

    const beautyCount = await session.run(`
      MATCH (u:User)
      OPTIONAL MATCH (u)-[:HAS_DATE]->(d:Date)-[:HAS_BEAUTY]->(b:Beauty)
      RETURN u.chart_id AS chartId,
             count(b) AS beautyCount
      ORDER BY beautyCount DESC
    `);

    beautyCount.records.forEach(record => {
      const chartId = record.get('chartId');
      const count = record.get('beautyCount').toNumber();
      console.log(`  ${chartId}: ${count}개`);
    });

  } catch (error) {
    console.error('❌ 쿼리 실패:', error);
  } finally {
    await session.close();
    await driver.close();
  }
}

checkAllUsers();
