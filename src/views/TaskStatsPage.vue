<script setup>
// 单次任务统计:出勤率概览 + 按姓名/学号搜索
import { ref, computed, onMounted } from 'vue';
import { Search } from '@element-plus/icons-vue';
import OverlayPage from '../components/OverlayPage.vue';
import { api } from '../api.js';
import { statusText, statusType } from '../utils.js';

const props = defineProps({ task: { type: Object, required: true } });
const emit = defineEmits(['close']);

const taskStats = ref({ rate: 0, normal: 0, leave: 0, absent: 0, rows: [] });
const statsKeyword = ref('');

const filteredStatsRows = computed(() => {
  const kw = statsKeyword.value.trim();
  if (!kw) return taskStats.value.rows;
  return taskStats.value.rows.filter((r) => r.name.includes(kw) || r.account.includes(kw));
});

onMounted(async () => {
  try { taskStats.value = await api('GET', '/signin-tasks/' + props.task.id + '/stats'); } catch {}
});
</script>

<template>
  <OverlayPage title="任务统计" width="820px" @close="$emit('close')">
    <div class="stat-grid">
      <div class="stat-box"><div class="stat-num" style="color:#2f6feb;">{{ taskStats.rate }}%</div><div class="stat-label">出勤率</div></div>
      <div class="stat-box"><div class="stat-num" style="color:#12a150;">{{ taskStats.normal }}</div><div class="stat-label">正常</div></div>
      <div class="stat-box"><div class="stat-num" style="color:#2f6feb;">{{ taskStats.leave }}</div><div class="stat-label">请假</div></div>
      <div class="stat-box"><div class="stat-num" style="color:#e03131;">{{ taskStats.absent }}</div><div class="stat-label">缺勤</div></div>
    </div>

    <el-input
      v-model="statsKeyword"
      :prefix-icon="Search"
      placeholder="按姓名 / 学号搜索"
      clearable
      style="max-width:280px;margin-bottom:14px;"
    />

    <el-empty v-if="!filteredStatsRows.length" description="没有匹配的记录" :image-size="90" />
    <el-table v-else :data="filteredStatsRows" border stripe max-height="420">
      <el-table-column prop="name" label="姓名" width="140" />
      <el-table-column prop="account" label="学号" width="160" />
      <el-table-column label="状态" width="140">
        <template #default="{ row }">
          <el-tag :type="statusType(row.status)" effect="light">{{ statusText(row.status) }}</el-tag>
        </template>
      </el-table-column>
    </el-table>
  </OverlayPage>
</template>
