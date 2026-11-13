<script setup>
// 根组件:管理登录态,按角色挂载登录页 / 学生端 / 教师端
import { ref, onMounted } from 'vue';
import { setToken, clearToken, set401Handler } from './api.js';
import LoginPage from './views/LoginPage.vue';
import StudentHome from './views/StudentHome.vue';
import TeacherHome from './views/TeacherHome.vue';

const user = ref(JSON.parse(localStorage.getItem('zb_user') || 'null'));

function onLogin({ token, u }) {
  setToken(token);
  localStorage.setItem('zb_token', token);
  localStorage.setItem('zb_user', JSON.stringify(u));
  user.value = u;
}

function logout() {
  clearToken();
  localStorage.removeItem('zb_token');
  localStorage.removeItem('zb_user');
  user.value = null;
}

onMounted(() => set401Handler(logout));
</script>

<template>
  <LoginPage v-if="!user" @login="onLogin" />
  <StudentHome v-else-if="user.role === 'student'" :user="user" @logout="logout" />
  <TeacherHome v-else :user="user" @logout="logout" />
</template>
