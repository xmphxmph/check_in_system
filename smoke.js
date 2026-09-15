// API 冒烟测试:教师发起签到 → 学生签到 → 教师看名单
const BASE = 'http://localhost:3000/api';

async function api(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}

(async () => {
  const t = await api('POST', '/auth/login', { account: 't001', password: '123456' });
  const s1 = await api('POST', '/auth/login', { account: 's001', password: '123456' });
  const s2 = await api('POST', '/auth/login', { account: 's002', password: '123456' });
  console.log('登录:', t.user.role, s1.user.role, s2.user.role);

  console.log('教师课程:', (await api('GET', '/courses', null, t.token)).courses.map(c => `${c.name}(${c.invite_code},${c.student_count}人)`).join(' '));
  console.log('学生课程:', (await api('GET', '/courses', null, s1.token)).courses.map(c => c.name).join(' '));

  const active = await api('GET', '/signin-tasks/active', null, s1.token);
  console.log('s001 进行中任务:', JSON.stringify(active.tasks));

  // s001 输错码
  console.log('错码签到:', (await api('POST', `/signin-tasks/1/sign`, { code: '000000' }, s1.token)).message);
  // s001 正确签到
  console.log('正确签到:', JSON.stringify(await api('POST', '/signin-tasks/1/sign', { code: '123456' }, s1.token)));
  // s001 重复签到
  console.log('重复签到:', (await api('POST', '/signin-tasks/1/sign', { code: '123456' }, s1.token)).message);
  // s004 有 pending 请假
  console.log('s004 请假拦截:', (await api('POST', '/signin-tasks/1/sign', { code: '123456' }, (await api('POST', '/auth/login', { account: 's004', password: '123456' })).token)).message);

  const records = await api('GET', '/signin-tasks/1/records', null, t.token);
  console.log('T1 名单: 已签', records.signed.map(x => x.account).join(','), '| 未签', records.unsigned.map(x => x.account).join(','));

  console.log('可补签列表(s001):', JSON.stringify(await api('GET', '/appeals/available', null, s1.token)));
  console.log('待审补签(教师):', (await api('GET', '/appeals?status=pending', null, t.token)).appeals.length, '条');
  console.log('待审请假(教师):', (await api('GET', '/leaves?status=pending', null, t.token)).leaves.length, '条');
  console.log('T1 统计:', JSON.stringify(await api('GET', '/signin-tasks/1/stats', null, t.token)));
})().catch(e => { console.error(e); process.exit(1); });
