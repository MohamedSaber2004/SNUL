<script setup lang="ts">
import { ref, computed, watch } from 'vue'
import { t, locale, setLocale } from '../../i18n'
import { authService } from '../../di/container'
import { AppLanguage } from '../../domain/models/user'

export interface DashboardNavLink {
  to: string
  icon: string
  label: string
  exact?: boolean
  visible?: boolean
}

export interface DashboardNavSection {
  key: string
  label: string
  collapsible: boolean
  links: DashboardNavLink[]
  visible?: boolean
}

const props = withDefaults(
  defineProps<{
    storageKey: string
    brandText: string
    sections: DashboardNavSection[]
    statusText?: string
    mobileLinks?: DashboardNavLink[]
  }>(),
  {
    statusText: '',
    mobileLinks: undefined,
  },
)

const collapsed = ref(false)
try {
  const v = typeof window !== 'undefined' ? localStorage.getItem(props.storageKey) : null
  collapsed.value = v ? v === '1' : false
} catch {}
watch(collapsed, (v) => {
  try { if (typeof window !== 'undefined') localStorage.setItem(props.storageKey, v ? '1' : '0') } catch {}
})
const toggle = () => { collapsed.value = !collapsed.value }

const openSections = ref<Record<string, boolean>>({})
watch(
  () => props.sections,
  (secs) => {
    for (const s of secs) {
      if (!(s.key in openSections.value)) openSections.value[s.key] = true
    }
  },
  { immediate: true },
)
const toggleSection = (key: string) => {
  openSections.value[key] = !openSections.value[key]
}

const visibleSections = computed(() =>
  props.sections.filter((s) => s.visible !== false && s.links.some((l) => l.visible !== false)),
)

const flatMobileLinks = computed<DashboardNavLink[]>(
  () =>
    props.mobileLinks ??
    props.sections
      .filter((s) => s.visible !== false)
      .flatMap((s) => s.links.filter((l) => l.visible !== false)),
)

const toggleLang = async () => {
  const next = locale.value === 'ar' ? 'en' : 'ar'
  setLocale(next)
  if (authService.user.value && authService.user.value.fullName) {
    try {
      await authService.updateProfile({
        fullName: authService.user.value.fullName,
        phoneNumber: authService.user.value.phoneNumber || undefined,
        language: next === 'ar' ? AppLanguage.Ar : AppLanguage.En,
      })
    } catch {}
  }
}
</script>

<template>
  <div class="admin-shell">
    <aside class="admin-rail" :class="{ 'admin-rail--collapsed': collapsed }">
      <div class="rail__top">
        <div class="rail__brand">
          <span class="rail__dot" aria-hidden="true"></span>
          <span v-if="!collapsed" class="rail__brand-text mono">{{ brandText }}</span>
        </div>
        <button class="rail__toggle" type="button" :aria-label="collapsed ? t('common.expand') : t('common.collapse')" @click="toggle">
          <span class="material-symbols-outlined icon--directional" style="font-size:16px">{{ collapsed ? 'chevron_right' : 'chevron_left' }}</span>
        </button>
      </div>

      <nav class="rail__nav" :aria-label="t('nav.navigation')">
        <template v-for="sec in visibleSections" :key="sec.key">
          <button
            v-if="sec.collapsible && !collapsed && sec.label"
            type="button"
            class="admin-section-toggle mono"
            @click="toggleSection(sec.key)"
          >
            <span>{{ sec.label }}</span>
            <span class="material-symbols-outlined section-arrow" :class="{ 'is-open': openSections[sec.key] }">expand_more</span>
          </button>
          <div v-show="collapsed || !sec.collapsible || openSections[sec.key]" class="admin-sub-menu">
            <router-link
              v-for="link in sec.links.filter((l) => l.visible !== false)"
              :key="link.to + link.label"
              :to="link.to"
              class="admin-link"
              :exact-active-class="link.exact ? 'admin-link--active' : undefined"
              :active-class="'admin-link--active'"
            >
              <span class="material-symbols-outlined nav-icon">{{ link.icon }}</span>
              <span v-if="!collapsed" class="admin-link__label">{{ link.label }}</span>
            </router-link>
          </div>
        </template>
      </nav>

      <div class="rail__foot">
        <div v-if="!collapsed && statusText" class="rail__status mono">
          <span class="rail__dot--live" aria-hidden="true"></span>
          <span>{{ statusText }}</span>
        </div>
        <button
          type="button"
          class="rail__lang-btn mono"
          :aria-label="locale === 'ar' ? 'English' : 'العربية'"
          :title="locale === 'ar' ? 'Switch to English' : 'التحويل إلى العربية'"
          @click="toggleLang"
        >
          <span class="material-symbols-outlined text-[16px]">language</span>
        </button>
      </div>
    </aside>

    <div class="admin-mobile" :aria-label="t('nav.navigation')">
      <router-link
        v-for="link in flatMobileLinks"
        :key="link.to + link.label"
        :to="link.to"
        class="admin-mobile-pill"
        :exact-active-class="link.exact ? 'is-active' : undefined"
        :active-class="'is-active'"
      >
        {{ link.label }}
      </router-link>
    </div>

    <div class="admin-main">
      <div class="admin-main__inner"><slot /></div>
    </div>
  </div>
