<script setup lang="ts">
import { onMounted, onUnmounted, ref, computed } from 'vue'
import { useRoute, useRouter } from 'vue-router'
import { t } from '../../i18n'

const props = withDefaults(
  defineProps<{
    show?: boolean
    message?: string
    size?: 'sm' | 'md' | 'lg'
    variant?: 'fullscreen' | 'inline' | 'overlay'
    logoOnly?: boolean
  }>(),
  {
    show: false,
    message: '',
    size: 'md',
    variant: 'fullscreen',
    logoOnly: false,
  },
)

const emit = defineEmits<{ complete: []; dismiss: [] }>()

const route = useRoute()
const router = useRouter()

const isVisible = ref(props.show)
const loadingProgress = ref(0)
const animationFrame = ref<number | null>(null)

const logoSize = computed(() => {
  switch (props.size) {
    case 'sm': return 80
    case 'md': return 120
    case 'lg': return 180
  }
})

const containerSize = computed(() => {
  switch (props.size) {
    case 'sm': return 140
    case 'md': return 200
    case 'lg': return 280
  }
})

const pulseDelay = computed(() => {
  return `${Math.random() * 0.5}s`
})

let routeUnwatch: (() => void) | null = null

function startProgressAnimation() {
  loadingProgress.value = 0
  const duration = 2000
  const startTime = performance.now()

  function animate(currentTime: number) {
    const elapsed = currentTime - startTime
    const progress = Math.min(elapsed / duration, 1)
    loadingProgress.value = progress * 100

    if (progress < 1) {
      animationFrame.value = requestAnimationFrame(animate)
    } else {
      loadingProgress.value = 100
    }
  }

  animationFrame.value = requestAnimationFrame(animate)
}

function stopProgressAnimation() {
  if (animationFrame.value) {
    cancelAnimationFrame(animationFrame.value)
    animationFrame.value = null
  }
  loadingProgress.value = 0
}

function showLoader() {
  isVisible.value = true
  startProgressAnimation()
}

function hideLoader() {
  stopProgressAnimation()
  isVisible.value = false
  emit('complete')
}

function setupRouteWatcher() {
  let navigationCount = 0

  router.beforeEach((to, from, next) => {
    if (to.path !== from.path) {
      navigationCount++
      showLoader()
    }
    next()
  })

  router.afterEach(() => {
    navigationCount--
    if (navigationCount <= 0) {
      navigationCount = 0
      setTimeout(hideLoader, 300)
    }
  })

  routeUnwatch = () => {}
}

function setupGlobalFetchInterceptor() {
  const originalFetch = window.fetch
  let activeRequests = 0

  window.fetch = async (...args) => {
    activeRequests++
    if (activeRequests === 1) {
      showLoader()
    }

    try {
      return await originalFetch(...args)
    } finally {
      activeRequests--
      if (activeRequests === 0) {
        setTimeout(hideLoader, 200)
      }
    }
  }

  return () => {
    window.fetch = originalFetch
  }
}

onMounted(() => {
  if (props.show) {
    showLoader()
  }
  setupRouteWatcher()
  const cleanupFetch = setupGlobalFetchInterceptor()

  onUnmounted(() => {
    stopProgressAnimation()
    if (routeUnwatch) routeUnwatch()
    cleanupFetch()
  })
})

const displayMessage = computed(() => {
  return props.message || t('common.loading')
})
</script>

