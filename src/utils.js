// 通用工具函数:时间格式化、状态文案/颜色
import { toast } from './api.js';

const pad = (n) => String(n).padStart(2, '0');

export function fmtTime(t) {
  if (!t) return '';
  const d = new Date(t);
  return `${pad(d.getMonth() + 1)}-${pad(d.getDate())} ${pad(d.getHours())}:${pad(d.getMinutes())}`;
}

// remaining(end, now):传 now 保证每秒重渲染时重新计算
export function remaining(end, now = Date.now()) { return new Date(end) - now; }

export function fmtCountdown(end, now = Date.now()) {
  const ms = remaining(end, now);
  if (ms <= 0) return '00:00';
  const s = Math.floor(ms / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
}

export function statusText(s) {
  return { pending: '审批中', approved: '已通过', rejected: '已拒绝', normal: '已签到', leave: '请假', leave_pending: '请假审批中', appeal_pending: '补签待审', appeal_approved: '补签通过', appeal_rejected: '补签拒绝', absent: '缺勤', absent_can_appeal: '缺勤·可补签' }[s] || s;
}

// 状态 → Element Plus 标签类型
export function statusType(s) {
  return {
    normal: 'success', leave: 'primary', leave_pending: 'warning',
    pending: 'warning', approved: 'success', rejected: 'danger',
    appeal_pending: 'warning', appeal_approved: 'success', appeal_rejected: 'danger',
    absent: 'danger', absent_can_appeal: 'warning',
  }[s] || 'info';
}

export function statusColor(s) {
  return { normal: '#07c160', leave: '#1989fa', pending: '#ff976a', approved: '#00c8c8', rejected: '#ee0a24', appeal_pending: '#ff976a', appeal_approved: '#00c8c8', appeal_rejected: '#ee0a24', absent: '#ee0a24' }[s] || '#969799';
}

export function ringBg(rate) {
  return rate >= 80 ? '#07c160' : rate >= 60 ? '#ff976a' : '#ee0a24';
}

export function copyCode(code) {
  navigator.clipboard.writeText(code).then(() => toast('已复制:' + code)).catch(() => toast(code));
}
