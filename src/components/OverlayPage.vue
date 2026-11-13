<script setup>
// 二级页面通用外壳:桌面端以居中弹窗承载(替代移动端全屏 overlay)
import { ref } from 'vue';

defineProps({
  title: { type: String, default: '' },
  width: { type: String, default: '560px' },
});
const emit = defineEmits(['close']);

const visible = ref(true);
</script>

<template>
  <el-dialog
    v-model="visible"
    :title="title"
    :width="width"
    align-center
    append-to-body
    :close-on-click-modal="false"
    class="detail-dialog"
    @closed="emit('close')"
  >
    <slot />
  </el-dialog>
</template>
