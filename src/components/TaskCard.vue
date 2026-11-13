<script setup>
// 首页签到任务卡:倒计时 + 按状态显示按钮
import { computed } from 'vue';
import { useNow } from '../useNow.js';
import { fmtTime } from '../utils.js';

const props = defineProps({ task: { type: Object, required: true } });
const emit = defineEmits(['sign', 'appeal']);

const now = useNow();

const btnState = computed(() => {
  const s = props.task.my_status;
  if (s === 'unsigned') return { text: '立即签到', type: 'primary', action: 'sign' };
  if (s === 'normal') return { text: '已签到', type: 'success', done: true };
  if (s === 'leave_pending') return { text: '请假审批中', type: 'warning' };
  if (s === 'leave') return { text: '请假', type: 'primary', done: true };
  if (s === 'absent_can_appeal') return { text: '申请补签', type: 'warning', action: 'appeal' };
  if (s === 'absent') return { text: '缺勤', type: 'danger', done: true };
  if (s === 'appeal_pending') return { text: '补签待审', type: 'warning' };
  if (s === 'appeal_approved') return { text: '补签通过', type: 'success', done: true };
  if (s === 'appeal_rejected') return { text: '补签拒绝', type: 'danger', done: true };
  return { text: '', type: 'info' };
});

const leftMs = computed(() => new Date(props.task.end_time) - now.value);
const warn = computed(() => leftMs.value > 0 && leftMs.value <= 15 * 60000);
const mmss = computed(() => {
  if (leftMs.value <= 0) return '00:00';
  const s = Math.floor(leftMs.value / 1000);
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const pad = (n) => String(n).padStart(2, '0');
  return h > 0 ? `${h}:${pad(m)}:${pad(sec)}` : `${pad(m)}:${pad(sec)}`;
});
</script>

<template>
  <div
    class="task-card"
    :class="{ deadline: warn, done: btnState.done, clickable: !!btnState.action }"
    @click="btnState.action && emit(btnState.action)"
  >
    <div class="task-title">
      {{ task.course_name }}
      <el-tag size="small" effect="plain" :type="task.type === 'code' ? 'info' : 'success'">
        {{ task.type === 'code' ? '签到码' : '定位' }}
      </el-tag>
      <el-tag v-if="warn" size="small" type="warning" effect="light">即将截止</el-tag>
    </div>
    <div class="task-sub">{{ task.teacher_name }} · 截止 {{ fmtTime(task.end_time) }}</div>
    <div class="task-foot">
      <span class="countdown" :class="{ warn }">{{ mmss }}</span>
      <el-button
        v-if="btnState.action"
        :type="btnState.type"
        @click.stop="emit(btnState.action)"
      >{{ btnState.text }}</el-button>
      <el-tag v-else-if="btnState.text" :type="btnState.type" effect="plain" round>{{ btnState.text }}</el-tag>
    </div>
  </div>
</template>
