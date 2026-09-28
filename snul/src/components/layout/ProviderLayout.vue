<script setup lang="ts">
import { computed } from 'vue'
import { t } from '../../i18n'
import DashboardShell, { type DashboardNavSection } from './DashboardShell.vue'

const sections = computed<DashboardNavSection[]>(() => [
  {
    key: 'commercial',
    label: t('admin.commerce'),
    collapsible: false,
    links: [
      { to: '/provider/quotes', icon: 'request_quote', label: t('provider.quotes') },
      { to: '/provider/orders', icon: 'local_shipping', label: t('provider.orders') },
    ],
  },
  {
    key: 'catalog',
    label: t('provider.myCatalog'),
    collapsible: false,
    links: [
      { to: '/provider/catalog', icon: 'inventory_2', label: t('provider.myCatalog') },
      { to: '/provider/categories', icon: 'category', label: t('provider.categories') },
    ],
  },
  {
    key: 'support',
    label: t('provider.support'),
    collapsible: false,
    links: [
      { to: '/provider/support', icon: 'contact_support', label: t('provider.support') },
    ],
  },
  {
    key: 'account',
    label: t('nav.account'),
    collapsible: false,
    links: [
      { to: '/profile', icon: 'apartment', label: t('nav.profile') },
      { to: '/marketplace', icon: 'storefront', label: t('nav.marketplace') },
    ],
  },
])
</script>

<template>
  <DashboardShell
    storage-key="snul-provider-rail-collapsed"
    :brand-text="t('provider.dashboard')"
    :sections="sections"
    :status-text="t('admin.systemLive')"
  >
    <slot />
  </DashboardShell>
</template>
