// 鉴权:JWT 中间件 + 角色守卫
const jwt = require('jsonwebtoken');
const config = require('./config');
const db = require('./db');

// 从请求头 Authorization: Bearer <token> 取 token 并验签,通过后挂到 req.user。
// 每次请求都回查一次用户:账号被删除/角色被改,旧 token 立即失效(不必等 7 天过期)。
async function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ code: 401, message: '未登录,请先登录' });
  let payload;
  try {
    payload = jwt.verify(token, config.jwtSecret);
  } catch {
    return res.status(401).json({ code: 401, message: '登录已过期,请重新登录' });
  }
  try {
    const u = await db.q1('SELECT id, account, name, role FROM users WHERE id=?', [payload.id]);
    if (!u) return res.status(401).json({ code: 401, message: '账号不存在或已被删除' });
    req.user = { id: u.id, account: u.account, name: u.name, role: u.role };
    next();
  } catch (e) {
    next(e);
  }
}

// 角色守卫:requireRole('teacher')。
// 管理员是"教师超集":任何 teacher 路由都对管理员开放;学生路由不开放。
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ code: 401, message: '未登录,请先登录' });
    const ok = req.user.role === role || (role === 'teacher' && req.user.role === 'admin');
    if (!ok) return res.status(403).json({ code: 403, message: '无权限执行该操作' });
    next();
  };
}

module.exports = { auth, requireRole };
