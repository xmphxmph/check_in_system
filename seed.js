// 种子数据:1 教师 + 10 学生 + 3 课程 + 覆盖全状态的任务/补签/请假(可重复执行)
const bcrypt = require('bcryptjs');
const db = require('./db');
const utils = require('./utils');

const now = new Date();
const min = (n) => new Date(now.getTime() + n * 60000);
const hour = (n) => new Date(now.getTime() + n * 3600000);
const day = (n) => new Date(now.getTime() + n * 86400000);

async function seed() {
  await db.init();
  const tables = ['appeals','leave_requests','signin_records','signin_tasks','enrollments','courses','users'];
  for (const t of tables) await db.q(`TRUNCATE TABLE ${t}`);

  const pwd = bcrypt.hashSync('123456', 10);
  // 用户:1 教师 + 10 学生
  await db.q('INSERT INTO users (account,name,role,password_hash) VALUES (?,?,?,?)', ['t001', '张老师', 'teacher', pwd]);
  for (let i = 1; i <= 10; i++) {
    await db.q('INSERT INTO users (account,name,role,password_hash) VALUES (?,?,?,?)', [`s00${i}`, `学生${i}号`, 'student', pwd]);
  }

  // 课程:1 高数 2 线代 3 数据结构
  const c1 = await db.q('INSERT INTO courses (name,teacher_id,invite_code) VALUES (?,?,?)', ['高等数学', 1, utils.genInviteCode()]);
  const c2 = await db.q('INSERT INTO courses (name,teacher_id,invite_code) VALUES (?,?,?)', ['线性代数', 1, utils.genInviteCode()]);
  const c3 = await db.q('INSERT INTO courses (name,teacher_id,invite_code) VALUES (?,?,?)', ['数据结构', 1, utils.genInviteCode()]);

  // 选课:课程1 全员,课程2 s001-s006,课程3 s007-s010
  for (let i = 2; i <= 11; i++) await db.q('INSERT INTO enrollments (course_id,student_id) VALUES (1,?)', [i]);
  for (let i = 2; i <= 7; i++) await db.q('INSERT INTO enrollments (course_id,student_id) VALUES (2,?)', [i]);
  for (let i = 8; i <= 11; i++) await db.q('INSERT INTO enrollments (course_id,student_id) VALUES (3,?)', [i]);

  // 任务:
  // T1 进行中·签到码(还有 2 小时截止)
  await db.q(`INSERT INTO signin_tasks (course_id,type,code,start_time,end_time,status) VALUES (1,'code','123456',?,?,'active')`, [min(-5), min(120)]);
  // T2 12 小时前结束·s001 缺勤(24h 补签窗口内)
  await db.q(`INSERT INTO signin_tasks (course_id,type,code,start_time,end_time,status,ended_at) VALUES (1,'code','222222',?,?,'ended',?)`, [min(-720), min(-710), min(-710)]);
  // T3 3 天前·s001 补签通过 / s002 请假
  await db.q(`INSERT INTO signin_tasks (course_id,type,code,start_time,end_time,status,ended_at) VALUES (1,'code','333333',?,?,'ended',?)`, [day(-3), min(-4320 + 10), min(-4320 + 10)]);
  // T4 30 小时前·s003 缺勤待审补签
  await db.q(`INSERT INTO signin_tasks (course_id,type,code,start_time,end_time,status,ended_at) VALUES (2,'code','444444',?,?,'ended',?)`, [min(-1800), min(-1770), min(-1770)]);
  // T5 进行中·定位签到(天安门,半径 300m,还有 2 小时截止)
  await db.q(`INSERT INTO signin_tasks (course_id,type,center_lat,center_lng,radius_m,start_time,end_time,status) VALUES (2,'location',39.908823,116.397470,300,?,?,'active')`, [min(-2), min(120)]);

  // 签到记录
  // T2:s002-s010 正常
  for (let i = 3; i <= 11; i++) await db.q('INSERT INTO signin_records (task_id,student_id,sign_time,status) VALUES (2,?,?,?)', [i, min(-715), 'normal']);
  // T3:s001 补签通过,s002 请假,其余正常
  await db.q('INSERT INTO signin_records (task_id,student_id,sign_time,status) VALUES (3,2,?,?)', [day(-3) && min(-4320 + 60), 'appeal_approved']);
  await db.q('INSERT INTO signin_records (task_id,student_id,sign_time,status) VALUES (3,3,NULL,?)', ['leave']);
  for (let i = 4; i <= 11; i++) await db.q('INSERT INTO signin_records (task_id,student_id,sign_time,status) VALUES (3,?,?,?)', [i, min(-4320 + 5), 'normal']);
  // T4:s001,s002,s004-s006 正常;s003 无记录
  for (const i of [2, 3, 5, 6, 7]) await db.q('INSERT INTO signin_records (task_id,student_id,sign_time,status) VALUES (4,?,?,?)', [i, min(-1795), 'normal']);
  await db.q('INSERT INTO signin_records (task_id,student_id,status) VALUES (4,4,?)', ['appeal_pending']);

  // 补签:T3 s001 已通过;T4 s003 待审
  await db.q('INSERT INTO appeals (task_id,student_id,reason,status,teacher_comment,created_at,reviewed_at) VALUES (3,2,?,?,?,?,?)', ['堵车迟到,望老师谅解', 'approved', '情况属实,予以通过', day(-3) && min(-4320 + 20), min(-4320 + 60)]);
  await db.q('INSERT INTO appeals (task_id,student_id,reason,status,created_at) VALUES (4,4,?,?,?)', ['当天发烧去医院,补交假条', 'pending', min(-1750)]);

  // 请假:LR1 s004 待审(覆盖 T1 进行中任务);LR2 s002 已通过(覆盖 T3)
  await db.q('INSERT INTO leave_requests (course_id,student_id,leave_type,start_time,end_time,reason,status,created_at) VALUES (1,5,?,?,?,?,?,?)', ['sick', min(-60), min(120), '感冒发烧,需就医', 'pending', min(-70)]);
  await db.q('INSERT INTO leave_requests (course_id,student_id,leave_type,start_time,end_time,reason,status,teacher_comment,created_at,reviewed_at) VALUES (1,3,?,?,?,?,?,?,?,?)', ['personal', day(-3), min(-4320 + 120), '家中有事', 'approved', '同意,注意安全', day(-4), day(-3) && min(-4320 + 60)]);

  console.log('种子数据完成');
  console.log('教师 t001 / 123456,学生 s001-s010 / 123456');
  console.log('课程1 邀请码:', (await db.q1('SELECT invite_code FROM courses WHERE id=1')).invite_code);
  process.exit(0);
}

seed().catch((e) => { console.error(e); process.exit(1); });
