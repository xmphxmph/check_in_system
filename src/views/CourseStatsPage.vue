<script setup>
// 课程整体统计:每名学生累计出勤率
import { ref, onMounted } from 'vue';
import OverlayPage from '../components/OverlayPage.vue';
import { api } from '../api.js';
import { ringBg } from '../utils.js';

const props = defineProps({ course: { type: Object, required: true } });
const emit = defineEmits(['close']);

const courseStats = ref({ course_name: '', task_count: 0, rows: [] });

onMounted(async () => {
  try { courseStats.value = await api('GET', '/courses/' + props.course.id + '/stats'); } catch {}
});
</script>

<template>
  <OverlayPage title="课程统计" width="900px" @close="$emit('close')">
    <div class="muted" style="margin-bottom:14px;">
      {{ courseStats.course_name }} · 已结束任务 {{ courseStats.task_count }} 次 · 共 {{ courseStats.rows.length }} 名学生
    </div>
    <el-empty v-if="!courseStats.rows.length" description="暂无学生" :image-size="100" />
    <el-table v-else :data="courseStats.rows" border stripe>
      <el-table-column prop="name" label="姓名" width="120" />
      <el-table-column prop="account" label="学号" width="130" />
      <el-table-column prop="normal" label="正常" width="90" align="center" />
      <el-table-column prop="leave" label="请假" width="90" align="center" />
      <el-table-column prop="absent" label="缺勤" width="90" align="center" />
      <el-table-column prop="appeal_approved" label="补签通过" width="110" align="center" />
      <el-table-column label="出勤率" min-width="200">
        <template #default="{ row }">
          <div style="display:flex;align-items:center;gap:12px;">
            <el-progress
              :percentage="row.rate"
              :color="ringBg(row.rate)"
              :stroke-width="10"
              style="flex:1;"
            />
            <b :style="{ color: ringBg(row.rate), width: '46px', textAlign: 'right' }">{{ row.rate }}%</b>
          </div>
        </template>
      </el-table-column>
    </el-table>
  </OverlayPage>
</template>
