<script setup>
// 登录/注册页:桌面端左右分栏,登录成功后 emit login 事件,由 App.vue 保存登录态
import { ref, reactive } from 'vue';
import { ElMessage } from 'element-plus';
import { User, Lock } from '@element-plus/icons-vue';
import { api, toast } from '../api.js';

const emit = defineEmits(['login']);

const loginForm = reactive({ account: '', password: '' });
const loginLoading = ref(false);
const showRegister = ref(false);
const regForm = reactive({ account: '', name: '', password: '', confirm: '', role: 'student' });

async function doLogin() {
  if (!loginForm.account || !loginForm.password) return toast('请输入账号和密码');
  loginLoading.value = true;
  try {
    const data = await api('POST', '/auth/login', loginForm);
    emit('login', { token: data.token, u: data.user });
    ElMessage.success('欢迎,' + data.user.name);
  } catch (e) { toast(e.message); } finally { loginLoading.value = false; }
}

async function doRegister() {
  if (regForm.password.length < 6) return toast('密码至少 6 位');
  if (regForm.password !== regForm.confirm) return toast('两次密码不一致');
  try {
    await api('POST', '/auth/register', regForm);
    showRegister.value = false;
    loginForm.account = regForm.account;
    loginForm.password = regForm.password;
    ElMessage.success('注册成功,请登录');
  } catch (e) { toast(e.message); }
}
</script>

<template>
  <div class="login-shell">
    <aside class="login-aside">
      <h1>⏰ 早八签到</h1>
      <p>面向高校课堂的签到与考勤平台,教师发起签到、学生在线签到,请假补签全流程线上审批。</p>
      <div class="feats">
        <div class="feat"><i>✓</i> 签到码 / 定位双模式签到</div>
        <div class="feat"><i>✓</i> 请假与补签在线审批</div>
        <div class="feat"><i>✓</i> 课程出勤率实时统计</div>
      </div>
    </aside>

    <main class="login-main">
      <div class="login-card">
        <h2>登录</h2>
        <div class="sub">使用学号 / 工号登录系统</div>
        <el-form label-position="top" @submit.prevent="doLogin">
          <el-form-item label="账号">
            <el-input
              v-model="loginForm.account" size="large" placeholder="学号 / 工号"
              :prefix-icon="User" autocomplete="username"
            />
          </el-form-item>
          <el-form-item label="密码">
            <el-input
              v-model="loginForm.password" size="large" type="password" show-password
              placeholder="密码" :prefix-icon="Lock" autocomplete="current-password"
              @keyup.enter="doLogin"
            />
          </el-form-item>
          <el-button type="primary" size="large" :loading="loginLoading" @click="doLogin">登 录</el-button>
        </el-form>
        <div class="login-foot">没有账号?<a @click="showRegister = true">立即注册</a></div>
        <div class="demo-tip">演示账号:教师 t001 / 学生 s001-s010,密码均为 123456</div>
      </div>
    </main>
  </div>

  <el-dialog v-model="showRegister" title="注册账号" width="420px" align-center>
    <el-form label-position="top" @submit.prevent="doRegister">
      <el-form-item label="账号">
        <el-input v-model="regForm.account" placeholder="学号 / 工号" />
      </el-form-item>
      <el-form-item label="姓名">
        <el-input v-model="regForm.name" placeholder="真实姓名" />
      </el-form-item>
      <el-form-item label="密码">
        <el-input v-model="regForm.password" type="password" show-password placeholder="至少 6 位" />
      </el-form-item>
      <el-form-item label="确认密码">
        <el-input v-model="regForm.confirm" type="password" show-password placeholder="再次输入密码" />
      </el-form-item>
      <el-form-item label="身份">
        <el-radio-group v-model="regForm.role">
          <el-radio value="student">学生</el-radio>
          <el-radio value="teacher">教师</el-radio>
        </el-radio-group>
      </el-form-item>
    </el-form>
    <template #footer>
      <el-button @click="showRegister = false">取消</el-button>
      <el-button type="primary" :loading="loginLoading" @click="doRegister">注 册</el-button>
    </template>
  </el-dialog>
</template>