<template>
  <Transition name="global-loader" appear>
    <div
      v-if="isVisible"
      :class="[
        'global-loader',
        `global-loader--${variant}`,
        `global-loader--${size}`,
        { 'global-loader--logo-only': logoOnly }
      ]"
      role="status"
      aria-live="polite"
      aria-label="Loading"
    >
      <div class="global-loader__backdrop" @click="logoOnly && $emit('dismiss')" />
      <div class="global-loader__container" :style="{ width: `${containerSize}px`, height: `${containerSize}px` }">
        <!-- SNUL Logo with Professional Animation -->
        <div class="snul-logo-animation welco-logo-animation" :style="{ '--logo-size': `${logoSize}px` }">
          <!-- Outer orbital ring -->
          <div class="logo-ring logo-ring--outer" :style="{ animationDelay: pulseDelay }">
            <svg viewBox="0 0 100 100" class="ring-svg" aria-hidden="true">
              <circle cx="50" cy="50" r="45" fill="none" stroke="var(--wl-primary)" stroke-width="2" stroke-dasharray="8 12" stroke-linecap="round" class="ring-path" />
            </svg>
          </div>

          <!-- Middle orbital ring (reverse direction) -->
          <div class="logo-ring logo-ring--middle" :style="{ animationDelay: pulseDelay }">
            <svg viewBox="0 0 100 100" class="ring-svg" aria-hidden="true">
              <circle cx="50" cy="50" r="35" fill="none" stroke="var(--wl-gold)" stroke-width="1.5" stroke-dasharray="6 10" stroke-linecap="round" class="ring-path ring-path--reverse" />
            </svg>
          </div>

          <!-- Inner orbital ring -->
          <div class="logo-ring logo-ring--inner" :style="{ animationDelay: pulseDelay }">
            <svg viewBox="0 0 100 100" class="ring-svg" aria-hidden="true">
              <circle cx="50" cy="50" r="25" fill="none" stroke="var(--wl-success)" stroke-width="1" stroke-dasharray="4 8" stroke-linecap="round" class="ring-path" />
            </svg>
          </div>

          <!-- Central Logo -->
          <div class="logo-core" :style="{ width: `${logoSize}px`, height: `${logoSize}px` }">
            <!-- Pulsing background glow -->
            <div class="logo-glow" aria-hidden="true">
              <div class="glow-layer glow-layer--1" />
              <div class="glow-layer glow-layer--2" />
              <div class="glow-layer glow-layer--3" />
            </div>

            <!-- Main Logo SVG -->
            <svg
              class="logo-svg"
              viewBox="0 0 200 200"
              :style="{ width: `${logoSize}px`, height: `${logoSize}px` }"
              aria-hidden="true"
              role="img"
            >
              <defs>
                <linearGradient id="logoGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stop-color="var(--wl-primary)" />
                  <stop offset="50%" stop-color="var(--color-accent-400)" />
                  <stop offset="100%" stop-color="var(--wl-primary)" />
                </linearGradient>
                <filter id="logoGlow" x="-50%" y="-50%" width="200%" height="200%">
                  <feGaussianBlur stdDeviation="3" result="blur" />
                  <feMerge>
                    <feMergeNode in="blur" />
                    <feMergeNode in="SourceGraphic" />
                  </feMerge>
                </filter>
                <filter id="logoInnerShadow" x="-20%" y="-20%" width="140%" height="140%">
                  <feOffset dx="0" dy="2" />
                  <feGaussianBlur stdDeviation="1" result="offset-blur" />
                  <feComposite in="SourceGraphic" in2="offset-blur" operator="over" />
                </filter>
              </defs>

              <!-- SNUL "S" Emblem Mark -->
              <g class="logo-mark" filter="url(#logoGlow)">
                <!-- S Letter - Precision Geometric -->
                <path
                  class="logo-path"
                  d="M136 68 C136 50 120 40 100 40 C78 40 64 50 64 68 C64 86 80 94 104 100 C128 106 142 116 142 134 C142 154 124 165 100 165 C72 165 56 150 56 132 L78 132 C78 142 88 148 100 148 C114 148 122 142 122 132 C122 118 108 112 86 106 C64 100 48 88 48 68 C48 48 68 32 100 32 C132 32 152 48 152 68 Z"
                  fill="url(#logoGradient)"
                  stroke="var(--wl-primary)"
                  stroke-width="1.5"
                />
                <!-- Precision Accent dots -->
                <circle class="logo-accent" cx="100" cy="40" r="4" fill="var(--color-accent-400)" />
                <circle class="logo-accent" cx="100" cy="165" r="4" fill="var(--color-primary-400)" />
              </g>

              <!-- Rotating particles around logo -->
              <g class="logo-particles" aria-hidden="true">
                <circle class="particle particle--1" cx="25" cy="25" r="3" fill="var(--wl-primary)" />
                <circle class="particle particle--2" cx="175" cy="25" r="2.5" fill="var(--wl-gold)" />
                <circle class="particle particle--3" cx="175" cy="175" r="2" fill="var(--wl-success)" />
                <circle class="particle particle--4" cx="25" cy="175" r="2.5" fill="var(--wl-primary)" />
              </g>
            </svg>

            <!-- Loading progress ring -->
            <div class="progress-ring" aria-hidden="true">
              <svg viewBox="0 0 120 120">
                <circle
                  class="progress-ring__bg"
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  stroke="var(--wl-surface-soft)"
                  stroke-width="3"
                />
                <circle
                  class="progress-ring__fill"
                  cx="60"
                  cy="60"
                  r="54"
                  fill="none"
                  stroke="url(#logoGradient)"
                  stroke-width="3"
                  stroke-linecap="round"
                  :style="{
                    strokeDasharray: 339.3,
                    strokeDashoffset: 339.3 - (339.3 * loadingProgress) / 100,
                    transform: 'rotate(-90deg)',
                    transformOrigin: '60px 60px',
                  }"
                />
              </svg>
            </div>
          </div>

          <!-- Scan line effect -->
          <div class="scan-line" aria-hidden="true" />
        </div>

        <!-- Loading message -->
        <div v-if="!logoOnly" class="global-loader__message">
          <p class="loader-text">{{ displayMessage }}</p>
          <div class="loader-dots" aria-hidden="true">
            <span class="dot" :style="{ animationDelay: '0ms' }" />
            <span class="dot" :style="{ animationDelay: '150ms' }" />
            <span class="dot" :style="{ animationDelay: '300ms' }" />
          </div>
        </div>

        <!-- Progress indicator -->
        <div v-if="variant === 'fullscreen' && !logoOnly" class="global-loader__progress" role="progressbar" :aria-valuenow="loadingProgress" aria-valuemin="0" aria-valuemax="100">
          <div class="progress-bar">
            <div class="progress-fill" :style="{ width: `${loadingProgress}%` }" />
            <div class="progress-shine" />
          </div>
          <span class="progress-text">{{ Math.round(loadingProgress) }}%</span>
        </div>
      </div>
    </div>
  </Transition>
