// fetch 封装:自动带 token、统一报错、401 自动登出
import { ElMessage } from 'element-plus';

let token = localStorage.getItem('zb_token') || '';
let on401 = () => {};

export function setToken(t) { token = t; }
export function clearToken() { token = ''; }
export function set401Handler(fn) { on401 = fn; }

export async function api(method, path, body) {
  const res = await fetch('/api' + path, {
    method,
    headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: 'Bearer ' + token } : {}) },
    body: body ? JSON.stringify(body) : undefined,
  });
  // 空 body(如后端未启动、代理失败)解析 JSON 会抛错,转成友好提示
  let data;
  try {
    data = await res.json();
  } catch {
    throw new Error('服务器返回了空响应,请检查后端服务是否已启动');
  }
  if (res.status === 401) { clearToken(); on401(); throw new Error(data.message); }
  if (!res.ok) throw new Error(data.message || '请求失败');
  return data;
}

export const toast = (msg) => ElMessage({ message: msg, type: 'warning', duration: 2400 });
