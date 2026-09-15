// 早八签到 · Express 后端(单服务:API + 静态页面)
const express = require('express');
const path = require('path');
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const db = require('./db');
const config = require('./config');
const utils = require('./utils');
const { auth, requireRole } = require('./auth');

const app = express();
app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const err = (res, status, message) => res.status(status).json({ code: status, message });
const signJwt = (u) => jwt.sign({ id: u.id, name: u.name, role: u.role, account: u.account }, config.jwtSecret, { expiresIn: '7d' });

// 惰性结束:到期任务顺手落库
async function ensureEnded(task) {
  if (task.status === 'active' && new Date() > task.end_time) {
    await db.q("UPDATE signin_tasks SET status='ended', ended_at=? WHERE id=? AND status='active'", [new Date(), task.id]);
    task.status = 'ended';
    task.ended_at = new Date();
  }
  return task;
}

// 覆盖某任务的请假(pending/approved,approved 优先)
async function coveringLeave(studentId, task) {
  return db.q1(
    `SELECT * FROM leave_requests WHERE student_id=? AND course_id=? AND status IN ('pending','approved')
     AND ? BETWEEN start_time AND end_time ORDER BY FIELD(status,'approved','pending') LIMIT 1`,
    [studentId, task.course_id, task.start_time]
  );
}

// 学生视角的任务状态
async function myTaskStatus(task, studentId) {
  const rec = await db.q1('SELECT * FROM signin_records WHERE task_id=? AND student_id=?', [task.id, studentId]);
  if (rec) return { status: rec.status, sign_time: rec.sign_time };
  const lr = await coveringLeave(studentId, task);
  if (lr && lr.status === 'approved') return { status: 'leave' };
  if (lr && lr.status === 'pending') return { status: 'leave_pending' };
  if (task.status === 'active') return { status: 'unsigned' };
  const endedAt = task.ended_at || task.end_time;
  const canAppeal = new Date() - endedAt < 24 * 3600000;
  return { status: canAppeal ? 'absent_can_appeal' : 'absent' };
}

// ============ 鉴权 ============
app.post('/api/auth/register', async (req, res) => {
  const { account, name, password, role } = req.body || {};
  if (!account || !name || !password || password.length < 6) return err(res, 400, '账号、姓名必填,密码至少 6 位');
  if (!['student', 'teacher'].includes(role)) return err(res, 400, '角色不合法');
  const exist = await db.q1('SELECT id FROM users WHERE account=?', [account]);
  if (exist) return err(res, 400, '账号已存在');
  const hash = bcrypt.hashSync(password, 10);
  await db.q('INSERT INTO users (account,name,role,password_hash) VALUES (?,?,?,?)', [account, name, role, hash]);
  res.json({ ok: true });
});

app.post('/api/auth/login', async (req, res) => {
  const { account, password } = req.body || {};
  const u = await db.q1('SELECT * FROM users WHERE account=?', [account]);
  if (!u || !bcrypt.compareSync(password || '', u.password_hash)) return err(res, 401, '账号或密码错误');
  res.json({ token: signJwt(u), user: { id: u.id, account: u.account, name: u.name, role: u.role } });
});

app.get('/api/auth/me', auth, (req, res) => res.json({ user: req.user }));

// ============ 课程 ============
app.get('/api/courses', auth, async (req, res) => {
  if (req.user.role === 'teacher') {
    const courses = await db.q(
      `SELECT c.*, (SELECT COUNT(*) FROM enrollments e WHERE e.course_id=c.id) student_count
       FROM courses c WHERE c.teacher_id=? ORDER BY c.id`, [req.user.id]);
    return res.json({ courses });
  }
  const courses = await db.q(
    `SELECT c.*, t.name teacher_name FROM enrollments e
     JOIN courses c ON c.id=e.course_id JOIN users t ON t.id=c.teacher_id
     WHERE e.student_id=? ORDER BY e.joined_at`, [req.user.id]);
  res.json({ courses });
});

app.post('/api/courses', auth, requireRole('teacher'), async (req, res) => {
  const name = (req.body?.name || '').trim();
  if (!name) return err(res, 400, '课程名必填');
  let code;
  do { code = utils.genInviteCode(); } while (await db.q1('SELECT id FROM courses WHERE invite_code=?', [code]));
  await db.q('INSERT INTO courses (name,teacher_id,invite_code) VALUES (?,?,?)', [name, req.user.id, code]);
  res.json({ ok: true, invite_code: code });
});

