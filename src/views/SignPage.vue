<script setup>
// 签到页:码签到(输 6 位码)/ 定位签到(实时算距离)
import { ref, onMounted, onUnmounted, nextTick } from 'vue';
import { ElMessageBox } from 'element-plus';
import OverlayPage from '../components/OverlayPage.vue';
import { api, toast } from '../api.js';
import { fmtTime, fmtCountdown, remaining } from '../utils.js';
import { useNow } from '../useNow.js';

const props = defineProps({ task: { type: Object, required: true } });
const emit = defineEmits(['signed']);

const now = useNow();
const signCode = ref('');
const signLoading = ref(false);
const codeInput = ref(null);

const locStatus = ref('loading');
const locDist = ref(0);
const locAccuracy = ref(0);
const locLat = ref(null);
const locLng = ref(null);
let locWatch = null;

function focusCodeInput() { nextTick(() => codeInput.value && codeInput.value.focus()); }

function onCodeInput(v) {
  signCode.value = String(v).replace(/\D/g, '').slice(0, 6);
}

function startLocate() {
  locStatus.value = 'loading';
  if (!navigator.geolocation) { locStatus.value = 'denied'; return toast('浏览器不支持定位'); }
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      locLat.value = pos.coords.latitude;
      locLng.value = pos.coords.longitude;
      locAccuracy.value = pos.coords.accuracy;
      updateDist();
      locStatus.value = 'ok';
      locWatch = navigator.geolocation.watchPosition(
        (p) => { locLat.value = p.coords.latitude; locLng.value = p.coords.longitude; locAccuracy.value = p.coords.accuracy; updateDist(); },
        () => { locStatus.value = 'error'; },
        { enableHighAccuracy: true }
      );
    },
    () => { locStatus.value = 'denied'; }
  );
}

function updateDist() {
  if (props.task && locLat.value != null) {
    const R = 6371000, toRad = (d) => d * Math.PI / 180;
    const dLat = toRad(locLat.value - props.task.center_lat), dLng = toRad(locLng.value - props.task.center_lng);
    const a = Math.sin(dLat / 2) ** 2 + Math.cos(toRad(props.task.center_lat)) * Math.cos(toRad(locLat.value)) * Math.sin(dLng / 2) ** 2;
    locDist.value = R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
  }
}

async function doSign() {
  signLoading.value = true;
  try {
    const body = props.task.type === 'code' ? { code: signCode.value } : { lat: locLat.value, lng: locLng.value };
    await api('POST', '/signin-tasks/' + props.task.id + '/sign', body);
    signLoading.value = false;
    ElMessageBox.alert(new Date().toLocaleTimeString('zh-CN', { hour12: false }), '签到成功 ✓', {
      confirmButtonText: '返回',
      type: 'success',
    }).then(() => emit('signed')).catch(() => emit('signed'));
  } catch (e) {
    signLoading.value = false;
    toast(e.message);
    signCode.value = '';
    focusCodeInput();
  }
}

onMounted(() => {
  if (props.task.type === 'location') startLocate(); else focusCodeInput();
});
onUnmounted(() => { if (locWatch) { navigator.geolocation.clearWatch(locWatch); locWatch = null; } });
</script>

<template>
  <OverlayPage title="签到" width="520px" @close="$emit('signed')">
    <div class="task-card">
      <div class="task-title">
        {{ task.course_name }}
        <el-tag size="small" effect="plain">{{ task.type === 'code' ? '签到码签到' : '定位签到' }}</el-tag>
      </div>
      <div class="task-sub">{{ task.teacher_name }}</div>
      <div class="task-foot">
        <span class="countdown" :class="{ warn: remaining(task.end_time, now) <= 900000 }">{{ fmtCountdown(task.end_time, now) }}</span>
        <span class="muted">截止 {{ fmtTime(task.end_time) }}</span>
      </div>
    </div>

    <div v-if="task.type === 'code'" style="background:#fff;border:1px solid var(--border);border-radius:10px;padding:24px;">
      <div class="muted" style="text-align:center;margin-bottom:18px;">请输入老师展示的 6 位签到码</div>
      <el-input
        ref="codeInput"
        :model-value="signCode"
        class="code-input"
        maxlength="6"
        inputmode="numeric"
        placeholder="000000"
        @update:model-value="onCodeInput"
        @keyup.enter="doSign"
      />
      <el-button type="primary" size="large" style="width:100%;margin-top:22px;" :loading="signLoading" @click="doSign">签 到</el-button>
    </div>

    <div v-else class="loc-status">
      <div class="muted">正在获取你的位置…</div>
      <div class="loc-dist" :class="locStatus === 'ok' && locDist <= task.radius_m ? 'loc-ok' : ''">
        {{ locStatus === 'ok' ? Math.round(locDist) + ' 米' : locStatus === 'denied' ? '定位被拒绝' : '定位中…' }}
      </div>
      <div v-if="locStatus === 'ok'" :class="locDist <= task.radius_m ? 'loc-ok' : 'loc-bad'">
        {{ locDist <= task.radius_m ? '已在签到范围内 ✓' : '距签到点约 ' + Math.round(locDist) + ' 米,请在范围内签到' }}
      </div>
      <div class="muted" v-if="locAccuracy > 50">定位精度较低(±{{ Math.round(locAccuracy) }}m),请在开阔处重试</div>
      <el-button v-if="locStatus === 'denied' || locStatus === 'error'" style="margin-top:20px;" @click="startLocate">重试定位</el-button>
      <el-button
        v-else
        type="primary"
        size="large"
        style="margin-top:20px;width:200px;"
        :disabled="locStatus !== 'ok' || locDist > task.radius_m"
        :loading="signLoading"
        @click="doSign"
      >签 到</el-button>
    </div>
  </OverlayPage>
</template>
