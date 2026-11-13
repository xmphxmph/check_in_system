<script setup>
// 学生端:侧边栏 + 顶栏布局,首页/课程/我的申请/个人中心
import { ref, computed, onMounted } from 'vue';
import { ElMessage } from 'element-plus';
import { HomeFilled, Collection, Tickets, User, SwitchButton, Plus, ArrowRight } from '@element-plus/icons-vue';
import TaskCard from '../components/TaskCard.vue';
import SignPage from './SignPage.vue';
import AppealApplyPage from './AppealApplyPage.vue';
import LeaveApplyPage from './LeaveApplyPage.vue';
import CourseDetailPage from './CourseDetailPage.vue';
import { api, toast } from '../api.js';
import { fmtTime, statusText, statusType } from '../utils.js';

const props = defineProps({ user: { type: Object, required: true } });
const emit = defineEmits(['logout']);

const activeTab = ref('home');
const overlay = ref(null);

const activeTasks = ref([]);
const appealAvailable = ref([]);
const myAppeals = ref([]);
const myLeaves = ref([]);
const applyTab = ref('appeal');
const myCourses = ref([]);

const showJoinPopup = ref(false);
const joinCode = ref('');

const signTask = ref(null);
const appealTask = ref(null);
const leavePresetCourse = ref(null);
const detailCourse = ref(null);

