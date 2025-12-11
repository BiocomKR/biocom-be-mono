export default () => ({
  port: parseInt(process.env.PORT || '4001', 10),
  nodeEnv: process.env.NODE_ENV || 'development',
  logLevel: process.env.LOG_LEVEL || 'debug',

  redis: {
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined,
  },

  bullBoard: {
    enabled: process.env.BULL_BOARD_ENABLED === 'true',
    path: process.env.BULL_BOARD_PATH || '/admin/queues',
  },
});
