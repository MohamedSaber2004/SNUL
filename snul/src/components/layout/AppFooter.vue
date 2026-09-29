<script setup lang="ts">
import { computed } from 'vue'
import { t } from '../../i18n'
import { authService, services } from '../../di/container'
import { useSiteLogo } from '../../composables/useSiteLogo'

const support = computed(() => services.contentService.supportContact.value)
const isAuthed = computed(() => authService.isAuthenticated)
const { logoUrl: footerLogoUrl, altText: footerLogoAlt } = useSiteLogo()
</script>

<template>
  <footer class="footer">
    <div class="footer__inner" :class="{ 'is-guest': !isAuthed }">
      <div class="footer__brand">
        <div class="footer__logo">
          <img v-if="footerLogoUrl" :src="footerLogoUrl" :alt="footerLogoAlt" width="120" height="28" loading="lazy" />
          <span class="brand-title">SNUL</span>
        </div>
        <p class="brand-desc">{{ t('footer.brandDesc') }}</p>
        <div class="footer-badges mono">
          <span class="footer-badge">ISO 13485:2016</span>
        <span class="footer-badge">CE MDR Class IIa</span>
        <span class="footer-badge">UDI lot-traceable</span>
        </div>
      </div>

      <div class="footer__col">
        <h3>{{ t('footer.product') }}</h3>
        <router-link to="/marketplace" class="footer__link">{{ t('nav.marketplace') }}</router-link>
        <router-link to="/providers" class="footer__link">{{ t('nav.providers') }}</router-link>
        <router-link to="/certifications" class="footer__link">{{ t('nav.certifications') }}</router-link>
        <router-link to="/oem" class="footer__link">{{ t('nav.oem') }}</router-link>
      </div>

      <div v-if="isAuthed" class="footer__col">
        <h3>{{ t('footer.account') }}</h3>
        <router-link to="/account" class="footer__link">{{ t('nav.account') }}</router-link>
        <router-link to="/account/rfqs" class="footer__link">{{ t('sales.rfqTitle') }}</router-link>
        <router-link to="/account/quotes" class="footer__link">{{ t('sales.quoteTitle') }}</router-link>
        <router-link to="/account/orders" class="footer__link">{{ t('commerce.ordersTitle') }}</router-link>
        <router-link to="/addresses" class="footer__link">{{ t('profile.addresses') }}</router-link>
      </div>

      <div class="footer__col">
        <h3>{{ t('footer.support') }}</h3>
        <router-link to="/about" class="footer__link">{{ t('nav.about') }}</router-link>
        <router-link to="/help" class="footer__link">{{ t('footer.helpCenter') }}</router-link>
        <router-link v-if="isAuthed" to="/help/my-tickets" class="footer__link">{{ t('help.myTickets') }}</router-link>
        <a v-if="support.supportEmail" class="footer__link" :href="'mailto:' + support.supportEmail">
          {{ support.supportEmail }}
        </a>
        <a v-if="support.phoneNumber" class="footer__link" :href="'tel:' + support.phoneNumber.replace(/\s+/g, '')">
          {{ support.phoneNumber }}
        </a>
        <span v-if="support.workingHours" class="footer__note mono">{{ support.workingHours }}</span>
      </div>
    </div>

    <div class="footer__bottom">
      <div class="footer__bottom-left">
        <span>© {{ new Date().getFullYear() }} SNUL Medical Devices & Surgical Instruments. All rights reserved.</span>
        <span class="compliance-note">Passivated Stainless Steel DIN EN ISO 17664 · 134°C Autoclave Validated.</span>
      </div>
      <div class="footer__bottom-right mono">
        <span class="telemetry-pill">
          <span class="status-dot"></span>
          <span>{{ t('footer.productionOnline') }}</span>
        </span>
      </div>
    </div>
  </footer>
</template>

