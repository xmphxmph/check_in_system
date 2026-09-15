// 验证统计排序:缺勤/请假在最前
const BASE = 'http://localhost:3000/api';
async function api(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}
(async () => {
  const t = await api('POST', '/auth/login', { account: 't001', password: '123456' });
  // 找一个有缺勤/请假的任务:任务3(3天前,s001 补签通过 s002 请假)
  const stats = await api('GET', '/signin-tasks/3/stats', null, t.token);
  console.log('T3 名单顺序:');
  stats.rows.forEach((r) => console.log(' ', r.status.padEnd(16), r.name, r.account));
})().catch((e) => { console.error(e.message); process.exit(1); });
