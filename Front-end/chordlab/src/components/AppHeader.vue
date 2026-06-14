<template>
  <header class="header">
    <div class="logo">Chord<span>Lab</span></div>
    <div class="subtitle">// wav chord analyzer</div>
  </header>
</template>

<style scoped>
.header {
  display: flex;
  align-items: baseline;
  gap: 12px;
  margin-bottom: 2rem;
}

.logo {
  font-family: var(--font-mono);
  font-size: 22px;
  font-weight: 700;
  color: var(--accent);
  letter-spacing: -1px;
}

.logo span {
  color: var(--accent2);
}

.subtitle {
  font-family: var(--font-mono);
  font-size: 13px;
  color: var(--muted);
}
</style>
