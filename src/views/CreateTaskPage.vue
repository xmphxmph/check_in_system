<script setup>
// 发起签到页:码签到 / 定位签到(Leaflet 地图选中心点)
import { ref, reactive, watch, nextTick, onUnmounted } from 'vue';
import { ElMessage, ElMessageBox } from 'element-plus';
import L from 'leaflet';
import OverlayPage from '../components/OverlayPage.vue';
import { api, toast } from '../api.js';

const props = defineProps({ courses: { type: Array, default: () => [] } });
const emit = defineEmits(['close', 'created']);

const createForm = reactive({ course_id: null, course_name: '', type: 'code', center_lat: 39.908823, center_lng: 116.397470, radius_m: 300, end_time: '' });
const quickMinute = ref(10);
const submitLoading = ref(false);

let map = null;
let mapMarker = null;

setQuickDuration(10);
function setQuickDuration(min) {
  quickMinute.value = min;
  const d = new Date(Date.now() + min * 60000);
  const p = (n) => String(n).padStart(2, '0');
  createForm.end_time = `${d.getFullYear()}-${p(d.getMonth() + 1)}-${p(d.getDate())}T${p(d.getHours())}:${p(d.getMinutes())}`;
}

watch(() => createForm.type, (v) => { if (v === 'location') nextTick(initMap); });

function initMap() {
  if (map) { map.invalidateSize(); return; }
  map = L.map('map').setView([createForm.center_lat, createForm.center_lng], 16);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', { maxZoom: 19 }).addTo(map);
  const pin = L.divIcon({ className: '', html: '<div style="font-size:26px;">📍</div>', iconSize: [26, 26], iconAnchor: [13, 26] });
  mapMarker = L.marker([createForm.center_lat, createForm.center_lng], { draggable: true, icon: pin }).addTo(map);
  const setCenter = (latlng) => { createForm.center_lat = Number(latlng.lat.toFixed(6)); createForm.center_lng = Number(latlng.lng.toFixed(6)); mapMarker.setLatLng(latlng); };
  mapMarker.on('dragend', () => setCenter(mapMarker.getLatLng()));
  map.on('click', (e) => setCenter(e.latlng));
  setTimeout(() => map.invalidateSize(), 200);
}

async function createTask() {
  if (!createForm.course_id) return toast('请选择课程');
  if (!createForm.end_time || new Date(createForm.end_time) <= new Date()) return toast('截止时间不合法');
  submitLoading.value = true;
  try {
    const body = { course_id: createForm.course_id, type: createForm.type, end_time: new Date(createForm.end_time).toISOString() };
    if (createForm.type === 'location') Object.assign(body, { center_lat: createForm.center_lat, center_lng: createForm.center_lng, radius_m: createForm.radius_m });
    const r = await api('POST', '/signin-tasks', body);
    if (createForm.type === 'code') {
      ElMessageBox.alert('签到码:' + r.code, '签到已创建', { confirmButtonText: '查看名单' })
        .then(() => emit('created')).catch(() => emit('created'));
    } else {
      ElMessage.success('定位签到已创建');
      emit('created');
    }
  } catch (e) { toast(e.message); } finally { submitLoading.value = false; }
}

onUnmounted(() => { if (map) { map.remove(); map = null; mapMarker = null; } });
</script>

<template>
  <OverlayPage title="发起签到" width="760px" @close="$emit('close')">
    <el-form label-position="top" @submit.prevent="createTask">
      <div class="form-row">
        <el-form-item label="课程">
          <el-select v-model="createForm.course_id" placeholder="请选择课程" style="width:100%;">
            <el-option v-for="c in courses" :key="c.id" :label="c.name" :value="c.id" />
          </el-select>
        </el-form-item>
        <el-form-item label="方式">
          <el-radio-group v-model="createForm.type">
            <el-radio value="code">🔢 签到码</el-radio>
            <el-radio value="location">📍 定位签到</el-radio>
          </el-radio-group>
        </el-form-item>
      </div>

      <div v-if="createForm.type === 'location'" style="margin-top:4px;">
        <div class="map-wrap">
          <div class="center-pin">📍</div>
          <div id="map"></div>
        </div>
        <div class="muted" style="margin:8px 2px;">拖动地图或点击地图选择中心点</div>
        <div class="radius-pill">
          <div v-for="r in [100, 300, 500]" :key="r" class="pill" :class="{ active: createForm.radius_m === r }" @click="createForm.radius_m = r">{{ r }} 米</div>
        </div>
        <div class="muted" style="margin:8px 2px;">中心点:{{ createForm.center_lat.toFixed(6) }}, {{ createForm.center_lng.toFixed(6) }}</div>
      </div>

      <div style="margin-top:8px;">
        <div class="form-label">签到时长</div>
        <div class="radius-pill">
          <div v-for="d in [5, 10, 15, 30, 45]" :key="d" class="pill" :class="{ active: quickMinute === d }" @click="setQuickDuration(d)">{{ d }} 分钟</div>
        </div>
        <el-form-item label="截止时间" style="margin-top:16px;">
          <el-date-picker
            v-model="createForm.end_time" type="datetime" value-format="YYYY-MM-DDTHH:mm"
            placeholder="选择截止时间" style="width:280px;"
          />
        </el-form-item>
      </div>
    </el-form>

    <div class="dialog-footer">
      <el-button @click="$emit('close')">取消</el-button>
      <el-button type="primary" :loading="submitLoading" @click="createTask">创建签到</el-button>
    </div>
  </OverlayPage>
</template>