</template>

<style scoped>
/* Transition */
.global-loader-enter-active,
.global-loader-leave-active {
  transition: all 0.4s cubic-bezier(0.16, 1, 0.3, 1);
}

.global-loader-enter-from,
.global-loader-leave-to {
  opacity: 0;
}

.global-loader-enter-from .global-loader__container,
.global-loader-leave-to .global-loader__container {
  transform: scale(0.9) translateY(20px);
  opacity: 0;
}

/* Base Container */
.global-loader {
  position: fixed;
  inset: 0;
  z-index: 9999;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.global-loader__backdrop {
  position: absolute;
  inset: 0;
  background: var(--bg-overlay);
  backdrop-filter: blur(8px);
  -webkit-backdrop-filter: blur(8px);
  animation: backdropFadeIn 0.3s ease-out;
}

.global-loader--inline {
  position: relative;
  min-height: 200px;
}

.global-loader--inline .global-loader__backdrop {
  position: absolute;
  inset: 0;
  background: var(--wl-surface);
  backdrop-filter: none;
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-lg);
}

.global-loader--overlay {
  position: absolute;
}

.global-loader--overlay .global-loader__backdrop {
  background: rgba(255, 255, 255, 0.9);
  backdrop-filter: blur(4px);
}

.global-loader__container {
  position: relative;
  z-index: 1;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 1.5rem;
  pointer-events: auto;
  padding: 2rem;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-xl);
  box-shadow: var(--wl-shadow-modal);
  animation: containerIn 0.5s var(--wl-ease-spring) both;
}

.global-loader--sm .global-loader__container { padding: 1.5rem; }
.global-loader--lg .global-loader__container { padding: 3rem; }

@keyframes backdropFadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes containerIn {
  from { opacity: 0; transform: scale(0.92) translateY(16px); }
  to { opacity: 1; transform: scale(1) translateY(0); }
}

/* SNUL Logo Animation */
.snul-logo-animation,
.welco-logo-animation {
  position: relative;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
}

