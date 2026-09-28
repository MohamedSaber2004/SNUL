<script setup lang="ts">
import { computed, watch, onMounted } from 'vue'
import { useRoute } from 'vue-router'
import AppHeader from './components/layout/AppHeader.vue'
import AppFooter from './components/layout/AppFooter.vue'
import AppMobileNav from './components/layout/AppMobileNav.vue'
import LoadingBar from './components/ui/LoadingBar.vue'
import ToastContainer from './components/ui/ToastContainer.vue'
import ResultModal from './components/ui/ResultModal.vue'
import ConfirmDialog from './components/ui/ConfirmDialog.vue'
import WhatsAppFab from './components/ui/WhatsAppFab.vue'
import { services } from './di/container'
import { t, locale } from './i18n'
import type { MessageKey } from './i18n'

const route = useRoute()

onMounted(() => {
  void services.contentService.loadSupportContact()
})

watch(locale, () => {
  const k = route.meta.titleKey as MessageKey | undefined
  document.title = k ? `${t(k)} · SNUL` : 'SNUL'
})

const showFooter = computed(() => {
  if (route.meta?.isLandingPage) return true
  if (route.meta?.hideFooter) return false

  const path = route.path || ''
  const name = String(route.name || '')

  // Auth pages (login, register, reset, verify…) keep full public chrome.
  if (path.startsWith('/auth')) return true

  if (
    path.startsWith('/admin') ||
    path.startsWith('/account') ||
    path === '/profile' ||
    path === '/addresses' ||
    path === '/locations' ||
    path === '/help/my-tickets' ||
    Boolean(route.meta?.requiresAdmin) ||
    Boolean(route.meta?.requiresAuth)
  ) {
    return false
  }

  return (
    name === 'home' ||
    path === '/' ||
    name === 'landing-page' ||
    path.startsWith('/catalog/') ||
    name === 'oem' ||
    path === '/oem' ||
    name === 'certifications' ||
    path === '/certifications' ||
    name === 'about' ||
    path === '/about' ||
    name === 'help' ||
    path === '/help' ||
    name === 'providers' ||
    path === '/providers' ||
    name === 'marketplace' ||
    path === '/marketplace' ||
    name === 'categories' ||
    path === '/categories' ||
    name === 'cart' ||
    path === '/cart' ||
    name === 'wishlist' ||
    path === '/wishlist'
  )
})

const showWhatsApp = computed(() => route.name === 'home' || route.path === '/')

const whatsAppOffset = computed(() => '')

/* Dashboard routes (admin / staff / provider) use the unified dashboard
 * shell and never show the public landing chrome. Client-facing pages
 * always keep the landing layout (navbar + footer + mobile nav). */
const isDashboardRoute = computed(() => {
  const path = route.path || ''
  // NOTE: '/provider' prefix must not swallow public '/providers/*' —
  // match the exact dashboard roots only.
  return (
    path === '/admin' ||
    path.startsWith('/admin/') ||
    path === '/provider' ||
    path.startsWith('/provider/')
  )
})
</script>

<template>
  <a href="#main-content" class="visually-hidden">{{ t('common.skipToMain') }}</a>
  <LoadingBar />
  <AppHeader />
  <ToastContainer />
  <ResultModal />
  <ConfirmDialog />
  <main id="main-content" tabindex="-1">
    <RouterView v-slot="{ Component }">
      <Transition name="page" mode="out-in">
        <component :is="Component" :key="route.fullPath" />
      </Transition>
    </RouterView>
  </main>
  <AppFooter v-if="showFooter && !isDashboardRoute" />
  <AppMobileNav v-if="!isDashboardRoute" />
  <WhatsAppFab
    v-if="showWhatsApp && !isDashboardRoute"
    :phone="services.contentService.supportContact.value.whatsAppNumber"
    :bottom-offset="whatsAppOffset"
  />
</template>

<style>
</style>
