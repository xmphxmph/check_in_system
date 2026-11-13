<script setup>
// 教师端:侧边栏 + 顶栏布局,首页/课程/审批中心/个人中心
import { ref, computed, onMounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import { HomeFilled, Collection, Tickets, User, SwitchButton, Plus, ArrowRight, CopyDocument } from '@element-plus/icons-vue';
import CreateTaskPage from './CreateTaskPage.vue';
import TaskManagePage from './TaskManagePage.vue';
import ApprovalDetailPage from './ApprovalDetailPage.vue';
import TaskStatsPage from './TaskStatsPage.vue';
import CourseStatsPage from './CourseStatsPage.vue';
import CourseDetailPage from './CourseDetailPage.vue';
import { api, toast } from '../api.js';
import { fmtTime, fmtCountdown, remaining, copyCode } from '../utils.js';
import { useNow } from '../useNow.js';

const props = defineProps({ user: { type: Object, required: true } });
const emit = defineEmits(['logout']);

const now = useNow();
const activeTab = ref('home');
const overlay = ref(null);

const myCourses = ref([]);
const teaActiveTasks = ref([]);
const pendingList = ref([]);
const doneList = ref([]);
const approvalTab = ref('pending');

const showCreateCourse = ref(false);
const newCourseName = ref('');
const submitLoading = ref(false);

const manageTask = ref(null);
const approvalItem = ref(null);
const detailCourse = ref(null);
const statsTask = ref(null);
const statsCourse = ref(null);

const greet = computed(() => {
  const h = new Date().getHours();
  return h < 6 ? '夜深了' : h < 9 ? '早上好' : h < 12 ? '上午好' : h < 14 ? '中午好' : h < 18 ? '下午好' : '晚上好';
});
const today = computed(() => {
  const d = new Date();
  const w = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} 星期${w}`;
});
const navTitle = computed(() => ({ home: '首页', courses: '我的课程', approvals: '审批中心', me: '个人中心' })[activeTab.value]);

// 数据加载
async function loadAll() { await Promise.all([loadCourses(), loadApprovals()]); }
async function loadCourses() {
  myCourses.value = (await api('GET', '/courses')).courses;
  await loadTeaActiveTasks();
}
async function loadTeaActiveTasks() {
  teaActiveTasks.value = [];
  for (const c of myCourses.value) {
    const { tasks } = await api('GET', '/signin-tasks?course_id=' + c.id);
    const active = tasks.find((t) => t.status === 'active');
    if (active) teaActiveTasks.value.push({ ...active, course_name: c.name, code: active.code });
  }
}
async function loadApprovals() {
  const [appeals, leaves, doneAppeals, doneLeaves] = await Promise.all([
    api('GET', '/appeals?status=pending'),
    api('GET', '/leaves?status=pending'),
    Promise.all([
      api('GET', '/appeals?status=approved'),
      api('GET', '/appeals?status=rejected'),
    ]),
    Promise.all([
      api('GET', '/leaves?status=approved'),
      api('GET', '/leaves?status=rejected'),
    ]),
  ]);
  const mix = (arr, kind) => arr.map((x) => ({ ...x, kind }));
  pendingList.value = [...mix(appeals.appeals, 'appeal'), ...mix(leaves.leaves, 'leave')].sort((a, b) => new Date(b.created_at) - new Date(a.created_at));
  const doneAppealAll = [...doneAppeals[0].appeals, ...doneAppeals[1].appeals];
  const doneLeaveAll = [...doneLeaves[0].leaves, ...doneLeaves[1].leaves];
  doneList.value = [...mix(doneAppealAll, 'appeal'), ...mix(doneLeaveAll, 'leave')].sort((a, b) => new Date(b.reviewed_at) - new Date(a.reviewed_at));
}

// 二级页面打开/关闭
function openCreateTask() { overlay.value = 'createTask'; }
function openTaskManage(t) { manageTask.value = t; overlay.value = 'taskManage'; }
function openApprovalDetail(item) { approvalItem.value = item; overlay.value = 'approvalDetail'; }
function openTaskStats(t) { statsTask.value = t; overlay.value = 'taskStats'; }
function openCourseStats(c) { statsCourse.value = c; overlay.value = 'courseStats'; }
function openCourseDetail(c) { detailCourse.value = c; overlay.value = 'courseDetail'; }
function closeOverlay() { overlay.value = null; loadAll(); }
function onReviewed() { overlay.value = null; loadApprovals(); }

// 创建课程
async function createCourse() {
  if (!newCourseName.value.trim()) return toast('请输入课程名');
  submitLoading.value = true;
  try {
    const r = await api('POST', '/courses', { name: newCourseName.value.trim() });
    ElMessageBox.alert('邀请码:' + r.invite_code + '(请口头告知学生)', '创建成功', { confirmButtonText: '知道了' });
    showCreateCourse.value = false;
    newCourseName.value = '';
    await loadAll();
  } catch (e) { toast(e.message); } finally { submitLoading.value = false; }
}

onMounted(() => loadAll());
</script>

<template>
  <el-container class="shell">
    <el-aside width="220px" class="sidebar">
      <div class="brand"><span class="brand-mark">⏰</span> 早八签到</div>
      <el-menu :default-active="activeTab" @select="(k) => (activeTab = k)">
        <el-menu-item index="home"><el-icon><HomeFilled /></el-icon><span>首页</span></el-menu-item>
        <el-menu-item index="courses"><el-icon><Collection /></el-icon><span>我的课程</span></el-menu-item>
        <el-menu-item index="approvals">
          <el-icon><Tickets /></el-icon>
          <span>审批中心</span>
          <el-badge v-if="pendingList.length" :value="pendingList.length" type="danger" style="margin-left:8px;" />
        </el-menu-item>
        <el-menu-item index="me"><el-icon><User /></el-icon><span>个人中心</span></el-menu-item>
      </el-menu>
      <div class="sidebar-user">
        <div class="avatar">{{ user.name[0] }}</div>
        <div class="who"><b>{{ user.name }}</b><span>教师 · {{ user.account }}</span></div>
        <el-tooltip content="退出登录" placement="top">
          <el-button link :icon="SwitchButton" @click="emit('logout')" />
        </el-tooltip>
      </div>
    </el-aside>

    <el-container>
      <el-header class="topbar">
        <div class="topbar-title">{{ navTitle }}</div>
        <div class="topbar-right"><span>{{ today }}</span></div>
      </el-header>

      <el-main class="main">
        <div class="page">
          <!-- 首页 -->
          <template v-if="activeTab === 'home'">
            <div class="greet">{{ greet }},{{ user.name }}</div>
            <div class="muted" style="margin-top:6px;">{{ today }}</div>

            <div style="margin:20px 0 4px;">
              <el-button type="primary" size="large" :icon="Plus" @click="openCreateTask">发起签到</el-button>
            </div>

            <div class="section-title">进行中签到</div>
            <el-empty v-if="!teaActiveTasks.length" description="今天还没有进行中的签到" :image-size="90" />
            <div v-else class="card-grid">
              <div v-for="t in teaActiveTasks" :key="t.id" class="task-card clickable" @click="openTaskManage(t)">
                <div class="task-title">
                  {{ t.course_name }}
                  <el-tag size="small" effect="plain" :type="t.type === 'code' ? 'info' : 'success'">
                    {{ t.type === 'code' ? '签到码' : '定位' }}
                  </el-tag>
                </div>
                <div class="task-sub">签到码 <b style="letter-spacing:2px;">{{ t.code }}</b> · 截止 {{ fmtTime(t.end_time) }}</div>
                <div class="task-foot">
                  <span class="countdown" :class="{ warn: remaining(t.end_time, now) <= 900000 }">{{ fmtCountdown(t.end_time, now) }}</span>
                  <el-button size="small" type="primary" plain>查看名单</el-button>
                </div>
              </div>
            </div>

            <div class="section-title">
              我的课程
              <el-button link type="primary" @click="activeTab = 'courses'">课程管理</el-button>
            </div>
            <el-row :gutter="16">
              <el-col v-for="c in myCourses" :key="c.id" :xs="24" :sm="12" :lg="8">
                <div class="course-card" style="margin-bottom:16px;" @click="openCourseDetail(c)">
                  <div>
                    <div class="course-name">{{ c.name }}</div>
                    <div class="muted" style="margin-top:4px;">邀请码 {{ c.invite_code }} · {{ c.student_count }} 人</div>
                  </div>
                  <el-icon color="#b6bec9"><ArrowRight /></el-icon>
                </div>
              </el-col>
            </el-row>
          </template>

          <!-- 课程 -->
          <template v-else-if="activeTab === 'courses'">
            <div class="section-title">
              我的课程({{ myCourses.length }})
              <el-button type="primary" :icon="Plus" @click="showCreateCourse = true">创建课程</el-button>
            </div>
            <el-empty v-if="!myCourses.length" description="还没有创建任何课程" :image-size="110" />
            <el-table v-else :data="myCourses" border stripe>
              <el-table-column prop="name" label="课程名称" min-width="180" />
              <el-table-column prop="invite_code" label="邀请码" width="140">
                <template #default="{ row }"><b style="letter-spacing:2px;">{{ row.invite_code }}</b></template>
              </el-table-column>
              <el-table-column prop="student_count" label="学生人数" width="120" />
              <el-table-column label="操作" width="260">
                <template #default="{ row }">
                  <el-button link type="primary" @click="openCourseDetail(row)">课程详情</el-button>
                  <el-button link type="primary" @click="openCourseStats(row)">整体统计</el-button>
                  <el-button link :icon="CopyDocument" @click="copyCode(row.invite_code)">复制码</el-button>
                </template>
              </el-table-column>
            </el-table>
          </template>

          <!-- 审批中心 -->
          <template v-else-if="activeTab === 'approvals'">
            <el-tabs v-model="approvalTab">
              <el-tab-pane :label="`待审批 (${pendingList.length})`" name="pending">
                <el-empty v-if="!pendingList.length" description="没有待审批的申请 🎉" :image-size="100" />
                <el-table v-else :data="pendingList" border stripe>
                  <el-table-column label="类型" width="90">
                    <template #default="{ row }">
                      <el-tag :type="row.kind === 'appeal' ? 'warning' : 'primary'" effect="light">
                        {{ row.kind === 'appeal' ? '补签' : '请假' }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="student_name" label="学生" width="120" />
                  <el-table-column prop="account" label="学号" width="120" />
                  <el-table-column prop="course_name" label="课程" min-width="130" />
                  <el-table-column label="时间" min-width="190">
                    <template #default="{ row }">
                      {{ row.kind === 'appeal' ? fmtTime(row.start_time) : fmtTime(row.start_time) + ' ~ ' + fmtTime(row.end_time) }}
                    </template>
                  </el-table-column>
                  <el-table-column prop="reason" label="理由" min-width="180" show-overflow-tooltip />
                  <el-table-column label="操作" width="100" fixed="right">
                    <template #default="{ row }">
                      <el-button link type="primary" @click="openApprovalDetail(row)">审批</el-button>
                    </template>
                  </el-table-column>
                </el-table>
              </el-tab-pane>

              <el-tab-pane label="已审批" name="done">
                <el-empty v-if="!doneList.length" description="暂无已审批记录" :image-size="100" />
                <el-table v-else :data="doneList" border stripe>
                  <el-table-column label="类型" width="90">
                    <template #default="{ row }">
                      <el-tag :type="row.kind === 'appeal' ? 'warning' : 'primary'" effect="light">
                        {{ row.kind === 'appeal' ? '补签' : '请假' }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="student_name" label="学生" width="120" />
                  <el-table-column prop="account" label="学号" width="120" />
                  <el-table-column prop="course_name" label="课程" min-width="130" />
                  <el-table-column prop="reason" label="理由" min-width="180" show-overflow-tooltip />
                  <el-table-column label="结果" width="100">
                    <template #default="{ row }">
                      <el-tag :type="row.status === 'approved' ? 'success' : 'danger'" effect="light">
                        {{ row.status === 'approved' ? '通过' : '拒绝' }}
                      </el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="teacher_comment" label="审批意见" min-width="160" show-overflow-tooltip>
                    <template #default="{ row }">{{ row.teacher_comment || '—' }}</template>
                  </el-table-column>
                </el-table>
              </el-tab-pane>
            </el-tabs>
          </template>

          <!-- 个人中心 -->
          <template v-else>
            <div class="profile-card">
              <div class="profile-head">
                <div class="profile-avatar">{{ user.name[0] }}</div>
                <div>
                  <div class="profile-name">{{ user.name }}</div>
                  <div class="muted">{{ user.account }} · 教师</div>
                </div>
              </div>
              <el-descriptions :column="2" border style="margin-top:24px;">
                <el-descriptions-item label="账号">{{ user.account }}</el-descriptions-item>
                <el-descriptions-item label="身份">教师</el-descriptions-item>
                <el-descriptions-item label="创建课程">{{ myCourses.length }} 门</el-descriptions-item>
                <el-descriptions-item label="待审批">{{ pendingList.length }} 条</el-descriptions-item>
              </el-descriptions>
              <el-button type="danger" plain style="margin-top:24px;" @click="emit('logout')">退出登录</el-button>
            </div>
          </template>
        </div>
      </el-main>
    </el-container>
  </el-container>

  <!-- 创建课程弹窗 -->
  <el-dialog v-model="showCreateCourse" title="创建课程" width="420px" align-center>
    <el-form label-position="top" @submit.prevent="createCourse">
      <el-form-item label="课程名称">
        <el-input v-model="newCourseName" size="large" placeholder="如:大学英语" @keyup.enter="createCourse" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="showCreateCourse = false">取消</el-button>
      <el-button type="primary" :loading="submitLoading" @click="createCourse">创建</el-button>
    </template>
  </el-dialog>

  <!-- 二级页面 -->
  <CreateTaskPage v-if="overlay === 'createTask'" :courses="myCourses" @close="closeOverlay" @created="closeOverlay" />
  <TaskManagePage v-if="overlay === 'taskManage'" :task="manageTask" @close="closeOverlay" />
  <ApprovalDetailPage v-if="overlay === 'approvalDetail'" :item="approvalItem" @close="closeOverlay" @reviewed="onReviewed" />
  <TaskStatsPage v-if="overlay === 'taskStats'" :task="statsTask" @close="closeOverlay" />
  <CourseStatsPage v-if="overlay === 'courseStats'" :course="statsCourse" @close="closeOverlay" />
  <CourseDetailPage v-if="overlay === 'courseDetail'" :course="detailCourse" role="teacher"
    @close="closeOverlay" @open-course-stats="openCourseStats" @open-task-manage="openTaskManage" @open-task-stats="openTaskStats" />
</template>