<style scoped>
.footer {
  background: radial-gradient(circle at 80% 20%, rgba(14, 165, 233, 0.16), transparent 26rem), linear-gradient(135deg, #071526 0%, #0A2342 55%, #0C3866 100%) !important;
  color: rgba(240, 247, 255, 0.90) !important;
  border-top: 1px solid rgba(216, 228, 240, 0.15) !important;
  padding: clamp(3rem, 7vw, 6rem) var(--wl-gutter) 1.5rem;
  position: relative;
  padding-inline-start: max(var(--wl-gutter), env(safe-area-inset-left, 0px));
  padding-inline-end: max(var(--wl-gutter), env(safe-area-inset-right, 0px));
  padding-bottom: max(1.5rem, env(safe-area-inset-bottom, 0px));
}
.footer::before {
  display: none;
}
.footer__inner {
  max-width: var(--wl-max-width);
  margin: 0 auto;
  display: grid;
  grid-template-columns: 1.5fr repeat(3, 1fr);
  gap: 2.5rem;
}
.footer__inner.is-guest {
  grid-template-columns: 1.5fr repeat(2, 1fr);
}

.footer__logo {
  display: inline-flex;
  align-items: center;
  gap: 0.65rem;
}

.footer__logo img {
  height: 26px;
  width: auto;
  border-radius: 6px;
}

.brand-title {
  font-family: var(--wl-font-display);
  font-size: 1.15rem;
  font-weight: 800;
  color: #ffffff;
  letter-spacing: -0.015em;
}

.brand-desc {
  margin: 0.85rem 0 1.15rem;
  font-size: 13px;
  color: #ffffff !important;
  opacity: 0.92;
  line-height: 1.6;
  max-width: 320px;
}

.footer-badges {
  display: flex;
  gap: 0.4rem;
  flex-wrap: wrap;
}

.footer-badge {
  font-size: var(--text-2xs);
  font-weight: var(--weight-medium);
  color: #ffffff;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.22);
  padding: 0.2rem 0.5rem;
  border-radius: var(--radius-xs);
}

.footer__col h4,
.footer__title {
  font-family: var(--font-display);
  font-size: var(--text-xs);
  letter-spacing: var(--tracking-wide);
  text-transform: uppercase;
  color: #ffffff !important;
  margin-bottom: 0.95rem;
  font-weight: 700;
}

.footer__link {
  display: block;
  font-size: 13.5px;
  padding: 0.35rem 0;
  color: #ffffff !important;
  text-decoration: none;
  transition: color 0.15s ease, transform 0.15s ease;
}

.footer__link:hover {
  color: #7DD3FC !important;
  transform: translateX(2px);
}

.footer__note {
  display: block;
  font-size: 10.5px;
  color: #ffffff !important;
  opacity: 0.85;
  padding: 0.35rem 0;
  line-height: 1.5;
}
[dir='rtl'] .footer__link:hover {
  transform: translateX(-2px);
}
@media (hover: none) {
  .footer__link:hover { transform: none; }
  .footer__link:active { color: #38BDF8; }
}

.footer__bottom {
  max-width: var(--wl-max-width);
  margin: 2.5rem auto 0;
  border-top: 1px solid rgba(255, 255, 255, 0.14);
  padding-top: 1.25rem;
  display: flex;
  justify-content: space-between;
  align-items: center;
  gap: 1rem;
  flex-wrap: wrap;
  font-size: 11.5px;
  color: #ffffff !important;
}

.footer__bottom-left {
  display: flex;
  flex-direction: column;
  gap: 0.25rem;
}

.compliance-note {
  font-size: 10.5px;
  color: #ffffff !important;
  opacity: 0.85;
}

.telemetry-pill {
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  font-family: var(--font-mono, monospace);
  font-size: 10px;
  font-weight: 600;
  letter-spacing: 0.04em;
  text-transform: uppercase;
  color: #FFFFFF;
  background: var(--accent);
  border: 1px solid rgba(2, 132, 199, 0.4);
  padding: 0.2rem 0.55rem;
  border-radius: var(--radius-xs, 3px);
}
.status-dot {
  width: 6px;
  height: 6px;
  border-radius: 50%;
  background: #FFFFFF;
  box-shadow: 0 0 0 2px rgba(255, 255, 255, 0.35);
}

@media (max-width: 1024px) {
  .footer__inner { gap: 2rem; }
}
@media (max-width: 900px) {
  .footer__inner {
    grid-template-columns: repeat(2, 1fr);
    gap: 1.75rem;
  }
  .footer__brand { grid-column: 1 / -1; }
}
@media (max-width: 640px) {
  .footer { padding: 2rem var(--wl-gutter) max(1.25rem, env(safe-area-inset-bottom, 0px)); }
  .footer__inner { grid-template-columns: 1fr 1fr; gap: 1.5rem; }
  .footer__link { font-size: 13px; padding: 0.4rem 0; min-height: 32px; display: flex; align-items: center; }
  .footer__bottom { flex-direction: column; align-items: flex-start; gap: 0.75rem; }
}
@media (max-width: 480px) {
  .footer__inner { grid-template-columns: 1fr; gap: 1.25rem; }
  .footer__bottom { gap: 0.6rem; }
  .brand-desc { max-width: 100%; }
}
@media (max-width: 360px) {
  .footer__inner { gap: 1rem; }
  .footer-badges { gap: 0.3rem; }
  .footer-badge { font-size: 9px; padding: 0.15rem 0.4rem; }
}
</style>
