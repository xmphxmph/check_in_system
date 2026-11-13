<script setup>
// 课程详情:学生版(任务状态+请假/补签入口)/ 教师版(任务列表+统计/管理入口)
import { ref, onMounted } from 'vue';
import OverlayPage from '../components/OverlayPage.vue';
import { api } from '../api.js';
import { fmtTime, copyCode, statusText, statusType } from '../utils.js';

const props = defineProps({
  course: { type: Object, required: true },
  role: { type: String, required: true },
});
const emit = defineEmits(['close', 'open-leave', 'open-appeal', 'open-task-manage', 'open-task-stats', 'open-course-stats']);

const detailTasks = ref([]);

onMounted(async () => {
  try { detailTasks.value = (await api('GET', '/courses/' + props.course.id)).tasks; } catch {}
});

function openAppealApplyFromTask(t) {
  emit('open-appeal', { id: t.id, course_name: props.course.name, end_time: t.end_time, ended_at: t.ended_at });
}
</script>

<template>
  <OverlayPage title="课程详情" width="900px" @close="$emit('close')">
    <div class="detail-head">
      <div>
        <div class="detail-title">{{ course.name }}</div>
        <div class="muted" style="margin-top:6px;">
          {{ course.teacher_name }}
          <template v-if="role === 'teacher'"> · 邀请码 <b style="letter-spacing:2px;">{{ course.invite_code }}</b> · {{ course.student_count }} 人</template>
        </div>
      </div>
      <div style="display:flex;gap:10px;">
        <el-button v-if="role === 'student'" type="primary" plain @click="$emit('open-leave', course)">申请请假</el-button>
        <template v-else>
          <el-button type="primary" plain @click="$emit('open-course-stats', course)">整体统计</el-button>
          <el-button @click="copyCode(course.invite_code)">复制邀请码</el-button>
        </template>
      </div>
    </div>

    <div class="section-title" style="margin-top:22px;">签到任务({{ detailTasks.length }})</div>
    <el-empty v-if="!detailTasks.length" description="还没有签到任务" :image-size="90" />

    <!-- 学生版:显示我的签到状态 -->
    <el-table v-else-if="role === 'student'" :data="detailTasks" border stripe>
      <el-table-column label="任务时间" width="150">
        <template #default="{ row }">{{ fmtTime(row.start_time) }}</template>
      </el-table-column>
      <el-table-column label="方式" width="100">
        <template #default="{ row }">{{ row.type === 'code' ? '签到码' : '定位' }}</template>
      </el-table-column>
      <el-table-column label="我的状态" min-width="140">
        <template #default="{ row }">
          <el-tag v-if="row.my_status" :type="statusType(row.my_status)" effect="light">{{ statusText(row.my_status) }}</el-tag>
          <el-tag v-else-if="row.status === 'active'" type="success" effect="light">进行中</el-tag>
          <span v-else class="muted">—</span>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="130">
        <template #default="{ row }">
          <el-button v-if="row.my_status === 'absent_can_appeal'" link type="warning" @click="openAppealApplyFromTask(row)">申请补签</el-button>
          <span v-else class="muted">—</span>
        </template>
      </el-table-column>
    </el-table>

    <!-- 教师版:任务列表 + 统计/管理 -->
    <el-table v-else :data="detailTasks" border stripe>
      <el-table-column label="任务时间" width="150">
        <template #default="{ row }">{{ fmtTime(row.start_time) }}</template>
      </el-table-column>
      <el-table-column label="方式" width="100">
        <template #default="{ row }">{{ row.type === 'code' ? '签到码' : '定位' }}</template>
      </el-table-column>
      <el-table-column label="状态" width="110">
        <template #default="{ row }">
          <el-tag :type="row.status === 'active' ? 'success' : 'info'" effect="light">
            {{ row.status === 'active' ? '进行中' : '已结束' }}
          </el-tag>
        </template>
      </el-table-column>
      <el-table-column label="操作" width="200">
        <template #default="{ row }">
          <el-button link type="primary" @click="$emit('open-task-stats', row)">统计</el-button>
          <el-button v-if="row.status === 'active'" link type="primary" @click="$emit('open-task-manage', { ...row, course_name: course.name })">管理</el-button>
        </template>
      </el-table-column>
    </el-table>
  </OverlayPage>
</template>

<style scoped>
.detail-head {
  display: flex;
  align-items: flex-start;
  justify-content: space-between;
  gap: 16px;
  padding-bottom: 18px;
  border-bottom: 1px solid var(--border);
}
.detail-title { font-size: 20px; font-weight: 700; }
</style>
