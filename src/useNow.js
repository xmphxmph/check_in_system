// 每秒更新的"当前时间"composable,驱动页面上的倒计时刷新
import { ref, onMounted, onUnmounted } from 'vue';

export function useNow() {
  const now = ref(Date.now());
  let timer = null;
  onMounted(() => { timer = setInterval(() => { now.value = Date.now(); }, 1000); });
  onUnmounted(() => clearInterval(timer));
  return now;
}