app.post('/api/courses/join', auth, requireRole('student'), async (req, res) => {
  const code = (req.body?.invite_code || '').trim().toUpperCase();
  const course = await db.q1('SELECT * FROM courses WHERE invite_code=?', [code]);
  if (!course) return err(res, 404, '邀请码无效');
  const exist = await db.q1('SELECT id FROM enrollments WHERE course_id=? AND student_id=?', [course.id, req.user.id]);
  if (exist) return err(res, 400, '已加入该课程');
  await db.q('INSERT INTO enrollments (course_id,student_id) VALUES (?,?)', [course.id, req.user.id]);
  res.json({ ok: true, course_name: course.name });
});

app.post('/api/courses/:id/regenerate-code', auth, requireRole('teacher'), async (req, res) => {
  const course = await db.q1('SELECT * FROM courses WHERE id=? AND teacher_id=?', [req.params.id, req.user.id]);
  if (!course) return err(res, 404, '课程不存在');
  let code;
  do { code = utils.genInviteCode(); } while (await db.q1('SELECT id FROM courses WHERE invite_code=?', [code]));
  await db.q('UPDATE courses SET invite_code=? WHERE id=?', [code, course.id]);
  res.json({ ok: true, invite_code: code });
});

app.get('/api/courses/:id', auth, async (req, res) => {
  const course = await db.q1(`SELECT c.*, t.name teacher_name FROM courses c JOIN users t ON t.id=c.teacher_id WHERE c.id=?`, [req.params.id]);
  if (!course) return err(res, 404, '课程不存在');
  if (req.user.role === 'teacher' && course.teacher_id !== req.user.id) return err(res, 403, '无权限');
  if (req.user.role === 'student') {
    const enr = await db.q1('SELECT id FROM enrollments WHERE course_id=? AND student_id=?', [course.id, req.user.id]);
    if (!enr) return err(res, 403, '未加入该课程');
  }
  const tasks = await db.q('SELECT * FROM signin_tasks WHERE course_id=? ORDER BY start_time DESC', [course.id]);
  for (const t of tasks) await ensureEnded(t);
  res.json({ course, tasks: tasks.map((t) => ({ id: t.id, type: t.type, start_time: t.start_time, end_time: t.end_time, status: t.status, ended_at: t.ended_at })) });
});

// ============ 签到任务 ============
app.post('/api/signin-tasks', auth, requireRole('teacher'), async (req, res) => {
  const b = req.body || {};
  const course = await db.q1('SELECT * FROM courses WHERE id=? AND teacher_id=?', [b.course_id, req.user.id]);
  if (!course) return err(res, 404, '课程不存在');
  const active = await db.q1("SELECT id FROM signin_tasks WHERE course_id=? AND status='active'", [course.id]);
  if (active) return err(res, 400, '该课程已有进行中的签到');
  const endTime = new Date(b.end_time);
  if (!b.end_time || isNaN(endTime) || endTime <= new Date()) return err(res, 400, '截止时间不合法');

  if (b.type === 'code') {
    await db.q('INSERT INTO signin_tasks (course_id,type,code,start_time,end_time,status) VALUES (?,?,?,?,?,\'active\')',
      [course.id, 'code', utils.genSignCode(), new Date(), endTime]);
    const task = await db.q1('SELECT * FROM signin_tasks WHERE course_id=? ORDER BY id DESC LIMIT 1', [course.id]);
    return res.json({ ok: true, task_id: task.id, code: task.code });
  }
  if (b.type === 'location') {
    const lat = Number(b.center_lat), lng = Number(b.center_lng), radius = Number(b.radius_m);
    if (!lat || !lng || !radius) return err(res, 400, '缺少坐标或半径');
    await db.q('INSERT INTO signin_tasks (course_id,type,center_lat,center_lng,radius_m,start_time,end_time,status) VALUES (?,?,?,?,?,?,?,\'active\')',
      [course.id, 'location', lat, lng, radius, new Date(), endTime]);
    const task = await db.q1('SELECT * FROM signin_tasks WHERE course_id=? ORDER BY id DESC LIMIT 1', [course.id]);
    return res.json({ ok: true, task_id: task.id });
  }
  return err(res, 400, '签到方式不合法');
});