/* Orbital Rings */
.logo-ring {
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.logo-ring--outer {
  animation: orbitRotate 20s linear infinite;
}

.logo-ring--middle {
  animation: orbitRotateReverse 15s linear infinite;
}

.logo-ring--inner {
  animation: orbitRotate 12s linear infinite;
}

.ring-svg {
  width: 100%;
  height: 100%;
  max-width: 200px;
  max-height: 200px;
}

.ring-path {
  transform-origin: 50% 50%;
  animation: ringPulse 3s ease-in-out infinite;
}

.ring-path--reverse {
  animation: ringPulseReverse 3s ease-in-out infinite;
}

@keyframes orbitRotate {
  from { transform: rotate(0deg); }
  to { transform: rotate(360deg); }
}

@keyframes orbitRotateReverse {
  from { transform: rotate(360deg); }
  to { transform: rotate(0deg); }
}

@keyframes ringPulse {
  0%, 100% { opacity: 0.3; stroke-width: 2; }
  50% { opacity: 0.8; stroke-width: 3; }
}

@keyframes ringPulseReverse {
  0%, 100% { opacity: 0.8; stroke-width: 3; }
  50% { opacity: 0.3; stroke-width: 2; }
}

/* Logo Core */
.logo-core {
  position: relative;
  display: flex;
  align-items: center;
  justify-content: center;
  z-index: 10;
}

/* Glow Layers */
.logo-glow {
  position: absolute;
  inset: -20%;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
}

.glow-layer {
  position: absolute;
  border-radius: 50%;
  animation: glowPulse 4s ease-in-out infinite;
}

.glow-layer--1 {
  inset: 0;
  background: radial-gradient(circle at center, var(--wl-primary-soft) 0%, transparent 70%);
  animation-delay: 0s;
}

.glow-layer--2 {
  inset: 10%;
  background: radial-gradient(circle at center, var(--wl-gold-soft) 0%, transparent 60%);
  animation-delay: 1.3s;
}

.glow-layer--3 {
  inset: 20%;
  background: radial-gradient(circle at center, var(--wl-success-soft) 0%, transparent 50%);
  animation-delay: 2.6s;
}

@keyframes glowPulse {
  0%, 100% { opacity: 0.4; transform: scale(1); }
  50% { opacity: 1; transform: scale(1.15); }
}

/* Logo SVG */
.logo-svg {
  position: relative;
  z-index: 2;
  animation: logoFloat 6s ease-in-out infinite;
}

.logo-path {
  transform-origin: center center;
  animation: logoPathDraw 2s var(--wl-ease-spring) both, logoBreathe 4s ease-in-out infinite 2s;
}

.logo-accent {
  animation: accentPulse 2s ease-in-out infinite;
}

.logo-accent:nth-child(2) { animation-delay: 0.3s; }
.logo-accent:nth-child(3) { animation-delay: 0.6s; }

@keyframes logoFloat {
  0%, 100% { transform: translateY(0) rotate(0deg); }
  25% { transform: translateY(-4px) rotate(0.5deg); }
  50% { transform: translateY(0) rotate(0deg); }
  75% { transform: translateY(4px) rotate(-0.5deg); }
}

@keyframes logoPathDraw {
  from {
    stroke-dasharray: 400;
    stroke-dashoffset: 400;
    opacity: 0;
  }
  to {
    stroke-dasharray: 400;
    stroke-dashoffset: 0;
    opacity: 1;
  }
}

@keyframes logoBreathe {
  0%, 100% { transform: scale(1); filter: drop-shadow(0 0 8px rgba(37, 99, 235, 0.3)); }
  50% { transform: scale(1.02); filter: drop-shadow(0 0 16px rgba(180, 83, 9, 0.4)); }
}

@keyframes accentPulse {
  0%, 100% { opacity: 1; transform: scale(1); }
  50% { opacity: 0.6; transform: scale(1.3); }
}

/* Particles */
.logo-particles {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.particle {
  position: absolute;
  animation: particleOrbit 8s linear infinite;
}

.particle--1 { animation-delay: 0s; }
.particle--2 { animation-delay: 2s; }
.particle--3 { animation-delay: 4s; }
.particle--4 { animation-delay: 6s; }

@keyframes particleOrbit {
  0% { transform: translate(-50%, -50%) rotate(0deg) translateX(90px) rotate(0deg); opacity: 0.8; }
  25% { opacity: 1; }
  50% { opacity: 0.4; }
  75% { opacity: 0.8; }
  100% { transform: translate(-50%, -50%) rotate(360deg) translateX(90px) rotate(-360deg); opacity: 0.8; }
}

/* Progress Ring */
.progress-ring {
  position: absolute;
  inset: -15%;
  display: flex;
  align-items: center;
  justify-content: center;
  pointer-events: none;
  opacity: 0;
  animation: progressRingIn 0.5s ease-out 0.8s forwards;
}

@keyframes progressRingIn {
  to { opacity: 1; }
}

.progress-ring svg {
  width: 100%;
  height: 100%;
  max-width: 220px;
  max-height: 220px;
}

.progress-ring__fill {
  transition: stroke-dashoffset 0.3s ease-out;
}

/* Scan Line */
.scan-line {
  position: absolute;
  inset: 0;
  background: linear-gradient(180deg, transparent 40%, rgba(255,255,255,0.15) 50%, transparent 60%);
  animation: scanMove 3s ease-in-out infinite;
  pointer-events: none;
  border-radius: 50%;
  overflow: hidden;
}

@keyframes scanMove {
  0% { transform: translateY(-100%) scaleY(0.5); opacity: 0; }
  20% { opacity: 1; }
  50% { transform: translateY(0) scaleY(1); opacity: 1; }
  80% { opacity: 1; }
  100% { transform: translateY(100%) scaleY(0.5); opacity: 0; }
}

/* Message */
.global-loader__message {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.75rem;
  text-align: center;
  animation: messageIn 0.4s ease-out 0.6s both;
}

@keyframes messageIn {
  from { opacity: 0; transform: translateY(10px); }
  to { opacity: 1; transform: translateY(0); }
}

.loader-text {
  margin: 0;
  font-family: var(--wl-font-body);
  font-size: var(--step-0);
  font-weight: 500;
  color: var(--wl-ink-strong);
  letter-spacing: 0.01em;
}

.loader-dots {
  display: flex;
  gap: 0.35rem;
}

.dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--wl-primary);
  animation: dotBounce 1.4s ease-in-out infinite;
}

