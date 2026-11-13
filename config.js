// 配置:全部从环境变量读取(node --env-file=.env server.js)
module.exports = {
  port: Number(process.env.PORT) || 3000,
  db: {
    host: process.env.DB_HOST || '127.0.0.1',
    user: process.env.DB_USER || 'root',
    password: process.env.DB_PASSWORD || '',
    database: process.env.DB_NAME || 'zaoba_signin',
    waitForConnections: true,
    connectionLimit: 10,
    charset: 'utf8mb4',
    timezone: '+08:00',
  },
  jwtSecret: process.env.JWT_SECRET || 'zaoba-dev-secret',
};
