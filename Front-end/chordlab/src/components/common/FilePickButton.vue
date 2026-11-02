<script setup>
/**
 * 「換檔案」按鈕：點了開檔案選擇視窗，選好就 emit('pick', file)
 */
const emit = defineEmits(['pick'])

function onChange(e) {
  const file = e.target.files[0]
  e.target.value = ''
  if (file) emit('pick', file)
}
</script>

<template>
  <label class="btn pick">
    <input type="file" accept=".wav,audio/wav" class="pick-input" @change="onChange" />
    <slot>換檔案</slot>
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