// 学生:进行中任务(我的课程)
app.get('/api/signin-tasks/active', auth, requireRole('student'), async (req, res) => {
  const tasks = await db.q(
    `SELECT t.*, c.name course_name, c.teacher_id, (SELECT name FROM users WHERE id=c.teacher_id) teacher_name
     FROM signin_tasks t JOIN courses c ON c.id=t.course_id
     JOIN enrollments e ON e.course_id=t.course_id AND e.student_id=?
     WHERE t.status='active'`, [req.user.id]);
  const result = [];
  for (const t of tasks) {
    await ensureEnded(t);
    if (t.status !== 'active') continue;
    const my = await myTaskStatus(t, req.user.id);
    result.push({
      id: t.id, course_name: t.course_name, teacher_name: t.teacher_name,
      type: t.type, end_time: t.end_time, my_status: my.status, sign_time: my.sign_time,
    });
  }
  res.json({ tasks: result });
});

// 学生:我的可补签缺勤(24h 内)
app.get('/api/appeals/available', auth, requireRole('student'), async (req, res) => {
  const tasks = await db.q(
    `SELECT t.*, c.name course_name FROM signin_tasks t
     JOIN courses c ON c.id=t.course_id
     JOIN enrollments e ON e.course_id=t.course_id AND e.student_id=?
     WHERE t.status='ended'`, [req.user.id]);
  const result = [];
  for (const t of tasks) {
    const my = await myTaskStatus(t, req.user.id);
    if (my.status !== 'absent_can_appeal') continue;
    const endedAt = t.ended_at || t.end_time;
    const left = 24 * 3600000 - (new Date() - endedAt);
    if (left <= 0) continue;
    result.push({ task_id: t.id, course_name: t.course_name, end_time: t.end_time, left_ms: left });
  }
  res.json({ tasks: result });
});

app.get('/api/signin-tasks', auth, async (req, res) => {
  const courseId = req.query.course_id;
  const course = await db.q1('SELECT * FROM courses WHERE id=?', [courseId]);
  if (!course) return err(res, 404, '课程不存在');
  if (req.user.role === 'teacher' && course.teacher_id !== req.user.id) return err(res, 403, '无权限');
  if (req.user.role === 'student') {
    const enr = await db.q1('SELECT id FROM enrollments WHERE course_id=? AND student_id=?', [courseId, req.user.id]);
    if (!enr) return err(res, 403, '未加入该课程');
  }
  const tasks = await db.q('SELECT * FROM signin_tasks WHERE course_id=? ORDER BY start_time DESC', [courseId]);
  for (const t of tasks) await ensureEnded(t);
  const result = [];
  for (const t of tasks) {
    result.push({
      id: t.id, type: t.type, code: req.user.role === 'teacher' ? t.code : undefined,
      center_lat: req.user.role === 'teacher' ? t.center_lat : undefined,
      center_lng: req.user.role === 'teacher' ? t.center_lng : undefined,
      radius_m: req.user.role === 'teacher' ? t.radius_m : undefined,
      start_time: t.start_time, end_time: t.end_time, status: t.status, ended_at: t.ended_at,
      my_status: req.user.role === 'student' ? (await myTaskStatus(t, req.user.id)).status : undefined,
    });
  }
  res.json({ tasks: result });
});

app.get('/api/signin-tasks/:id', auth, async (req, res) => {
  const task = await db.q1(`SELECT t.*, c.name course_name, c.teacher_id FROM signin_tasks t JOIN courses c ON c.id=t.course_id WHERE t.id=?`, [req.params.id]);
  if (!task) return err(res, 404, '任务不存在');
  if (req.user.role === 'teacher' && task.teacher_id !== req.user.id) return err(res, 403, '无权限');
  if (req.user.role === 'student') {
    const enr = await db.q1('SELECT id FROM enrollments WHERE course_id=? AND student_id=?', [task.course_id, req.user.id]);
    if (!enr) return err(res, 403, '未加入该课程');
  }
  await ensureEnded(task);
  const data = { id: task.id, course_name: task.course_name, type: task.type, start_time: task.start_time, end_time: task.end_time, status: task.status, ended_at: task.ended_at };
  if (task.type === 'location') {
    data.center_lat = task.center_lat; data.center_lng = task.center_lng; data.radius_m = task.radius_m;
  }
  if (req.user.role === 'student') data.my_status = (await myTaskStatus(task, req.user.id)).status;
  res.json({ task: data });
});

