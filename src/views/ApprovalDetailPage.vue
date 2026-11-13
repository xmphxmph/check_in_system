<script setup>
// 审批详情页:补签/请假申请详情 + 通过/拒绝
import { ref } from 'vue';
import { ElMessage } from 'element-plus';
import OverlayPage from '../components/OverlayPage.vue';
import { api, toast } from '../api.js';
import { fmtTime } from '../utils.js';

const props = defineProps({ item: { type: Object, required: true } });
const emit = defineEmits(['close', 'reviewed']);

const reviewComment = ref('');
const submitLoading = ref(false);

async function reviewItem(approve) {
  submitLoading.value = true;
  try {
    const path = props.item.kind === 'appeal' ? '/appeals/' : '/leaves/';
    await api('PUT', path + props.item.id + '/review', { approve, comment: reviewComment.value });
    ElMessage.success(approve ? '已通过' : '已拒绝');
    emit('reviewed');
  } catch (e) { toast(e.message); } finally { submitLoading.value = false; }
}
</script>

<template>
  <OverlayPage title="审批详情" width="600px" @close="$emit('close')">
    <el-descriptions :column="2" border>
      <el-descriptions-item label="类型">
        <el-tag :type="item.kind === 'appeal' ? 'warning' : 'primary'" effect="light">
          {{ item.kind === 'appeal' ? '补签申请' : '请假申请' }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="状态">
        <el-tag :type="item.status === 'approved' ? 'success' : item.status === 'rejected' ? 'danger' : 'warning'" effect="light">
          {{ item.status === 'approved' ? '已通过' : item.status === 'rejected' ? '已拒绝' : '待审批' }}
        </el-tag>
      </el-descriptions-item>
      <el-descriptions-item label="学生">{{ item.student_name }} ({{ item.account }})</el-descriptions-item>
      <el-descriptions-item label="课程">{{ item.course_name }}</el-descriptions-item>
      <el-descriptions-item :label="item.kind === 'appeal' ? '任务时间' : '请假时间'" :span="2">
        <template v-if="item.kind === 'appeal'">{{ fmtTime(item.start_time) }}</template>
        <template v-else>{{ fmtTime(item.start_time) }} ~ {{ fmtTime(item.end_time) }}</template>
      </el-descriptions-item>
      <el-descriptions-item v-if="item.kind === 'leave'" label="请假类型" :span="2">
        {{ item.leave_type === 'sick' ? '病假' : item.leave_type === 'personal' ? '事假' : '其他' }}
      </el-descriptions-item>
      <el-descriptions-item label="理由" :span="2">{{ item.reason }}</el-descriptions-item>
      <el-descriptions-item label="申请时间" :span="2">{{ fmtTime(item.created_at) }}</el-descriptions-item>
    </el-descriptions>

    <template v-if="item.status === 'pending'">
      <div class="form-label">审批意见(选填)</div>
      <el-input v-model="reviewComment" type="textarea" :rows="3" maxlength="200" placeholder="写点意见…" />
      <div class="dialog-footer">
        <el-button @click="$emit('close')">取消</el-button>
        <el-button type="danger" plain :loading="submitLoading" @click="reviewItem(false)">拒 绝</el-button>
        <el-button type="success" :loading="submitLoading" @click="reviewItem(true)">通 过</el-button>
      </div>
    </template>
  </OverlayPage>
</template>
