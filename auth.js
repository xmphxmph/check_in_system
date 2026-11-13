// 鉴权:JWT 中间件 + 角色守卫
const jwt = require('jsonwebtoken');
const config = require('./config');

// 从请求头 Authorization: Bearer <token> 取 token 并验签,通过后挂到 req.user
function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : '';
  if (!token) return res.status(401).json({ code: 401, message: '未登录,请先登录' });
  try {
    req.user = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    return res.status(401).json({ code: 401, message: '登录已过期,请重新登录' });
  }
}

// 角色守卫:requireRole('teacher') 只允许教师访问
function requireRole(role) {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ code: 401, message: '未登录,请先登录' });
    if (req.user.role !== role) return res.status(403).json({ code: 403, message: '无权限执行该操作' });
    next();
  };
}

module.exports = { auth, requireRole };
