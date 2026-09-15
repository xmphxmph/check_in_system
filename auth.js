// JWT 鉴权中间件
const jwt = require('jsonwebtoken');
const config = require('./config');

function auth(req, res, next) {
  const header = req.headers.authorization || '';
  const token = header.startsWith('Bearer ') ? header.slice(7) : null;
  if (!token) return res.status(401).json({ code: 401, message: '未登录' });
  try {
    req.user = jwt.verify(token, config.jwtSecret);
    next();
  } catch {
    return res.status(401).json({ code: 401, message: '登录已过期' });
  }
}

// 角色守卫:requireTeacher / requireStudent
function requireRole(role) {
  return (req, res, next) => {
    if (req.user.role !== role) {
      return res.status(403).json({ code: 403, message: '无权限' });
    }
    next();
  };
}

module.exports = { auth, requireRole };
