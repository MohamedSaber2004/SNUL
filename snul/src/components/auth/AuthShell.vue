<script setup lang="ts">
import { t, locale, setLocale } from '../../i18n'
import { useSiteLogo } from '../../composables/useSiteLogo'

defineProps<{
  title: string
  subtitle: string
  wide?: boolean
}>()

const toggleLang = () => {
  setLocale(locale.value === 'ar' ? 'en' : 'ar')
}
const { logoUrl: authLogoUrl, altText: authLogoAlt } = useSiteLogo()
</script>

<template>
  <div class="auth-wrap">
    <div class="auth-card" :class="{ 'auth-card--wide': wide }">
      <header class="auth-card__top">
        <router-link to="/" class="auth-brand-link" :aria-label="t('nav.home')">
          <img v-if="authLogoUrl" :src="authLogoUrl" :alt="authLogoAlt" class="auth-logo-img" width="108" height="26" loading="eager" />
          <span v-else class="auth-brand-word mono">SNUL</span>
        </router-link>

        <div class="auth-controls">
          <button
            type="button"
            class="auth-ctrl-btn auth-ctrl-btn--lang"
            :aria-label="t('nav.toggleLanguage')"
            :title="t('nav.toggleLanguage')"
            @click="toggleLang"
          >
            <span class="material-symbols-outlined text-[17px]">language</span>
            <span class="mono text-[11px] font-bold">{{ locale === 'ar' ? 'EN' : 'عربي' }}</span>
          </button>
        </div>
      </header>

      <div class="auth-card__head">
        <div class="auth-chip mono">{{ t('auth.shellBadge') }}</div>
        <h1 class="auth-title">{{ title }}</h1>
        <p class="auth-subtitle">{{ subtitle }}</p>
      </div>

      <main class="auth-card__body">
        <slot />
      </main>

      <footer class="auth-card__foot mono">
        <span class="material-symbols-outlined text-[14px] text-emerald-500">lock</span>
        <span>{{ t('auth.shellFormFoot') }}</span>
      </footer>
    </div>
  </div>
</template>

<style scoped>
.auth-wrap {
  min-height: calc(100vh - var(--wl-header-height, 56px));
  background: radial-gradient(circle at 12% 10%, rgba(214,243,106,.16), transparent 22rem), linear-gradient(135deg, #062f45 0%, #0b6370 58%, #e8f5f3 140%);
  color: #f7fffe;
  display: grid;
  place-items: center;
  padding: 2.5rem var(--wl-gutter);
  padding-inline-start: max(var(--wl-gutter), env(safe-area-inset-left, 0px));
  padding-inline-end: max(var(--wl-gutter), env(safe-area-inset-right, 0px));
  padding-bottom: max(2.5rem, env(safe-area-inset-bottom, 0px));
  position: relative;
}

.auth-card {
  width: 100%;
  max-width: 440px;
  background: color-mix(in srgb, var(--bg-surface) 94%, transparent);
  border: 1px solid rgba(255,255,255,.38);
  border-radius: 1.5rem;
  box-shadow: 0 28px 70px rgba(2, 25, 39, .24);
  backdrop-filter: blur(18px);
  position: relative;
  overflow: hidden;
  padding: var(--space-6);
  display: flex;
  flex-direction: column;
  transition: max-width var(--duration-base) var(--ease-out);
}

@media (max-width: 480px) {
  .auth-wrap { padding: var(--space-4) var(--space-4) !important; }
  .auth-card { padding: var(--space-5) var(--space-4) !important; border-radius: var(--radius-lg) !important; }
}

  .auth-card--wide {
  max-width: 540px;
}

.auth-card::before {
  content: '';
  position: absolute;
  top: 0;
  inset-inline: 0;
  height: 2px;
  background: var(--brand-gradient);
  opacity: 0.6;
}

.auth-card__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 1.5rem;
  padding-bottom: 0.85rem;
  border-bottom: 1px solid var(--wl-border);
}

.auth-brand-link {
  display: inline-flex;
  align-items: center;
  text-decoration: none;
  opacity: 0.95;
  transition: opacity 0.15s ease, transform 0.15s ease;
}

.auth-brand-link:hover {
  opacity: 1;
  transform: translateY(-1px);
}

.auth-logo-img {
  height: 26px;
  width: auto;
  border-radius: 4px;
}

.auth-brand-word {
  font-size: 1.15rem;
  font-weight: 800;
  color: var(--brand);
  letter-spacing: 0.05em;
}

.auth-controls {
  display: flex;
  align-items: center;
  gap: 0.4rem;
}

.auth-ctrl-btn {
  height: 32px;
  min-width: 32px;
  padding: 0 0.5rem;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.35rem;
  border: 1px solid var(--wl-border);
  background: var(--wl-surface-soft);
  color: var(--wl-ink-soft);
  border-radius: var(--radius-sm);
  cursor: pointer;
  transition: all 0.15s ease;
}

.auth-ctrl-btn:hover {
  background: var(--wl-surface-hover);
  color: var(--wl-primary);
  border-color: var(--wl-primary);
}

.auth-card__head {
  margin-bottom: 1.5rem;
  text-align: start;
}

.auth-chip {
  display: inline-block;
  font-size: 9.5px;
  font-weight: 700;
  color: var(--wl-primary);
  background: var(--wl-primary-soft);
  border: 1px solid var(--wl-border);
  padding: 0.2rem 0.55rem;
  border-radius: var(--radius-xs);
  letter-spacing: 0.08em;
  margin-bottom: 0.65rem;
}

.auth-title {
  font-family: var(--wl-font-display);
  font-size: 1.5rem;
  font-weight: 800;
  letter-spacing: -0.025em;
  color: var(--wl-ink-strong);
  line-height: 1.2;
  margin: 0 0 0.35rem;
}

.auth-subtitle {
  font-size: 13.5px;
  color: var(--wl-ink-soft);
  margin: 0;
  line-height: 1.5;
}

.auth-card__body {
  flex: 1;
}

.auth-card__foot {
  margin-top: 1.75rem;
  padding-top: 1rem;
  border-top: 1px solid var(--wl-border);
  display: flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  font-size: 10.5px;
  color: var(--wl-muted);
  letter-spacing: 0.03em;
}

@media (max-width: 480px) {
  .auth-card {
    padding: 1.25rem 1.15rem 1.15rem;
    border-radius: var(--radius-lg);
  }
  .auth-title {
    font-size: 1.35rem;
  }
}
</style>