// 签到(学生)
app.post('/api/signin-tasks/:id/sign', auth, requireRole('student'), async (req, res) => {
  const task = await db.q1(`SELECT t.*, c.teacher_id FROM signin_tasks t JOIN courses c ON c.id=t.course_id WHERE t.id=?`, [req.params.id]);
  if (!task) return err(res, 404, '任务不存在');
  const enr = await db.q1('SELECT id FROM enrollments WHERE course_id=? AND student_id=?', [task.course_id, req.user.id]);
  if (!enr) return err(res, 403, '不是本课程学生');
  await ensureEnded(task);
  const rec = await db.q1('SELECT id,status FROM signin_records WHERE task_id=? AND student_id=?', [task.id, req.user.id]);
  if (rec && rec.status === 'leave') return err(res, 400, '该时段已请假,无需签到');
  if (rec) return err(res, 400, '已签到,请勿重复提交');
  const now = new Date();
  if (now < task.start_time) return err(res, 400, '签到尚未开始');
  if (task.status === 'ended' || now > task.end_time) return err(res, 400, '签到已截止,可申请补签');
  const lr = await coveringLeave(req.user.id, task);
  if (lr && lr.status === 'pending') return err(res, 400, '请假审批中,暂不可签到');
  if (lr && lr.status === 'approved') return err(res, 400, '该时段已请假,无需签到');

  if (task.type === 'code') {
    if (String(req.body?.code || '') !== task.code) return err(res, 400, '签到码错误');
    await db.q('INSERT INTO signin_records (task_id,student_id,sign_time,status) VALUES (?,?,?,?)', [task.id, req.user.id, now, 'normal']);
  } else {
    const lat = Number(req.body?.lat), lng = Number(req.body?.lng);
    if (!lat || !lng) return err(res, 400, '缺少定位信息');
    const dist = utils.haversine(lat, lng, Number(task.center_lat), Number(task.center_lng));
    if (dist > task.radius_m) return err(res, 400, `距签到点约 ${Math.round(dist)} 米,请在范围内签到`);
    await db.q('INSERT INTO signin_records (task_id,student_id,sign_time,status,lat,lng) VALUES (?,?,?,?,?,?)', [task.id, req.user.id, now, 'normal', lat, lng]);
  }
  res.json({ ok: true, sign_time: now });
});

// 教师提前结束
app.post('/api/signin-tasks/:id/end', auth, requireRole('teacher'), async (req, res) => {
  const task = await db.q1(`SELECT t.*, c.teacher_id FROM signin_tasks t JOIN courses c ON c.id=t.course_id WHERE t.id=?`, [req.params.id]);
  if (!task || task.teacher_id !== req.user.id) return err(res, 404, '任务不存在');
  if (task.status === 'ended') return err(res, 400, '任务已结束');
  await db.q("UPDATE signin_tasks SET status='ended', ended_at=? WHERE id=?", [new Date(), task.id]);
  res.json({ ok: true });
});

// 教师:任务名单(已签/未签/请假/补签)
app.get('/api/signin-tasks/:id/records', auth, requireRole('teacher'), async (req, res) => {
  const task = await db.q1(`SELECT t.*, c.teacher_id FROM signin_tasks t JOIN courses c ON c.id=t.course_id WHERE t.id=?`, [req.params.id]);
  if (!task || task.teacher_id !== req.user.id) return err(res, 404, '任务不存在');
  await ensureEnded(task);
  const students = await db.q('SELECT u.id,u.name,u.account FROM enrollments e JOIN users u ON u.id=e.student_id WHERE e.course_id=? ORDER BY u.account', [task.course_id]);
  const recs = await db.q('SELECT * FROM signin_records WHERE task_id=?', [task.id]);
  const recMap = Object.fromEntries(recs.map((r) => [r.student_id, r]));

  const signed = [], unsigned = [], leaves = [], appeals = [];
  for (const s of students) {
    const r = recMap[s.id];
    const base = { id: s.id, name: s.name, account: s.account, sign_time: r?.sign_time || null };
    if (r && r.status === 'normal') signed.push(base);
    else if (r && r.status === 'leave') leaves.push(base);
    else if (r && r.status.startsWith('appeal')) appeals.push({ ...base, appeal_status: r.status });
    else {
      const lr = await coveringLeave(s.id, task);
      if (lr && lr.status === 'approved') leaves.push(base);
      else {
        const endedAt = task.ended_at || task.end_time;
        unsigned.push({ ...base, can_appeal: new Date() - endedAt < 24 * 3600000 });
      }
    }
  }
  res.json({ task_id: task.id, status: task.status, signed, unsigned, leaves, appeals });
});