const greet = computed(() => {
  const h = new Date().getHours();
  return h < 6 ? '夜深了' : h < 9 ? '早上好' : h < 12 ? '上午好' : h < 14 ? '中午好' : h < 18 ? '下午好' : '晚上好';
});
const today = computed(() => {
  const d = new Date();
  const w = ['日', '一', '二', '三', '四', '五', '六'][d.getDay()];
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} 星期${w}`;
});
const navTitle = computed(() => ({ home: '首页', courses: '我的课程', applies: '我的申请', me: '个人中心' })[activeTab.value]);

// 数据加载
async function loadAll() {
  await Promise.all([loadActiveTasks(), loadAppealAvailable(), loadMyAppeals(), loadMyLeaves(), loadCourses()]);
}
async function loadActiveTasks() { try { activeTasks.value = (await api('GET', '/signin-tasks/active')).tasks; } catch {} }
async function loadAppealAvailable() { try { appealAvailable.value = (await api('GET', '/appeals/available')).tasks; } catch {} }
async function loadMyAppeals() { try { myAppeals.value = (await api('GET', '/appeals/my')).appeals; } catch {} }
async function loadMyLeaves() { try { myLeaves.value = (await api('GET', '/leaves/my')).leaves; } catch {} }
async function loadCourses() { try { myCourses.value = (await api('GET', '/courses')).courses; } catch {} }

// 二级页面打开/关闭
function openSign(t) { signTask.value = t; overlay.value = 'sign'; }
function openAppealApply(t) { appealTask.value = t; overlay.value = 'appealApply'; }
function openAppealList() { if (appealAvailable.value.length) openAppealApply(appealAvailable.value[0]); }
function openLeaveApply(course) { leavePresetCourse.value = course; overlay.value = 'leaveApply'; }
function openCourseDetail(c) { detailCourse.value = c; overlay.value = 'courseDetail'; }
function closeOverlay() { overlay.value = null; loadAll(); }

// 加入课程
async function joinCourse() {
  if (joinCode.value.length !== 6) return toast('请输入 6 位邀请码');
  try {
    const r = await api('POST', '/courses/join', { invite_code: joinCode.value });
    ElMessage.success('已加入:' + r.course_name);
    showJoinPopup.value = false;
    joinCode.value = '';
    await loadAll();
  } catch (e) { toast(e.message); }
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
        <el-menu-item index="applies"><el-icon><Tickets /></el-icon><span>我的申请</span></el-menu-item>
        <el-menu-item index="me"><el-icon><User /></el-icon><span>个人中心</span></el-menu-item>
      </el-menu>
      <div class="sidebar-user">
        <div class="avatar">{{ user.name[0] }}</div>
        <div class="who"><b>{{ user.name }}</b><span>学生 · {{ user.account }}</span></div>
        <el-tooltip content="退出登录" placement="top">
          <el-button link :icon="SwitchButton" @click="emit('logout')" />
        </el-tooltip>
      </div>
    </el-aside>

    <el-container>
      <el-header class="topbar">
        <div class="topbar-title">{{ navTitle }}</div>
        <div class="topbar-right">
          <span>{{ today }}</span>
        </div>
      </el-header>

      <el-main class="main">
        <div class="page">
          <!-- 首页 -->
          <template v-if="activeTab === 'home'">
            <div class="greet">{{ greet }},{{ user.name }}</div>
            <div class="muted" style="margin-top:6px;">{{ today }}</div>

            <el-alert
              v-if="appealAvailable.length"
              type="warning"
              :closable="false"
              show-icon
              style="margin-top:18px;cursor:pointer;"
              title="你有缺勤记录,可在 24 小时内申请补签"
              @click="openAppealList"
            />

            <div class="section-title">进行中签到</div>
            <el-empty v-if="!activeTasks.length" description="当前没有进行中的签到" :image-size="90" />
            <div v-else class="card-grid">
              <task-card v-for="t in activeTasks" :key="t.id" :task="t" @sign="openSign(t)" @appeal="openAppealApply(t)" />
            </div>

            <div class="section-title">
              我的课程
              <el-button link type="primary" @click="activeTab = 'courses'">全部课程</el-button>
            </div>
            <el-empty v-if="!myCourses.length" description="还没有加入任何课程" :image-size="90" />
            <div v-else class="card-grid">
              <div v-for="c in myCourses" :key="c.id" class="course-card" @click="openCourseDetail(c)">
                <div>
                  <div class="course-name">{{ c.name }}</div>
                  <div class="muted" style="margin-top:4px;">{{ c.teacher_name }}</div>
                </div>
                <el-icon color="#b6bec9"><ArrowRight /></el-icon>
              </div>
            </div>
          </template>

          <!-- 课程 -->
          <template v-else-if="activeTab === 'courses'">
            <div class="section-title">
              我的课程({{ myCourses.length }})
              <el-button type="primary" :icon="Plus" @click="showJoinPopup = true">输入邀请码加入课程</el-button>
            </div>
            <el-empty v-if="!myCourses.length" description="还没有加入任何课程" :image-size="110" />
            <el-row v-else :gutter="16">
              <el-col v-for="c in myCourses" :key="c.id" :xs="24" :sm="12" :lg="8">
                <div class="course-card" style="margin-bottom:16px;height:100%;" @click="openCourseDetail(c)">
                  <div>
                    <div class="course-name">{{ c.name }}</div>
                    <div class="muted" style="margin-top:4px;">{{ c.teacher_name }}</div>
                  </div>
                  <el-icon color="#b6bec9"><ArrowRight /></el-icon>
                </div>
              </el-col>
            </el-row>
          </template>

          <!-- 我的申请 -->
          <template v-else-if="activeTab === 'applies'">
            <el-tabs v-model="applyTab">
              <el-tab-pane label="补签申请" name="appeal">
                <el-empty v-if="!myAppeals.length" description="暂无补签申请" :image-size="100" />
                <el-table v-else :data="myAppeals" border stripe>
                  <el-table-column prop="course_name" label="课程" min-width="140" />
                  <el-table-column label="任务时间" width="140">
                    <template #default="{ row }">{{ fmtTime(row.start_time) }}</template>
                  </el-table-column>
                  <el-table-column prop="reason" label="理由" min-width="200" show-overflow-tooltip />
                  <el-table-column label="状态" width="110">
                    <template #default="{ row }">
                      <el-tag :type="statusType(row.status)" effect="light">{{ statusText(row.status) }}</el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="teacher_comment" label="教师意见" min-width="160" show-overflow-tooltip>
                    <template #default="{ row }">{{ row.teacher_comment || '—' }}</template>
                  </el-table-column>
                </el-table>
              </el-tab-pane>

              <el-tab-pane label="请假申请" name="leave">
                <el-empty v-if="!myLeaves.length" description="暂无请假申请" :image-size="100" />
                <el-table v-else :data="myLeaves" border stripe>
                  <el-table-column prop="course_name" label="课程" min-width="140" />
                  <el-table-column label="类型" width="90">
                    <template #default="{ row }">
                      {{ row.leave_type === 'sick' ? '病假' : row.leave_type === 'personal' ? '事假' : '其他' }}
                    </template>
                  </el-table-column>
                  <el-table-column label="时间范围" min-width="200">
                    <template #default="{ row }">{{ fmtTime(row.start_time) }} ~ {{ fmtTime(row.end_time) }}</template>
                  </el-table-column>
                  <el-table-column prop="reason" label="理由" min-width="200" show-overflow-tooltip />
                  <el-table-column label="状态" width="110">
                    <template #default="{ row }">
                      <el-tag :type="statusType(row.status)" effect="light">{{ statusText(row.status) }}</el-tag>
                    </template>
                  </el-table-column>
                  <el-table-column prop="teacher_comment" label="教师意见" min-width="160" show-overflow-tooltip>
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
                  <div class="muted">{{ user.account }} · 学生</div>
                </div>
              </div>
              <el-descriptions :column="2" border style="margin-top:24px;">
                <el-descriptions-item label="账号">{{ user.account }}</el-descriptions-item>
                <el-descriptions-item label="身份">学生</el-descriptions-item>
                <el-descriptions-item label="已加入课程">{{ myCourses.length }} 门</el-descriptions-item>
                <el-descriptions-item label="我的申请">{{ myAppeals.length + myLeaves.length }} 条</el-descriptions-item>
              </el-descriptions>
              <el-button type="danger" plain style="margin-top:24px;" @click="emit('logout')">退出登录</el-button>
            </div>
          </template>
        </div>
      </el-main>
    </el-container>
  </el-container>

  <!-- 加入课程弹窗 -->
  <el-dialog v-model="showJoinPopup" title="加入课程" width="420px" align-center>
    <el-form label-position="top" @submit.prevent="joinCourse">
      <el-form-item label="6 位邀请码">
        <el-input v-model="joinCode" maxlength="6" size="large" placeholder="请输入老师提供的邀请码" @keyup.enter="joinCourse" />
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="showJoinPopup = false">取消</el-button>
      <el-button type="primary" @click="joinCourse">加入</el-button>
    </template>
  </el-dialog>

  <!-- 二级页面 -->
  <SignPage v-if="overlay === 'sign'" :task="signTask" @signed="closeOverlay" />
  <AppealApplyPage v-if="overlay === 'appealApply'" :task="appealTask" @submitted="closeOverlay" />
  <LeaveApplyPage v-if="overlay === 'leaveApply'" :courses="myCourses" :preset-course="leavePresetCourse" @submitted="closeOverlay" />
  <CourseDetailPage v-if="overlay === 'courseDetail'" :course="detailCourse" role="student"
    @close="closeOverlay" @open-leave="openLeaveApply" @open-appeal="openAppealApply" />
</template>
