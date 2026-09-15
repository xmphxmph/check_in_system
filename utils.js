// 工具:码生成、距离计算、任务状态派生
const crypto = require('crypto');

// 6 位数字签到码
function genSignCode() {
  return String(crypto.randomInt(0, 1000000)).padStart(6, '0');
}

// 6 位字母数字邀请码
function genInviteCode() {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  for (let i = 0; i < 6; i++) {
    code += chars[crypto.randomInt(chars.length)];
  }
  return code;
}

// 两点距离(米),WGS-84
function haversine(lat1, lng1, lat2, lng2) {
  const R = 6371000;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

// 任务是否已结束(以服务端时间为准;已结束时顺手落库 ended)
function taskEnded(task, now = new Date()) {
  return task.ended_at != null || now > task.end_time;
}

module.exports = { genSignCode, genInviteCode, haversine, taskEnded };
