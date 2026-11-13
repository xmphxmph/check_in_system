// 端到端测试:请假审批、补签审批、课程加入、定位签到
const BASE = 'http://localhost:3000/api';
async function api(method, path, body, token) {
  const res = await fetch(BASE + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  return res.json();
}
const login = (a, p) => api('POST', '/auth/login', { account: a, password: p });

(async () => {
  const t = (await login('t001', '123456')).token;
  const s9 = (await login('s009', '123456')).token;

  // 1. 学生 s009 请假申请(覆盖 T1 进行中任务)
  const leaveBody = {
    course_id: 1, leave_type: 'sick', reason: '感冒发烧了需要去医院看病',
    start_time: new Date(Date.now() - 60000).toISOString(),
    end_time: new Date(Date.now() + 60000 * 20).toISOString(),
  };
  console.log('s009 请假:', JSON.stringify(await api('POST', '/leaves', leaveBody, s9)));
  const pendingLeaves = await api('GET', '/leaves?status=pending', null, t);
  const lr = pendingLeaves.leaves.find((l) => l.account === 's009');
  console.log('教师看到待审请假 s009:', !!lr);

  // 2. 教师通过 s009 请假 → 该课签到应显示请假
  console.log('审批请假通过:', JSON.stringify(await api('PUT', `/leaves/${lr.id}/review`, { approve: true, comment: '注意休息' }, t)));
  console.log('s009 再签 T1:', (await api('POST', '/signin-tasks/1/sign', { code: '123456' }, s9)).message);
  const recs = await api('GET', '/signin-tasks/1/records', null, t);
  console.log('T1 请假名单:', recs.leaves.map((x) => x.account).join(','));

  // 3. 补签审批:s003 在 T4 待审 → 通过
  const pendingAppeals = await api('GET', '/appeals?status=pending', null, t);
  const ap = pendingAppeals.appeals[0];
  console.log('审批补签通过:', JSON.stringify(await api('PUT', `/appeals/${ap.id}/review`, { approve: true, comment: '下不为例' }, t)));
  console.log('T4 统计:', JSON.stringify(await api('GET', '/signin-tasks/4/stats', null, t)));

  // 4. 定位签到:s002 在 T5(天安门,300m 半径)附近签到
  const s2 = (await login('s002', '123456')).token;
  const far = await api('POST', '/signin-tasks/5/sign', { lat: 39.92, lng: 116.50 }, s2);
  console.log('距离外签到:', far.message);
  const near = await api('POST', '/signin-tasks/5/sign', { lat: 39.908900, lng: 116.397500 }, s2);
  console.log('范围内签到:', JSON.stringify(near));

  // 5. 课程创建 + 学生加入
  const nc = await api('POST', '/courses', { name: '大学英语' }, t);
  console.log('创建课程:', JSON.stringify(nc));
  const join = await api('POST', '/courses/join', { invite_code: nc.invite_code }, (await login('s0010', '123456')).token);
  console.log('s0010 加入:', JSON.stringify(join));

  // 6. 课程整体统计
  console.log('课程1整体统计:', JSON.stringify(await api('GET', '/courses/1/stats', null, t)));
})().catch((e) => { console.error(e); process.exit(1); });
