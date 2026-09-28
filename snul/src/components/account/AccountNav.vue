<script setup lang="ts">
import { t } from '../../i18n'
</script>

<template>
  <nav class="account-nav" :aria-label="t('nav.account')">
    <div class="account-nav__track">
      <router-link to="/account" class="account-nav__link" exact-active-class="is-active">
        <span class="material-symbols-outlined nav-icon">dashboard</span>
        <span>{{ t('account.dashboard') }}</span>
      </router-link>
      <router-link to="/account/rfqs" class="account-nav__link" active-class="is-active">
        <span class="material-symbols-outlined nav-icon">request_quote</span>
        <span>{{ t('sales.rfqTitle') }}</span>
      </router-link>
      <router-link to="/account/quotes" class="account-nav__link" active-class="is-active">
        <span class="material-symbols-outlined nav-icon">description</span>
        <span>{{ t('sales.quoteTitle') }}</span>
      </router-link>
      <router-link to="/account/orders" class="account-nav__link" active-class="is-active">
        <span class="material-symbols-outlined nav-icon">local_shipping</span>
        <span>{{ t('commerce.ordersTitle') }}</span>
      </router-link>
    </div>
  </nav>
</template>

<style scoped>
.account-nav {
  margin-bottom: 1.5rem;
  width: 100%;
  box-sizing: border-box;
}

.account-nav__track {
  display: inline-flex;
  align-items: center;
  gap: 0.25rem;
  padding: 0.3rem;
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: 10px;
  overflow-x: auto;
  -webkit-overflow-scrolling: touch;
  scrollbar-width: none;
  max-width: 100%;
  box-sizing: border-box;
}

.account-nav__track::-webkit-scrollbar {
  display: none;
}

.account-nav__link {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  padding: 0.45rem 0.85rem;
  font-size: 0.84rem;
  font-weight: 500;
  color: var(--wl-ink-soft);
  text-decoration: none;
  border-radius: 7px;
  transition: all 0.15s ease;
  white-space: nowrap;
  min-height: 36px;
  flex-shrink: 0;
}

.account-nav__link:hover {
  color: var(--wl-ink-strong);
}

.account-nav__link.is-active {
  color: var(--wl-ink-strong);
  background: var(--wl-surface);
  font-weight: 600;
  box-shadow: 0 1px 3px rgba(0, 10, 25, 0.08), 0 1px 2px rgba(0, 10, 25, 0.04);
}

.nav-icon {
  font-size: 17px;
  color: var(--wl-muted);
}

.account-nav__link.is-active .nav-icon {
  color: var(--wl-primary);
}

@media (max-width: 640px) {
  .account-nav {
    margin-bottom: 1.15rem;
  }
  .account-nav__track {
    display: flex;
    width: 100%;
    padding: 0.25rem;
    gap: 0.2rem;
  }
  .account-nav__link {
    padding: 0.4rem 0.65rem;
    font-size: 0.78rem;
    min-height: 34px;
    gap: 0.35rem;
  }
  .nav-icon {
    font-size: 16px;
  }
}
</style>
