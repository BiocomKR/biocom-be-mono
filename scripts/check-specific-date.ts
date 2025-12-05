import neo4j from 'neo4j-driver';

const NEO4J_URI = 'neo4j+s://27c48749.databases.neo4j.io';
const NEO4J_USERNAME = 'neo4j';
const NEO4J_PASSWORD = 'jqlf6TctHvZk2N4Rc8_Rj_8RUf614PVQz4VPr5F7KjE';

async function checkSpecificDate() {
  const driver = neo4j.driver(
    NEO4J_URI,
    neo4j.auth.basic(NEO4J_USERNAME, NEO4J_PASSWORD)
  );

  const session = driver.session();

  try {
    console.log('🔍 특정 dateId로 Beauty 노드 확인...\n');

    // 잘못된 dateId로 생성된 노드 확인
    const wrongResult = await session.run(`
      MATCH (d:Date {date_id: "date:2025-12-02"})-[:HAS_BEAUTY]->(b:Beauty)
      RETURN d.date_id AS dateId,
             d.date AS date,
             b.total_score AS totalScore,
             b.inner_beauty_score AS innerScore,
             b.outer_beauty_score AS outerScore
    `);

    console.log('❌ 잘못된 dateId (date:2025-12-02) 검색 결과:');
    if (wrongResult.records.length > 0) {
      wrongResult.records.forEach(record => {
        console.log(`  dateId: ${record.get('dateId')}`);
        console.log(`  date: ${record.get('date')}`);
        console.log(`  totalScore: ${record.get('totalScore')}`);
        console.log(`  innerScore: ${record.get('innerScore')}`);
        console.log(`  outerScore: ${record.get('outerScore')}`);
      });
    } else {
      console.log('  노드 없음\n');
    }

    // 올바른 dateId 형식 확인
    const correctResult = await session.run(`
      MATCH (d:Date {date_id: "TA11150002_2025-12-02"})-[:HAS_BEAUTY]->(b:Beauty)
      RETURN d.date_id AS dateId,
             d.date AS date,
             b.total_score AS totalScore,
             b.inner_beauty_score AS innerScore,
             b.outer_beauty_score AS outerScore
    `);

    console.log('\n✅ 올바른 dateId (TA11150002_2025-12-02) 검색 결과:');
    if (correctResult.records.length > 0) {
      correctResult.records.forEach(record => {
        console.log(`  dateId: ${record.get('dateId')}`);
        console.log(`  date: ${record.get('date')}`);
        console.log(`  totalScore: ${record.get('totalScore')}`);
        console.log(`  innerScore: ${record.get('innerScore')}`);
        console.log(`  outerScore: ${record.get('outerScore')}`);
      });
    } else {
      console.log('  노드 없음\n');
    }

    // TA11150002의 모든 Date 확인
    console.log('\n📅 TA11150002의 모든 Date 노드:');
    const allDates = await session.run(`
      MATCH (u:User {chart_id: "TA11150002"})-[:HAS_DATE]->(d:Date)
      OPTIONAL MATCH (d)-[:HAS_BEAUTY]->(b:Beauty)
      RETURN d.date_id AS dateId,
             d.date AS date,
             b.total_score AS totalScore
      ORDER BY d.date DESC
      LIMIT 5
    `);

    allDates.records.forEach(record => {
      console.log(`  ${record.get('dateId')} | score: ${record.get('totalScore')}`);
    });

  } catch (error) {
    console.error('❌ 쿼리 실패:', error);
  } finally {
    await session.close();
    await driver.close();
  }
}

checkSpecificDate();
