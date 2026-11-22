<script setup>
/**
 * 選檔案按鈕：點了開檔案選擇視窗，選好就 emit('pick', file)；按鈕文字用插槽傳入
 * accept 決定能選哪些檔案（預設只有 WAV；也可以加上 .json 分析結果檔）
 */
defineProps({
  accept: { type: String, default: '.wav,audio/wav' },
})

const emit = defineEmits(['pick'])

function onChange(e) {
  const file = e.target.files[0]
  e.target.value = ''
  if (file) emit('pick', file)
}
</script>

<template>
  <label class="btn pick">
    <input type="file" :accept="accept" class="pick-input" @change="onChange" />
    <slot>選擇檔案</slot>
  </label>
</template>

<style scoped>
.pick {
  position: relative;
  overflow: hidden;
  cursor: pointer;
}

.pick:focus-within {
  outline: 3px solid var(--accent);
  outline-offset: 2px;
}

.pick-input {
  position: absolute;
  inset: 0;
  opacity: 0;
  cursor: pointer;
}
</style>