// ============ 补签 ============
app.post('/api/appeals', auth, requireRole('student'), async (req, res) => {
  const { task_id, reason } = req.body || {};
  if (!reason || reason.length < 10) return err(res, 400, '补签理由至少 10 字');
  const task = await db.q1('SELECT * FROM signin_tasks WHERE id=?', [task_id]);
  if (!task) return err(res, 404, '任务不存在');
  const enr = await db.q1('SELECT id FROM enrollments WHERE course_id=? AND student_id=?', [task.course_id, req.user.id]);
  if (!enr) return err(res, 403, '不是本课程学生');
  await ensureEnded(task);
  const rec = await db.q1('SELECT * FROM signin_records WHERE task_id=? AND student_id=?', [task.id, req.user.id]);
  if (rec && rec.status === 'normal') return err(res, 400, '已正常签到,无需补签');
  const endedAt = task.ended_at || task.end_time;
  if (new Date() - endedAt >= 24 * 3600000) return err(res, 400, '已超过 24 小时补签窗口');
  const existAppeal = await db.q1('SELECT id FROM appeals WHERE task_id=? AND student_id=?', [task.id, req.user.id]);
  if (existAppeal) return err(res, 400, '已提交过补签申请');
  await db.q('INSERT INTO appeals (task_id,student_id,reason,status) VALUES (?,?,?,?)', [task.id, req.user.id, reason, 'pending']);
  if (rec) await db.q("UPDATE signin_records SET status='appeal_pending' WHERE id=?", [rec.id]);
  else await db.q('INSERT INTO signin_records (task_id,student_id,status) VALUES (?,?,?)', [task.id, req.user.id, 'appeal_pending']);
  res.json({ ok: true });
});

app.get('/api/appeals/my', auth, requireRole('student'), async (req, res) => {
  const list = await db.q(
    `SELECT a.*, t.start_time, t.end_time, t.course_id, c.name course_name, c.teacher_id
     FROM appeals a JOIN signin_tasks t ON t.id=a.task_id JOIN courses c ON c.id=t.course_id
     WHERE a.student_id=? ORDER BY a.created_at DESC`, [req.user.id]);
  res.json({ appeals: list });
});

app.get('/api/appeals', auth, requireRole('teacher'), async (req, res) => {
  let sql = `SELECT a.*, t.start_time, t.end_time, t.course_id, c.name course_name, u.name student_name, u.account
     FROM appeals a JOIN signin_tasks t ON t.id=a.task_id
     JOIN courses c ON c.id=t.course_id JOIN users u ON u.id=a.student_id
     WHERE c.teacher_id=?`;
  const params = [req.user.id];
  if (req.query.status) { sql += ' AND a.status=?'; params.push(req.query.status); }
  sql += ' ORDER BY a.created_at DESC';
  res.json({ appeals: await db.q(sql, params) });
});

// 审批补签(事务)
app.put('/api/appeals/:id/review', auth, requireRole('teacher'), async (req, res) => {
  const appeal = await db.q1(`SELECT a.*, t.course_id, c.teacher_id FROM appeals a JOIN signin_tasks t ON t.id=a.task_id JOIN courses c ON c.id=t.course_id WHERE a.id=?`, [req.params.id]);
  if (!appeal || appeal.teacher_id !== req.user.id) return err(res, 404, '申请不存在');
  if (appeal.status !== 'pending') return err(res, 400, '已审批过');
  const approve = !!req.body?.approve;
  const comment = (req.body?.comment || '').trim();
  const conn = await db.pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("UPDATE appeals SET status=?, teacher_comment=?, reviewed_at=? WHERE id=?", [approve ? 'approved' : 'rejected', comment, new Date(), appeal.id]);
    const [updated] = await conn.query("UPDATE signin_records SET status=? WHERE task_id=? AND student_id=?",
      [approve ? 'appeal_approved' : 'appeal_rejected', appeal.task_id, appeal.student_id]);
    if (updated.affectedRows === 0) {
      await conn.query('INSERT INTO signin_records (task_id,student_id,status) VALUES (?,?,?)',
        [appeal.task_id, appeal.student_id, approve ? 'appeal_approved' : 'appeal_rejected']);
    }
    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
});

