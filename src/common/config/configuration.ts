/**
 * 애플리케이션 전역 설정
 *
 * @description
 * - 환경변수를 구조화된 객체로 변환
 * - ConfigModule에서 로드하여 전역에서 사용 가능
 *
 * @author Claude Code
 * @date 2025-12-01
 */
export default () => ({
  /**
   * Redis 설정 (BullMQ - GraphDB 동기화용)
   */
  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  /**
   * 애플리케이션 설정
   */
  app: {
    port: parseInt(process.env.PORT || '10804', 10),
    nodeEnv: process.env.NODE_ENV || 'dev',
  },

  /**
   * 데이터베이스 설정
   */
  database: {
    url: process.env.DATABASE_URL,
  },
});
