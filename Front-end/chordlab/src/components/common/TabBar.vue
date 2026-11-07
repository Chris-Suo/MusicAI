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
  <div class="tabs" role="tablist" :aria-label="label">
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
  grid-template-columns: repeat(3, 1fr);
  gap: 10px;
  margin: 1.25rem 0;
}

.tab {
  display: flex;
  align-items: center;
  gap: 10px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  padding: 0.8rem 1.1rem;
  color: var(--text);
  transition: border-color 0.15s, background 0.15s;
  min-width: 0;
}

.tab:hover {
  border-color: var(--border-strong);
}

.tab.on {
  border-color: var(--accent);
  background: var(--accent-soft);
  box-shadow: inset 0 0 0 1px var(--accent);
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
