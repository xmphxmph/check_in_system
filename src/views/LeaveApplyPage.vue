<script setup>
// 请假申请页:选课程、类型、时间段、理由
import { ref, reactive } from 'vue';
import { ElMessage } from 'element-plus';
import OverlayPage from '../components/OverlayPage.vue';
import { api, toast } from '../api.js';

const props = defineProps({
  courses: { type: Array, default: () => [] },
  presetCourse: { type: Object, default: null },
});
const emit = defineEmits(['submitted']);

const leaveForm = reactive({ course_id: null, leave_type: 'sick', start_time: '', end_time: '', reason: '' });
const submitLoading = ref(false);

// 每次打开组件都会重建,在这里做表单初始化
if (props.presetCourse) {
  leaveForm.course_id = props.presetCourse.id;
}
const d = new Date();
const p = (n) => String(n).padStart(2, '0');
leaveForm.start_time = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T08:00`;
leaveForm.end_time = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T10:00`;

async function submitLeave() {
  if (!leaveForm.course_id) return toast('请选择课程');
  if (!leaveForm.start_time || !leaveForm.end_time || leaveForm.start_time >= leaveForm.end_time) return toast('时间范围不合法');
  if (leaveForm.reason.length < 10) return toast('理由至少 10 字');
  submitLoading.value = true;
  try {
    await api('POST', '/leaves', { ...leaveForm, start_time: new Date(leaveForm.start_time).toISOString(), end_time: new Date(leaveForm.end_time).toISOString() });
    ElMessage.success('已提交,等待老师审批');
    emit('submitted');
  } catch (e) { toast(e.message); } finally { submitLoading.value = false; }
}
</script>

<template>
  <OverlayPage title="申请请假" width="600px" @close="$emit('submitted')">
    <el-form label-position="top" @submit.prevent="submitLeave">
      <el-form-item label="课程">
        <el-select v-model="leaveForm.course_id" placeholder="请选择课程" style="width:100%;">
          <el-option v-for="c in courses" :key="c.id" :label="c.name" :value="c.id" />
        </el-select>
      </el-form-item>

      <el-form-item label="请假类型">
        <el-radio-group v-model="leaveForm.leave_type">
          <el-radio value="sick">病假</el-radio>
          <el-radio value="personal">事假</el-radio>
          <el-radio value="other">其他</el-radio>
        </el-radio-group>
      </el-form-item>

      <div class="form-row">
        <el-form-item label="开始时间">
          <el-date-picker
            v-model="leaveForm.start_time" type="datetime" value-format="YYYY-MM-DDTHH:mm"
            placeholder="选择开始时间" style="width:100%;"
          />
        </el-form-item>
        <el-form-item label="结束时间">
          <el-date-picker
            v-model="leaveForm.end_time" type="datetime" value-format="YYYY-MM-DDTHH:mm"
            placeholder="选择结束时间" style="width:100%;"
          />
        </el-form-item>
      </div>

      <el-form-item label="请假理由">
        <el-input
          v-model="leaveForm.reason" type="textarea" :rows="4" maxlength="200" show-word-limit
          placeholder="请假理由(至少 10 字)"
        />
      </el-form-item>
    </el-form>

    <div class="dialog-footer">
      <el-button @click="$emit('submitted')">取消</el-button>
      <el-button type="primary" :loading="submitLoading" @click="submitLeave">提交请假</el-button>
    </div>
  </OverlayPage>
</template>