@keyframes dotBounce {
  0%, 80%, 100% { transform: scale(1); opacity: 0.5; }
  40% { transform: scale(1.3); opacity: 1; }
}

/* Progress Bar */
.global-loader__progress {
  width: 100%;
  max-width: 280px;
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 0.5rem;
  animation: messageIn 0.4s ease-out 1s both;
}

.progress-bar {
  width: 100%;
  height: 6px;
  background: var(--chart-track);
  border-radius: var(--radius-pill);
  overflow: hidden;
  position: relative;
}

.progress-fill {
  height: 100%;
  background: var(--brand);
  border-radius: var(--radius-pill);
  transition: width var(--duration-slow) var(--ease-out);
  position: relative;
}

.progress-shine {
  position: absolute;
  inset: 0;
  background: linear-gradient(90deg, transparent, rgba(255,255,255,0.6), transparent);
  animation: shineMove 2s ease-in-out infinite;
}

@keyframes shineMove {
  0% { transform: translateX(-100%); }
  100% { transform: translateX(200%); }
}

.progress-text {
  font-family: var(--wl-font-mono);
  font-size: var(--step--1);
  font-weight: 600;
  color: var(--wl-muted);
}

/* Size Variants */
.global-loader--sm :is(.snul-logo-animation, .welco-logo-animation) { --logo-size: 80px; }
.global-loader--md :is(.snul-logo-animation, .welco-logo-animation) { --logo-size: 120px; }
.global-loader--lg :is(.snul-logo-animation, .welco-logo-animation) { --logo-size: 180px; }

/* Logo Only Variant */
.global-loader--logo-only .global-loader__container {
  padding: 0;
  background: transparent;
  border: none;
  box-shadow: none;
}

.global-loader--logo-only .global-loader__backdrop {
  background: transparent;
  backdrop-filter: none;
}

/* Reduced Motion */
@media (prefers-reduced-motion: reduce) {
  .global-loader__container,
  .logo-ring,
  .logo-svg,
  .logo-path,
  .logo-accent,
  .particle,
  .glow-layer,
  .scan-line,
  .dot,
  .progress-shine {
    animation: none !important;
  }
  .logo-ring--outer { transform: rotate(45deg); }
  .logo-ring--middle { transform: rotate(-30deg); }
  .logo-ring--inner { transform: rotate(15deg); }
  .logo-path { stroke-dashoffset: 0; }
  .logo-svg { transform: none; }
  .global-loader__container { animation: none; opacity: 1; transform: none; }
}
</style>