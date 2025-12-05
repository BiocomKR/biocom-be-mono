import neo4j from 'neo4j-driver';

const NEO4J_URI = 'neo4j+s://27c48749.databases.neo4j.io';
const NEO4J_USERNAME = 'neo4j';
const NEO4J_PASSWORD = 'jqlf6TctHvZk2N4Rc8_Rj_8RUf614PVQz4VPr5F7KjE';

async function checkLatestBeauty() {
  const driver = neo4j.driver(
    NEO4J_URI,
    neo4j.auth.basic(NEO4J_USERNAME, NEO4J_PASSWORD)
  );

  const session = driver.session();

  try {
    console.log('🔍 최신 Beauty 데이터 확인...\n');

    // 모든 Beauty 노드 확인 (최근 10개)
    const result = await session.run(`
      MATCH (u:User)-[:HAS_DATE]->(d:Date)-[:HAS_BEAUTY]->(b:Beauty)
      RETURN u.chart_id AS chartId,
             d.date_id AS dateId,
             d.date AS date,
             b.total_score AS totalScore,
             b.inner_beauty_score AS innerBeautyScore,
             b.outer_beauty_score AS outerBeautyScore,
             b.created_at AS createdAt,
             b.updated_at AS updatedAt
      ORDER BY b.updated_at DESC
      LIMIT 10
    `);

    console.log(`✅ 총 ${result.records.length}개의 Beauty 노드 발견\n`);

    result.records.forEach((record, index) => {
      const chartId = record.get('chartId');
      const dateId = record.get('dateId');
      const date = record.get('date');
      const totalScore = record.get('totalScore');
      const innerScore = record.get('innerBeautyScore');
      const outerScore = record.get('outerBeautyScore');
      const updatedAt = record.get('updatedAt');

      console.log(`${index + 1}. ${dateId}`);
      console.log(`   chartId: ${chartId}`);
      console.log(`   date: ${date ? date.toString() : 'N/A'}`);
      console.log(`   totalScore: ${totalScore}`);
      console.log(`   innerBeautyScore: ${innerScore}`);
      console.log(`   outerBeautyScore: ${outerScore}`);
      console.log(`   updatedAt: ${updatedAt ? updatedAt.toString() : 'N/A'}`);
      console.log('');
    });

  } catch (error) {
    console.error('❌ 쿼리 실패:', error);
  } finally {
    await session.close();
    await driver.close();
  }
}

checkLatestBeauty();
