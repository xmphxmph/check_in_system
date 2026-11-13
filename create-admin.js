// 直接创建管理员账号:注册页不开放该角色,只能用这个脚本创建/提权
// 用法: node --env-file=.env create-admin.js <账号> <密码> [姓名]
//       npm run create-admin -- admin admin123 系统管理员
const bcrypt = require('bcryptjs');
const db = require('./db');

(async () => {
  const [account, password, name] = process.argv.slice(2);
  if (!account || !password) {
    console.log('用法: node --env-file=.env create-admin.js <账号> <密码> [姓名]');
    process.exit(1);
  }
  if (password.length < 6) {
    console.log('密码至少 6 位');
    process.exit(1);
  }

  await db.init();
  const hash = bcrypt.hashSync(password, 10);
  const exist = await db.q1('SELECT id, name, role FROM users WHERE account=?', [account]);

  if (exist) {
    await db.q('UPDATE users SET role=?, password_hash=?, name=? WHERE id=?',
      ['admin', hash, name || exist.name, exist.id]);
    console.log(`已把账号 ${account} 提升为管理员(原角色:${exist.role}),密码已重置`);
  } else {
    await db.q('INSERT INTO users (account,name,role,password_hash) VALUES (?,?,?,?)',
      [account, name || '系统管理员', 'admin', hash]);
    console.log(`管理员账号已创建:${account}`);
  }
  process.exit(0);
})().catch((e) => { console.error(e); process.exit(1); });
