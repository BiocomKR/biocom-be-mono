import neo4j from 'neo4j-driver';

const NEO4J_URI = 'neo4j+s://27c48749.databases.neo4j.io';
const NEO4J_USERNAME = 'neo4j';
const NEO4J_PASSWORD = 'jqlf6TctHvZk2N4Rc8_Rj_8RUf614PVQz4VPr5F7KjE';

async function checkData() {
  const driver = neo4j.driver(
    NEO4J_URI,
    neo4j.auth.basic(NEO4J_USERNAME, NEO4J_PASSWORD)
  );

  const session = driver.session();

  try {
    console.log('🔍 Neo4j 데이터 확인 시작...\n');

    // 1. User 노드 확인
    console.log('1️⃣ User 노드 확인:');
    const userResult = await session.run(
      'MATCH (u:User {chart_id: $chartId}) RETURN u',
      { chartId: 'TA11150002' }
    );
    if (userResult.records.length > 0) {
      console.log('✅ User 노드 존재');
      console.log(JSON.stringify(userResult.records[0].get('u').properties, null, 2));
    } else {
      console.log('❌ User 노드 없음');
    }
    console.log('');

    // 2. Date 노드 확인
    console.log('2️⃣ Date 노드 확인:');
    const dateResult = await session.run(
      'MATCH (u:User {chart_id: $chartId})-[:HAS_DATE]->(d:Date) RETURN d ORDER BY d.date DESC LIMIT 5',
      { chartId: 'TA11150002' }
    );
    console.log(`✅ Date 노드 개수: ${dateResult.records.length}개`);
    dateResult.records.forEach(record => {
      const date = record.get('d').properties;
      console.log(`  - ${date.date_id} (${date.date})`);
    });
    console.log('');

    // 3. Beauty 노드 확인
    console.log('3️⃣ Beauty 노드 확인:');
    const beautyResult = await session.run(
      'MATCH (u:User {chart_id: $chartId})-[:HAS_DATE]->(d:Date)-[:HAS_BEAUTY]->(b:Beauty) RETURN d.date AS date, b ORDER BY d.date DESC LIMIT 3',
      { chartId: 'TA11150002' }
    );
    console.log(`✅ Beauty 노드 개수: ${beautyResult.records.length}개`);
    beautyResult.records.forEach(record => {
      const date = record.get('date');
      const beauty = record.get('b').properties;
      console.log(`  - ${date}: totalScore=${beauty.total_score}, inner=${beauty.inner_beauty_score}, outer=${beauty.outer_beauty_score}`);
    });
    console.log('');

    // 4. Food 노드 확인
    console.log('4️⃣ Food 노드 확인:');
    const foodResult = await session.run(
      'MATCH (u:User {chart_id: $chartId})-[:HAS_DATE]->(d:Date)-[:ATE_FOOD]->(f:Food) RETURN d.date AS date, f ORDER BY d.date DESC LIMIT 5',
      { chartId: 'TA11150002' }
    );
    console.log(`✅ Food 노드 개수: ${foodResult.records.length}개`);
    foodResult.records.forEach(record => {
      const date = record.get('date');
      const food = record.get('f').properties;
      console.log(`  - ${date}: ${food.food_name} (${food.diet_type})`);
    });
    console.log('');

    // 5. Fasting 노드 확인
    console.log('5️⃣ Fasting 노드 확인:');
    const fastingResult = await session.run(
      'MATCH (u:User {chart_id: $chartId})-[:HAS_DATE]->(d:Date)-[:HAS_FASTING]->(f:Fasting) RETURN d.date AS date, f ORDER BY d.date DESC LIMIT 3',
      { chartId: 'TA11150002' }
    );
    console.log(`✅ Fasting 노드 개수: ${fastingResult.records.length}개`);
    fastingResult.records.forEach(record => {
      const date = record.get('date');
      const fasting = record.get('f').properties;
      console.log(`  - ${date}: ${fasting.fasting_hours}시간 (${fasting.start_datetime} ~ ${fasting.end_datetime})`);
    });
    console.log('');

    // 6. Sleep 노드 확인
    console.log('6️⃣ Sleep 노드 확인:');
    const sleepResult = await session.run(
      'MATCH (u:User {chart_id: $chartId})-[:HAS_DATE]->(d:Date)-[:HAS_SLEEP]->(s:Sleep) RETURN d.date AS date, s ORDER BY d.date DESC LIMIT 3',
      { chartId: 'TA11150002' }
    );
    console.log(`✅ Sleep 노드 개수: ${sleepResult.records.length}개`);
    sleepResult.records.forEach(record => {
      const date = record.get('date');
      const sleep = record.get('s').properties;
      console.log(`  - ${date}: ${sleep.sleep_hours}시간 (${sleep.bed_datetime} ~ ${sleep.wake_datetime})`);
    });
    console.log('');

    // 7. Activity 노드 확인
    console.log('7️⃣ Activity 노드 확인:');
    const activityResult = await session.run(
      'MATCH (u:User {chart_id: $chartId})-[:HAS_DATE]->(d:Date)-[:HAS_ACTIVITY]->(da:DailyActivity)-[:INCLUDES]->(a:Activity) RETURN d.date AS date, a ORDER BY d.date DESC LIMIT 5',
      { chartId: 'TA11150002' }
    );
    console.log(`✅ Activity 노드 개수: ${activityResult.records.length}개`);
    activityResult.records.forEach(record => {
      const date = record.get('date');
      const activity = record.get('a').properties;
      console.log(`  - ${date}: ${activity.name} (${activity.duration_minutes}분, ${activity.calories_burned}kcal)`);
    });
    console.log('');

    console.log('✅ Neo4j 데이터 확인 완료!');

  } catch (error) {
    console.error('❌ Neo4j 쿼리 실패:', error);
  } finally {
    await session.close();
    await driver.close();
  }
}

checkData();
