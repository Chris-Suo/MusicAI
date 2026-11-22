<script setup>
/**
 * 返回上傳頁前的確認：問使用者要不要先下載分析結果
 * - 用瀏覽器內建的 <dialog>（showModal）：會擋住後面的畫面、焦點留在對話框裡、Esc 等於取消
 * - emit：download（下載並返回）、leave（直接返回）、cancel（留在結果頁）
 */
import { ref, watch, nextTick } from 'vue'
import AppIcon from '@/components/common/AppIcon.vue'

const props = defineProps({
  open: { type: Boolean, default: false },
  fileName: { type: String, default: '' },
})

const emit = defineEmits(['download', 'leave', 'cancel'])

const dialogEl = ref(null)
const primaryEl = ref(null)

watch(
  () => props.open,
  async (open) => {
    await nextTick()
    const d = dialogEl.value
    if (!d) return
    if (open && !d.open) {
      d.showModal()
      primaryEl.value?.focus()
    } else if (!open && d.open) {
      d.close()
    }
  },
)

// Esc 或點對話框外面的暗色區域 → 取消
function onCancel(e) {
  e.preventDefault()
  emit('cancel')
}
function onBackdrop(e) {
  if (e.target === dialogEl.value) emit('cancel')
}
</script>

<template>
  <dialog ref="dialogEl" class="confirm" aria-labelledby="confirm-back-title" @cancel="onCancel" @click="onBackdrop">
    <div class="box">
      <h2 id="confirm-back-title" class="title">要先下載分析結果嗎？</h2>
      <p class="text">
        返回後，<strong>{{ fileName }}</strong> 的分析結果會清掉。下載的 .json 檔之後可以在上傳頁「載入之前的分析結果」。
      </p>
      <div class="actions">
        <button type="button" class="btn" @click="emit('cancel')">取消</button>
        <button type="button" class="btn" @click="emit('leave')">不下載，直接返回</button>
        <button ref="primaryEl" type="button" class="btn primary" @click="emit('download')">
          <AppIcon name="download" :size="16" />下載並返回
        </button>
      </div>
    </div>
  </dialog>
</template>

<style scoped>
.confirm {
  margin: auto;
  padding: 0;
  border: 1px solid var(--border-strong);
  border-radius: var(--radius-lg);
  background: var(--surface);
  color: var(--text);
  box-shadow: var(--shadow-md);
  width: min(480px, calc(100vw - 32px));
}

.confirm::backdrop {
  background: rgba(10, 12, 20, 0.55);
}

.box {
  padding: 1.25rem 1.5rem;
}

.title {
  font-size: 1.15rem;
  font-weight: 700;
}

.text {
  margin-top: 0.5rem;
  font-size: 0.95rem;
  color: var(--text2);
  word-break: break-word;
}

.actions {
  display: flex;
  flex-wrap: wrap;
  justify-content: flex-end;
  gap: 8px;
  margin-top: 1.25rem;
}
</style>
