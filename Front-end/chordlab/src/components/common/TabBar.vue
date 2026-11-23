<script setup>
/**
 * 分頁列：每個分頁有圖示、名稱和重點數字（sub）
 * - v-model 是目前分頁的 id；分頁按鈕 id 為 tab-{id}，對應的內容區 id 要設成 panel-{id}
 * - 鍵盤：← → 切換、Home／End 到第一個／最後一個
 */
import AppIcon from '@/components/common/AppIcon.vue'

const props = defineProps({
  // [{ id, icon, title, sub? }]
  tabs: { type: Array, required: true },
  label: { type: String, default: '' },
})

const active = defineModel({ type: String, required: true })

function onKey(e) {
  const ids = props.tabs.map((t) => t.id)
  const i = ids.indexOf(active.value)
  const next = {
    ArrowRight: ids[(i + 1) % ids.length],
    ArrowLeft: ids[(i - 1 + ids.length) % ids.length],
    Home: ids[0],
    End: ids[ids.length - 1],
  }[e.key]
  if (!next) return
  e.preventDefault()
  active.value = next
  document.getElementById('tab-' + next)?.focus()
}
</script>

<template>
  <div class="tabs" role="tablist" :aria-label="label" :style="{ '--tab-count': tabs.length }">
    <button
      v-for="t in tabs"
      :id="'tab-' + t.id"
      :key="t.id"
      type="button"
      role="tab"
      class="tab"
      :class="{ on: active === t.id }"
      :aria-selected="active === t.id"
      :aria-controls="'panel-' + t.id"
      :tabindex="active === t.id ? 0 : -1"
      @click="active = t.id"
      @keydown="onKey"
    >
      <AppIcon :name="t.icon" :size="22" class="tab-icon" />
      <span class="tab-title">{{ t.title }}</span>
      <span v-if="t.sub" class="tab-sub">{{ t.sub }}</span>
    </button>
  </div>
</template>

<style scoped>
.tabs {
  display: grid;
  /* 分頁幾個就分幾欄，平均分在同一行 */
  grid-template-columns: repeat(var(--tab-count, 3), minmax(0, 1fr));
  gap: 10px;
  margin: 1.25rem 0;
}

/* 分頁按鈕跟卡片同一套質感：平常浮起，選到的那一個凹下去 */
.tab {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--surface);
  border: none;
  border-radius: var(--radius-md);
  box-shadow: var(--lift-sm);
  padding: 0.8rem 1.1rem;
  color: var(--text);
  transition: box-shadow 0.15s, background 0.15s;
  min-width: 0;
}

.tab:hover {
  box-shadow: var(--lift);
}

/* 選到的分頁：凹陷＋主色淡底；主色的細框留著，分頁是最重要的位置指示，不能只靠影子 */
.tab.on {
  background: var(--accent-soft);
  box-shadow: inset 0 0 0 1.5px var(--accent), var(--press);
}

.tab-icon {
  color: var(--muted);
  flex-shrink: 0;
}

.tab.on .tab-icon {
  color: var(--accent);
}

.tab-title {
  font-size: 1.1rem;
  font-weight: 700;
  white-space: nowrap;
}

.tab-sub {
  margin-left: auto;
  font-size: 0.95rem;
  font-weight: 500;
  color: var(--text2);
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* 四個分頁放一行時，中等寬度就把重點數字移到名稱下面，避免擠在一起 */
@media (max-width: 900px) {
  .tab {
    flex-direction: column;
    gap: 2px;
  }

  .tab-sub {
    margin-left: 0;
    max-width: 100%;
  }
}

@media (max-width: 640px) {
  .tabs {
    gap: 6px;
  }

  .tab {
    flex-direction: column;
    gap: 2px;
    padding: 0.6rem 0.4rem;
  }

  .tab-title {
    font-size: 0.95rem;
  }

  .tab-sub {
    margin-left: 0;
    font-size: 0.8rem;
  }
}
</style>