</template>

<style scoped>
.admin-shell {
  min-height: 100vh;
  background:
    radial-gradient(circle at 100% 0%, color-mix(in srgb, var(--secondary) 8%, transparent), transparent 34rem),
    var(--wl-paper);
  display: flex;
  gap: clamp(1rem, 2vw, 1.75rem);
  padding: var(--wl-page-padding-top) var(--wl-gutter) var(--wl-page-padding-bottom);
  padding-inline-start: max(var(--wl-gutter), env(safe-area-inset-left));
  padding-inline-end: max(var(--wl-gutter), env(safe-area-inset-right));
  max-width: 1560px;
  margin: 0 auto;
  width: 100%;
  box-sizing: border-box;
}

.admin-rail {
  width: var(--sidebar-width);
  background: var(--bg-sidebar);
  border: 1px solid var(--border);
  border-radius: var(--radius-lg);
  flex-shrink: 0;
  position: sticky;
  top: calc(var(--wl-header-height, 56px) + var(--wl-page-padding-top, 1.5rem));
  height: calc(100vh - var(--wl-header-height, 56px) - var(--wl-page-padding-top, 1.5rem) - var(--wl-page-padding-bottom, 3.5rem));
  overflow-y: auto;
  display: flex;
  flex-direction: column;
  box-shadow: 0 18px 46px rgba(8, 47, 73, 0.10);
  backdrop-filter: blur(14px);
  transition: width 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.admin-rail--collapsed {
  width: var(--sidebar-width-collapsed);
}

.rail__top {
  display: flex;
  align-items: center;
  justify-content: space-between;
  padding: 0.85rem 0.85rem;
  border-bottom: 1px solid var(--wl-border);
}

.rail__brand {
  display: flex;
  align-items: center;
  gap: 0.6rem;
}

.rail__dot {
  width: 8px;
  height: 8px;
  border-radius: 50%;
  background: var(--wl-primary);
  box-shadow: 0 0 0 3px rgba(var(--wl-primary-rgb), 0.16);
}

.rail__brand-text {
  font-family: var(--font-display);
  font-size: 11px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--wl-ink-strong);
}

.rail__toggle {
  width: 28px;
  height: 28px;
  border-radius: var(--radius-xs, 3px);
  border: 1px solid var(--wl-border);
  background: var(--wl-surface-soft);
  color: var(--wl-ink-soft);
  display: grid;
  place-items: center;
  cursor: pointer;
  transition: all 0.12s ease;
}

.rail__toggle:hover {
  background: var(--wl-surface);
  color: var(--wl-ink-strong);
  border-color: var(--wl-border-strong);
}

.rail__nav {
  flex: 1;
  padding: 0.65rem 0.5rem;
  display: flex;
  flex-direction: column;
  gap: 0.18rem;
}

.admin-section-toggle {
  display: flex;
  align-items: center;
  justify-content: space-between;
  width: 100%;
  background: none;
  border: none;
  cursor: pointer;
  font-family: var(--font-mono, monospace);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: var(--wl-muted);
  padding: 0.75rem 0.65rem 0.3rem;
  transition: color 0.12s ease;
}

.admin-section-toggle:hover {
  color: var(--wl-ink-strong);
}

.section-arrow {
  font-size: 16px;
  transition: transform 0.15s ease;
}

.section-arrow.is-open {
  transform: rotate(180deg);
}

.admin-sub-menu {
  display: flex;
  flex-direction: column;
  gap: 0.12rem;
}

/* Clinical Precision nav items — solid brand active */
.admin-link {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-3) var(--space-4);
  border-radius: var(--radius-sm, 4px);
  font-size: var(--text-md);
  font-weight: var(--weight-medium);
  color: var(--fg-muted);
  text-decoration: none;
  border: 1px solid transparent;
  transition: background var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out);
}

.nav-icon {
  font-size: 18px;
  color: var(--fg-muted);
  transition: color var(--duration-fast) var(--ease-out);
}
.nav-icon svg { width: 20px; height: 20px; }

.admin-link:hover {
  background: var(--bg-hover);
  color: var(--brand);
  text-decoration: none;
}

.admin-link:hover .nav-icon {
  color: var(--brand);
}

