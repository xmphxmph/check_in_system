<script setup>
// 任务管理页:签到码展示、提前结束、5 秒轮询四分组名单
import { ref, reactive, onMounted, onUnmounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import OverlayPage from '../components/OverlayPage.vue';
import { api, toast } from '../api.js';
import { fmtTime, fmtCountdown, statusText, statusType, remaining } from '../utils.js';
import { useNow } from '../useNow.js';

const props = defineProps({ task: { type: Object, required: true } });
const emit = defineEmits(['close']);

const now = useNow();
const records = reactive({ signed: [], unsigned: [], leaves: [], appeals: [] });
const recordTab = ref('signed');
let recordTimer = null;

const totalCount = () =>
  records.signed.length + records.unsigned.length + records.leaves.length +
  records.appeals.filter((a) => a.appeal_status === 'appeal_approved').length;

async function loadRecords() {
  try { Object.assign(records, await api('GET', '/signin-tasks/' + props.task.id + '/records')); } catch {}
}

async function endTask() {
  try {
    await ElMessageBox.confirm('未签到学生将记为缺勤', '提前结束签到?', { type: 'warning', confirmButtonText: '结束', cancelButtonText: '取消' });
  } catch { return; }
  await api('POST', '/signin-tasks/' + props.task.id + '/end');
  ElMessage.success('已结束');
  await loadRecords();
}

onMounted(() => {
  loadRecords();
  recordTimer = setInterval(loadRecords, 5000);
});
onUnmounted(() => clearInterval(recordTimer));
</script>

<template>
  <OverlayPage title="签到管理" width="900px" @close="$emit('close')">
    <div class="task-card" style="margin-bottom:18px;">
      <div class="task-title">
        {{ task.course_name }}
        <el-tag size="small" effect="plain">{{ task.type === 'code' ? '签到码' : '定位' }}</el-tag>
        <el-tag v-if="task.code" size="small" type="primary" effect="light">签到码 {{ task.code }}</el-tag>
      </div>
      <div class="task-sub">
        已签到 {{ records.signed.length }} / {{ totalCount() }} 人
        <template v-if="task.status === 'active'"> · 截止 {{ fmtTime(task.end_time) }}</template>
      </div>
      <div class="task-foot">
        <span v-if="task.status === 'active'" class="countdown" :class="{ warn: remaining(task.end_time, now) <= 900000 }">
          {{ fmtCountdown(task.end_time, now) }}
        </span>
        <el-tag v-else type="info" effect="light">已结束</el-tag>
        <el-button v-if="task.status === 'active'" type="danger" plain size="small" @click="endTask">提前结束</el-button>
      </div>
    </div>

    <el-tabs v-model="recordTab">
      <el-tab-pane :label="`已签到 ${records.signed.length}`" name="signed">
        <el-empty v-if="!records.signed.length" description="暂无" :image-size="80" />
        <el-table v-else :data="records.signed" border stripe max-height="360">
          <el-table-column prop="name" label="姓名" width="140" />
          <el-table-column prop="account" label="学号" width="160" />
          <el-table-column label="签到时间">
            <template #default="{ row }">{{ fmtTime(row.sign_time) }}</template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane :label="`未签到 ${records.unsigned.length}`" name="unsigned">
        <el-empty v-if="!records.unsigned.length" description="全部已签 🎉" :image-size="80" />
        <el-table v-else :data="records.unsigned" border stripe max-height="360">
          <el-table-column prop="name" label="姓名" width="140" />
          <el-table-column prop="account" label="学号" width="160" />
          <el-table-column label="备注">
            <template #default="{ row }">
              <el-tag v-if="row.can_appeal" type="warning" effect="light" size="small">24h 内可补签</el-tag>
              <span v-else class="muted">—</span>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>

      <el-tab-pane :label="`请假 ${records.leaves.length}`" name="leaves">
        <el-empty v-if="!records.leaves.length" description="暂无" :image-size="80" />
        <el-table v-else :data="records.leaves" border stripe max-height="360">
          <el-table-column prop="name" label="姓名" width="140" />
          <el-table-column prop="account" label="学号" width="160" />
        </el-table>
      </el-tab-pane>

      <el-tab-pane :label="`补签 ${records.appeals.length}`" name="appeals">
        <el-empty v-if="!records.appeals.length" description="暂无" :image-size="80" />
        <el-table v-else :data="records.appeals" border stripe max-height="360">
          <el-table-column prop="name" label="姓名" width="140" />
          <el-table-column prop="account" label="学号" width="160" />
          <el-table-column label="补签状态">
            <template #default="{ row }">
              <el-tag :type="statusType(row.appeal_status)" effect="light">{{ statusText(row.appeal_status) }}</el-tag>
            </template>
          </el-table-column>
        </el-table>
      </el-tab-pane>
    </el-tabs>
  </OverlayPage>
</template>