// ============ 请假 ============
app.post('/api/leaves', auth, requireRole('student'), async (req, res) => {
  const b = req.body || {};
  const { course_id, leave_type, start_time, end_time, reason } = b;
  if (!['sick', 'personal', 'other'].includes(leave_type)) return err(res, 400, '请假类型不合法');
  if (!reason || reason.length < 10) return err(res, 400, '请假理由至少 10 字');
  const start = new Date(start_time), end = new Date(end_time);
  if (isNaN(start) || isNaN(end) || start >= end) return err(res, 400, '时间范围不合法');
  const enr = await db.q1('SELECT id FROM enrollments WHERE course_id=? AND student_id=?', [course_id, req.user.id]);
  if (!enr) return err(res, 403, '未加入该课程');
  const covered = await db.q1(
    'SELECT id FROM signin_tasks WHERE course_id=? AND start_time < ? AND end_time > ? LIMIT 1',
    [course_id, end, start]);
  if (!covered) return err(res, 400, '该时间段内没有可请假的课程任务');
  await db.q('INSERT INTO leave_requests (course_id,student_id,leave_type,start_time,end_time,reason,status) VALUES (?,?,?,?,?,?,?)',
    [course_id, req.user.id, leave_type, start, end, reason, 'pending']);
  res.json({ ok: true });
});

app.get('/api/leaves/my', auth, requireRole('student'), async (req, res) => {
  const list = await db.q(
    `SELECT l.*, c.name course_name FROM leave_requests l JOIN courses c ON c.id=l.course_id
     WHERE l.student_id=? ORDER BY l.created_at DESC`, [req.user.id]);
  res.json({ leaves: list });
});

app.get('/api/leaves', auth, requireRole('teacher'), async (req, res) => {
  let sql = `SELECT l.*, c.name course_name, u.name student_name, u.account
     FROM leave_requests l JOIN courses c ON c.id=l.course_id JOIN users u ON u.id=l.student_id
     WHERE c.teacher_id=?`;
  const params = [req.user.id];
  if (req.query.status) { sql += ' AND l.status=?'; params.push(req.query.status); }
  sql += ' ORDER BY l.created_at DESC';
  res.json({ leaves: await db.q(sql, params) });
});

// 审批请假(事务:通过时批量置 leave)
app.put('/api/leaves/:id/review', auth, requireRole('teacher'), async (req, res) => {
  const lr = await db.q1(`SELECT l.*, c.teacher_id FROM leave_requests l JOIN courses c ON c.id=l.course_id WHERE l.id=?`, [req.params.id]);
  if (!lr || lr.teacher_id !== req.user.id) return err(res, 404, '申请不存在');
  if (lr.status !== 'pending') return err(res, 400, '已审批过');
  const approve = !!req.body?.approve;
  const comment = (req.body?.comment || '').trim();
  const conn = await db.pool.getConnection();
  try {
    await conn.beginTransaction();
    await conn.query("UPDATE leave_requests SET status=?, teacher_comment=?, reviewed_at=? WHERE id=?", [approve ? 'approved' : 'rejected', comment, new Date(), lr.id]);
    if (approve) {
      // 覆盖时段内的任务:未签到记录置 leave;无记录则补插 leave 记录
      const tasks = await conn.query(
        'SELECT id FROM signin_tasks WHERE course_id=? AND start_time < ? AND end_time > ?',
        [lr.course_id, lr.end_time, lr.start_time]);
      for (const t of tasks[0]) {
        const rec = await conn.query('SELECT id FROM signin_records WHERE task_id=? AND student_id=?', [t.id, lr.student_id]);
        if (rec[0][0]) {
          await conn.query("UPDATE signin_records SET status='leave' WHERE id=?", [rec[0][0].id]);
        } else {
          await conn.query('INSERT INTO signin_records (task_id,student_id,status) VALUES (?,?,?)', [t.id, lr.student_id, 'leave']);
        }
      }
    }
    await conn.commit();
    res.json({ ok: true });
  } catch (e) {
    await conn.rollback();
    throw e;
  } finally {
    conn.release();
  }
});