.admin-link--active {
  background: var(--brand) !important;
  color: var(--fg-on-brand) !important;
  border-color: var(--brand) !important;
  font-weight: var(--weight-medium);
  box-shadow: var(--shadow-brand);
}

.admin-link--active .nav-icon {
  color: var(--fg-on-brand);
}

.rail__foot {
  padding: 0.75rem 0.85rem;
  border-top: 1px solid var(--wl-border);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 0.5rem;
}

.rail__status {
  display: flex;
  align-items: center;
  gap: 0.45rem;
  font-size: 11px;
  color: var(--wl-muted);
}

.rail__lang-btn {
  display: inline-flex;
  align-items: center;
  gap: 0.35rem;
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: 6px;
  padding: 0.28rem 0.55rem;
  color: var(--wl-ink-soft);
  cursor: pointer;
  font-size: 11px;
  font-weight: 600;
  transition: all 0.15s ease;
}

.rail__lang-btn:hover {
  background: var(--wl-surface);
  color: var(--wl-primary);
  border-color: var(--wl-primary);
}

.admin-rail--collapsed .rail__foot {
  justify-content: center;
  padding: 0.75rem 0.4rem;
}

.admin-rail--collapsed .rail__lang-btn {
  padding: 0.35rem;
}

.rail__dot--live {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: var(--wl-success);
  box-shadow: 0 0 0 3px var(--wl-success-soft);
}

.admin-rail--collapsed .admin-link__label,
.admin-rail--collapsed .admin-section-toggle,
.admin-rail--collapsed .rail__brand-text,
.admin-rail--collapsed .rail__status {
  display: none;
}

.admin-rail--collapsed .admin-link {
  justify-content: center;
  padding: 0.5rem;
}

.admin-rail--collapsed .rail__top {
  justify-content: center;
}

  .admin-main {
  flex: 1;
  min-width: 0;
  width: 100%;
  max-width: 100%;
  box-sizing: border-box;
  overflow-x: clip;
  }
  .admin-main__inner { min-width: 0; max-width: 100%; overflow-x: clip; }
  .admin-main__inner :deep(.page-shell) { padding-inline: max(1rem, env(safe-area-inset-left)); padding-inline-end: max(1rem, env(safe-area-inset-right)); }
  .admin-main__inner :deep(.grid), .admin-main__inner :deep(.dashboard-grid) { min-width: 0; }
  .admin-main__inner :deep(.table-wrap), .admin-main__inner :deep(.table-responsive) { max-width: 100%; overflow-x: auto; }

.admin-main__inner {
  max-width: var(--wl-max-width-admin, 1560px);
  margin: 0 auto;
  width: 100%;
  min-width: 0;
}

.admin-mobile {
  display: none;
}

@media (min-width: 901px) and (max-width: 1100px) {
  .admin-rail:not(.admin-rail--collapsed) {
    width: 210px;
  }
}

@media (max-width: 900px) {
  .admin-shell {
    flex-direction: column;
    padding: 0;
    gap: 0;
    max-width: 100%;
  }
  .admin-rail {
    display: none;
  }
  .admin-mobile {
    display: flex;
    gap: 0.4rem;
    padding: 0.6rem var(--wl-gutter);
    padding-inline-start: max(var(--wl-gutter), env(safe-area-inset-left));
    padding-inline-end: max(var(--wl-gutter), env(safe-area-inset-right));
    overflow-x: auto;
    -webkit-overflow-scrolling: touch;
    scrollbar-width: none;
    background: var(--wl-surface);
    border-bottom: 1px solid var(--wl-border);
    position: sticky;
    top: var(--wl-header-height, 56px);
    z-index: 20;
    overscroll-behavior-x: contain;
  }
  .admin-mobile::-webkit-scrollbar {
    display: none;
  }
  .admin-mobile-pill {
    padding: 0.42rem 0.8rem;
    border-radius: 9999px;
    font-size: 12px;
    font-weight: 600;
    background: var(--wl-surface);
    color: var(--wl-ink-soft);
    border: 1px solid var(--wl-border);
    white-space: nowrap;
    text-decoration: none;
    transition: all 0.12s ease;
    min-height: 32px;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    flex-shrink: 0;
  }
  .admin-mobile-pill.is-active {
    background: var(--brand);
    color: var(--fg-on-brand);
    border-color: var(--brand);
    box-shadow: var(--shadow-brand);
  }
  .admin-main {
    padding: 0;
  }
  .admin-main__inner {
    padding: var(--wl-page-padding-top) var(--wl-gutter) var(--wl-page-padding-bottom);
    padding-inline-start: max(var(--wl-gutter), env(safe-area-inset-left));
    padding-inline-end: max(var(--wl-gutter), env(safe-area-inset-right));
  }
}
</style>
