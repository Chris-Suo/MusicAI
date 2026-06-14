<template>
  <div class="section-label">
    <slot />
  </div>
</template>

<style scoped>
.section-label {
  font-family: var(--font-mono);
  font-size: 11px;
  color: var(--muted);
  text-transform: uppercase;
  letter-spacing: 1.5px;
  margin-bottom: 1rem;
}
</style>