// ============ 统计 ============
// 单次任务统计
app.get('/api/signin-tasks/:id/stats', auth, requireRole('teacher'), async (req, res) => {
  const task = await db.q1(`SELECT t.*, c.teacher_id FROM signin_tasks t JOIN courses c ON c.id=t.course_id WHERE t.id=?`, [req.params.id]);
  if (!task || task.teacher_id !== req.user.id) return err(res, 404, '任务不存在');
  await ensureEnded(task);
  const students = await db.q('SELECT u.id,u.name,u.account FROM enrollments e JOIN users u ON u.id=e.student_id WHERE e.course_id=? ORDER BY u.account', [task.course_id]);
  const recs = await db.q('SELECT * FROM signin_records WHERE task_id=?', [task.id]);
  const recMap = Object.fromEntries(recs.map((r) => [r.student_id, r]));
  const rows = [];
  let normal = 0, leave = 0, absent = 0, appealOk = 0;
  for (const s of students) {
    const r = recMap[s.id];
    let status;
    if (r && r.status === 'normal') { status = 'normal'; normal++; }
    else if (r && r.status === 'leave') { status = 'leave'; leave++; }
    else if (r && r.status === 'appeal_approved') { status = 'appeal_approved'; appealOk++; }
    else if (r && r.status.startsWith('appeal')) status = r.status;
    else {
      const lr = await coveringLeave(s.id, task);
      if (lr && lr.status === 'approved') { status = 'leave'; leave++; }
      else { status = 'absent'; absent++; }
    }
    rows.push({ name: s.name, account: s.account, status });
  }
  // 排序:缺勤/请假/补签在前,正常在后
  const order = { absent: 0, leave: 1, appeal_pending: 2, appeal_rejected: 2, appeal_approved: 3, normal: 4 };
  rows.sort((a, b) => order[a.status] - order[b.status] || a.account.localeCompare(b.account));
  const base = students.length - leave;
  res.json({ total: students.length, normal, leave, absent, appeal_approved: appealOk, rate: base > 0 ? Math.round(((normal + appealOk) / base) * 100) : 0, rows });
});

// 课程整体统计
app.get('/api/courses/:id/stats', auth, requireRole('teacher'), async (req, res) => {
  const course = await db.q1('SELECT * FROM courses WHERE id=? AND teacher_id=?', [req.params.id, req.user.id]);
  if (!course) return err(res, 404, '课程不存在');
  const students = await db.q('SELECT u.id,u.name,u.account FROM enrollments e JOIN users u ON u.id=e.student_id WHERE e.course_id=? ORDER BY u.account', [course.id]);
  const tasks = await db.q('SELECT * FROM signin_tasks WHERE course_id=?', [course.id]);
  for (const t of tasks) await ensureEnded(t);
  const ended = tasks.filter((t) => t.status === 'ended');
  const recs = await db.q(
    `SELECT r.* FROM signin_records r JOIN signin_tasks t ON t.id=r.task_id
     WHERE t.course_id=?`, [course.id]);
  const byTask = {};
  for (const r of recs) (byTask[r.task_id] ||= []).push(r);
  const rows = [];
  for (const s of students) {
    let normal = 0, appealOk = 0, leave = 0, absent = 0;
    for (const t of ended) {
      const recsOfTask = byTask[t.id] || [];
      const r = recsOfTask.find((x) => x.student_id === s.id);
      if (r && r.status === 'normal') normal++;
      else if (r && r.status === 'appeal_approved') appealOk++;
      else if (r && r.status === 'leave') leave++;
      else {
        const lr = await coveringLeave(s.id, t);
        if (lr && lr.status === 'approved') leave++;
        else absent++;
      }
    }
    const base = ended.length - leave;
    rows.push({ name: s.name, account: s.account, normal, appeal_approved: appealOk, leave, absent, rate: base > 0 ? Math.round(((normal + appealOk) / base) * 100) : 0 });
  }
  res.json({ course_name: course.name, task_count: ended.length, rows });
});

// 统一错误处理
app.use((error, req, res, next) => {
  console.error(error);
  res.status(500).json({ code: 500, message: '服务器开小差了' });
});

db.init().then(() => {
  app.listen(config.port, '0.0.0.0', () => {
    console.log(`早八签到已启动: http://localhost:${config.port}`);
  });
});
