<script setup lang="ts">
import { computed } from 'vue'

const props = withDefaults(
  defineProps<{
    label: string
    value: string | number
    hint?: string
    to?: string
    iconOnly?: boolean
    trend?: string
    trendUp?: boolean
    sparkline?: number[]
    tone?: 'teal' | 'indigo' | 'amber' | 'emerald' | 'rose' | 'obsidian' | 'slate' | 'gold'
  }>(),
  {
    hint: undefined,
    to: undefined,
    iconOnly: false,
    trend: undefined,
    trendUp: undefined,
    sparkline: undefined,
    tone: 'indigo',
  },
)

const isPositive = computed(() => {
  if (props.trendUp !== undefined) return props.trendUp
  if (!props.trend) return true
  return props.trend.startsWith('+') || props.trend.includes('✓')
})

const isNegative = computed(() => {
  if (props.trendUp !== undefined) return !props.trendUp
  if (!props.trend) return false
  return props.trend.startsWith('-')
})

// Generate SVG smooth area curve path for the sparkline
const sparkPath = computed(() => {
  const data = props.sparkline && props.sparkline.length >= 2 ? props.sparkline : []
  if (data.length < 2) return { line: '', area: '' }
  const width = 88
  const height = 32
  const min = Math.min(...data)
  const max = Math.max(...data)
  const range = max - min || 1

  const points: [number, number][] = data.map((v, i) => {
    const x = (i / (data.length - 1)) * width
    const y = height - 4 - ((v - min) / range) * (height - 8)
    return [x, y]
  })

  const pStart = points[0]!
  let line = `M ${pStart[0].toFixed(1)} ${pStart[1].toFixed(1)}`
  for (let i = 0; i < points.length - 1; i++) {
    const p0 = (i === 0 ? points[0] : points[i - 1])!
    const p1 = points[i]!
    const p2 = points[i + 1]!
    const p3 = (i + 2 >= points.length ? points[points.length - 1] : points[i + 2])!

    const cp1x = p1[0] + (p2[0] - p0[0]) / 6
    const cp1y = p1[1] + (p2[1] - p0[1]) / 6
    const cp2x = p2[0] - (p3[0] - p1[0]) / 6
    const cp2y = p2[1] - (p3[1] - p1[1]) / 6

    line += ` C ${cp1x.toFixed(1)} ${cp1y.toFixed(1)}, ${cp2x.toFixed(1)} ${cp2y.toFixed(1)}, ${p2[0].toFixed(1)} ${p2[1].toFixed(1)}`
  }

  const area = `${line} L ${width} ${height} L 0 ${height} Z`
  return { line, area }
})

const strokeColor = computed(() => {
  if (props.tone === 'emerald' || (props.trend && isPositive.value)) return 'var(--fg-success)'
  if (props.tone === 'rose' || (props.trend && isNegative.value)) return 'var(--fg-danger)'
  if (props.tone === 'amber') return 'var(--fg-warning)'
  return 'var(--brand)'
})
</script>

<template>
  <component
    :is="to ? 'router-link' : 'div'"
    :to="to ?? undefined"
    class="stat-card"
    :class="[`stat-card--${tone}`, { 'is-interactive': Boolean(to), 'is-icon-only': iconOnly }]"
    :aria-label="label"
  >
    <div v-if="iconOnly" class="stat-card__icon-only" aria-hidden="true">
      <div v-if="$slots.icon" class="stat-card__icon-wrap">
        <slot name="icon" />
      </div>
      <div class="stat-card__value mono-num">{{ value }}</div>
    </div>

    <template v-else>
      <div class="stat-card__header">
      <span class="stat-card__label mono">{{ label }}</span>
      <div class="stat-card__top-right">
        <span
          v-if="trend"
          class="stat-card__trend mono"
          :class="{
            'trend--positive': isPositive,
            'trend--negative': isNegative,
            'trend--neutral': !isPositive && !isNegative,
          }"
        >
          <span class="trend__icon" aria-hidden="true">{{ isPositive ? '↑' : isNegative ? '↓' : '•' }}</span>
          {{ trend }}
        </span>
        <div v-if="$slots.icon" class="stat-card__icon-wrap">
          <slot name="icon" />
        </div>
      </div>
    </div>

    <div class="stat-card__main">
      <div class="stat-card__content">
        <div class="stat-card__value mono-num">{{ value }}</div>
        <div v-if="hint" class="stat-card__hint">{{ hint }}</div>
      </div>

      <!-- Integrated Mini Sparkline Area Chart (only when real sparkline data provided) -->
      <div v-if="sparkline && sparkline.length >= 2" class="stat-card__spark-box" aria-hidden="true">
        <svg class="spark-svg" viewBox="0 0 88 32" fill="none" preserveAspectRatio="none">
          <defs>
            <linearGradient :id="`spark-grad-${label.replace(/[^a-zA-Z0-9]/g, '-')}`" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" :stop-color="strokeColor" stop-opacity="0.25" />
              <stop offset="100%" :stop-color="strokeColor" stop-opacity="0.0" />
            </linearGradient>
          </defs>
          <path :d="sparkPath.area" :fill="`url(#spark-grad-${label.replace(/[^a-zA-Z0-9]/g, '-')})`" />
          <path :d="sparkPath.line" :stroke="strokeColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" />
        </svg>
      </div>
    </div>
    </template>
  </component>
