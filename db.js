// 数据库:连接池 + 建库建表
const mysql = require('mysql2/promise');
const config = require('./config');

let pool = null;

// 先不带库名连接,建库
async function init() {
  const conn = await mysql.createConnection({
    host: config.db.host,
    user: config.db.user,
    password: config.db.password,
  });
  await conn.query(
    `CREATE DATABASE IF NOT EXISTS \`${config.db.database}\` DEFAULT CHARACTER SET utf8mb4`
  );
  await conn.end();

  pool = mysql.createPool(config.db);
  await createTables();
  await upgradeRoleEnum();
  console.log('数据库就绪:', config.db.database);
}

// 老库升级:users.role 枚举补上 admin(幂等,只有缺了才 ALTER)
async function upgradeRoleEnum() {
  const [rows] = await pool.query(
    `SELECT COLUMN_TYPE ct FROM INFORMATION_SCHEMA.COLUMNS
     WHERE TABLE_SCHEMA=? AND TABLE_NAME='users' AND COLUMN_NAME='role'`,
    [config.db.database]
  );
  const type = rows[0]?.ct || '';
  if (type && !type.includes("'admin'")) {
    await pool.query("ALTER TABLE users MODIFY COLUMN role ENUM('student','teacher','admin') NOT NULL");
    console.log('已升级 users.role:新增 admin 角色');
  }
}

async function createTables() {
  const tables = [
    `CREATE TABLE IF NOT EXISTS users (
      id INT AUTO_INCREMENT PRIMARY KEY,
      account VARCHAR(50) NOT NULL UNIQUE,
      name VARCHAR(50) NOT NULL,
      role ENUM('student','teacher','admin') NOT NULL,
      password_hash VARCHAR(100) NOT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS courses (
      id INT AUTO_INCREMENT PRIMARY KEY,
      name VARCHAR(100) NOT NULL,
      teacher_id INT NOT NULL,
      invite_code VARCHAR(10) NOT NULL UNIQUE,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS enrollments (
      id INT AUTO_INCREMENT PRIMARY KEY,
      course_id INT NOT NULL,
      student_id INT NOT NULL,
      joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      UNIQUE KEY uniq_cs (course_id, student_id)
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS signin_tasks (
      id INT AUTO_INCREMENT PRIMARY KEY,
      course_id INT NOT NULL,
      type ENUM('code','location') NOT NULL,
      code VARCHAR(6) NULL,
      center_lat DECIMAL(10,7) NULL,
      center_lng DECIMAL(10,7) NULL,
      radius_m INT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      status ENUM('active','ended') DEFAULT 'active',
      ended_at DATETIME NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      KEY idx_course_status (course_id, status)
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS signin_records (
      id INT AUTO_INCREMENT PRIMARY KEY,
      task_id INT NOT NULL,
      student_id INT NOT NULL,
      sign_time DATETIME NULL,
      status ENUM('normal','appeal_pending','appeal_approved','appeal_rejected','leave') NOT NULL,
      lat DECIMAL(10,7) NULL,
      lng DECIMAL(10,7) NULL,
      UNIQUE KEY uniq_ts (task_id, student_id)
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS appeals (
      id INT AUTO_INCREMENT PRIMARY KEY,
      task_id INT NOT NULL,
      student_id INT NOT NULL,
      reason TEXT,
      status ENUM('pending','approved','rejected') DEFAULT 'pending',
      teacher_comment TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      reviewed_at DATETIME NULL,
      UNIQUE KEY uniq_task_student (task_id, student_id)
    ) ENGINE=InnoDB`,
    `CREATE TABLE IF NOT EXISTS leave_requests (
      id INT AUTO_INCREMENT PRIMARY KEY,
      course_id INT NOT NULL,
      student_id INT NOT NULL,
      leave_type ENUM('sick','personal','other') NOT NULL,
      start_time DATETIME NOT NULL,
      end_time DATETIME NOT NULL,
      reason TEXT,
      status ENUM('pending','approved','rejected') DEFAULT 'pending',
      teacher_comment TEXT NULL,
      created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
      reviewed_at DATETIME NULL
    ) ENGINE=InnoDB`,
  ];
  for (const sql of tables) await pool.query(sql);
}

// 查询辅助:返回数组
async function q(sql, params = []) {
  const [rows] = await pool.query(sql, params);
  return rows;
}

// 查询辅助:返回单行
async function q1(sql, params = []) {
  const rows = await q(sql, params);
  return rows[0] || null;
}

module.exports = { init, q, q1, get pool() { return pool; } };
