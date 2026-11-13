<script setup>
// 补签申请页:24h 内缺勤可申请
import { ref, computed } from 'vue';
import { ElMessage } from 'element-plus';
import OverlayPage from '../components/OverlayPage.vue';
import { api, toast } from '../api.js';
import { fmtTime, fmtCountdown } from '../utils.js';
import { useNow } from '../useNow.js';

const props = defineProps({ task: { type: Object, required: true } });
const emit = defineEmits(['submitted']);

const now = useNow();
const appealReason = ref('');
const submitLoading = ref(false);

const appealDeadline = computed(() => new Date(new Date(props.task.ended_at || props.task.end_time).getTime() + 24 * 3600000));

async function submitAppeal() {
  if (appealReason.value.length < 10) return toast('理由至少 10 字');
  submitLoading.value = true;
  try {
    await api('POST', '/appeals', { task_id: props.task.id, reason: appealReason.value });
    ElMessage.success('已提交,等待老师审批');
    emit('submitted');
  } catch (e) { toast(e.message); } finally { submitLoading.value = false; }
}
</script>

<template>
  <OverlayPage title="申请补签" width="520px" @close="$emit('submitted')">
    <div class="task-card">
      <div class="task-title">{{ task.course_name }}</div>
      <div class="task-sub">任务时间 {{ fmtTime(task.end_time) }} · 剩余补签时间 {{ fmtCountdown(appealDeadline, now) }}</div>
    </div>

    <div class="form-label">补签理由</div>
    <el-input
      v-model="appealReason"
      type="textarea"
      :rows="4"
      maxlength="200"
      show-word-limit
      placeholder="说明缺勤原因(至少 10 字)"
    />

    <div class="dialog-footer">
      <el-button @click="$emit('submitted')">取消</el-button>
      <el-button type="primary" :loading="submitLoading" @click="submitAppeal">提交申请</el-button>
    </div>
  </OverlayPage>
</template>