</template>

<style scoped>
.stat-card {
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: var(--space-4);
  padding: var(--space-5) var(--space-4);
  background: var(--stat-bg, var(--bg-subtle));
  border: 1px solid transparent;
  border-radius: var(--radius-lg);
  box-shadow: none;
  text-decoration: none;
  color: inherit;
  position: relative;
  overflow: hidden;
  transition: border-color var(--duration-base) var(--ease-out), box-shadow var(--duration-base) var(--ease-out);
}

.stat-card.is-interactive:hover {
  border-color: var(--border-strong);
  box-shadow: var(--shadow-md);
}

.stat-card.is-icon-only {
  align-items: center;
  justify-content: center;
  min-height: 88px;
  padding: var(--space-4);
}

.stat-card__icon-only {
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.65rem;
  direction: inherit;
  width: 100%;
}

.stat-card.is-icon-only .stat-card__value {
  font-size: var(--text-2xl);
  line-height: var(--leading-tight);
}

.stat-card__header {
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.stat-card__label {
  font-size: var(--text-sm);
  font-weight: var(--weight-medium);
  color: var(--fg-body);
}

.stat-card__top-right {
  display: flex;
  align-items: center;
  gap: 0.5rem;
}

.stat-card__trend {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  font-size: var(--text-xs);
  font-weight: var(--weight-medium);
  line-height: 1;
  padding: 0.2rem 0.48rem;
  border-radius: var(--radius-pill);
  font-variant-numeric: tabular-nums;
  border: 1px solid transparent;
}

.trend--positive {
  background: var(--color-success-100);
  color: var(--fg-success);
  border-color: var(--color-success-100);
}

.trend--negative {
  background: var(--color-danger-100);
  color: var(--fg-danger);
  border-color: var(--color-danger-100);
}

.trend--neutral {
  background: var(--bg-subtle);
  color: var(--fg-muted);
  border-color: var(--border);
}

.trend__icon {
  font-size: 10px;
  font-weight: 700;
}

.stat-card__icon-wrap {
  display: grid;
  place-items: center;
  width: 34px;
  height: 34px;
  border-radius: var(--radius-pill);
  background: var(--stat-fg, var(--brand));
  color: #fff;
  font-size: 16px;
}

.stat-card__main {
  display: flex;
  align-items: flex-end;
  justify-content: space-between;
  gap: 1rem;
}

.stat-card__content {
  display: flex;
  flex-direction: column;
  gap: 0.2rem;
}

.stat-card__value {
  font-family: var(--font-sans);
  font-size: var(--text-2xl);
  font-weight: var(--weight-bold);
  letter-spacing: var(--tracking-tight);
  line-height: var(--leading-tight);
  color: var(--fg-heading);
}

.stat-card__hint {
  font-size: var(--text-sm);
  color: var(--fg-muted);
}

.stat-card__spark-box {
  width: 88px;
  height: 32px;
  flex-shrink: 0;
  opacity: 0.85;
  transition: opacity 0.2s ease, transform 0.2s ease;
}

.stat-card:hover .stat-card__spark-box {
  opacity: 1;
  transform: scale(1.03);
}

.spark-svg {
  width: 100%;
  height: 100%;
  overflow: visible;
}

/* Tone tints — Clinical Precision stat tiles */
.stat-card--rose { --stat-bg: var(--color-rose-100); --stat-fg: var(--color-rose-500); }
.stat-card--orange, .stat-card--amber, .stat-card--gold { --stat-bg: var(--color-orange-100); --stat-fg: var(--color-orange-500); }
.stat-card--emerald, .stat-card--teal { --stat-bg: var(--color-green-100); --stat-fg: var(--color-green-500); }
.stat-card--violet { --stat-bg: var(--color-violet-100); --stat-fg: var(--color-violet-500); }
.stat-card--indigo, .stat-card--brand { --stat-bg: var(--brand-soft); --stat-fg: var(--brand); }
.stat-card--slate, .stat-card--obsidian { --stat-bg: var(--bg-subtle); --stat-fg: var(--fg-muted); }
</style>
