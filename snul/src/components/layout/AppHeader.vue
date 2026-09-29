<script setup lang="ts">
import { computed, ref, onMounted, onUnmounted, watch } from 'vue'
import { useRouter } from 'vue-router'
import { authService } from '../../di/container'
import { t, locale, setLocale } from '../../i18n'
import { resolveFileUrl, PLACEHOLDER, markBrokenUrl, isKnownBrokenUrl } from '../../utils/file-url'
import { AppLanguage } from '../../domain/models/user'
import { useCart } from '../../composables/useCart'
import { wishlistService } from '../../di/container'
import { useSiteLogo } from '../../composables/useSiteLogo'

const router = useRouter()
const mobileOpen = ref(false)
const userMenuOpen = ref(false)
const searchQuery = ref('')
const mobileSearchOpen = ref(false)
const mobileSearchInput = ref<HTMLInputElement | null>(null)

const toggleMobileSearch = () => {
  mobileSearchOpen.value = !mobileSearchOpen.value
  if (mobileSearchOpen.value) {
    mobileOpen.value = false
    userMenuOpen.value = false
    setTimeout(() => {
      mobileSearchInput.value?.focus()
    }, 80)
  }
}

const toggleLang = async () => {
  const next = locale.value === 'ar' ? 'en' : 'ar'
  setLocale(next)
  userMenuOpen.value = false
  mobileOpen.value = false
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

const isAuthed  = computed(() => authService.isAuthenticated)
const isAdmin   = computed(() => authService.isAdmin.value)
const isSales   = computed(() => authService.isSales.value)
const isStaff   = computed(() => isAdmin.value || isSales.value)
const isProvider = computed(() => authService.isProvider.value)
const isBuyer   = computed(() => authService.isClient.value)
const isSeller  = computed(() => isStaff.value)
const user      = computed(() => authService.user.value)
const avatarSrc = computed(() => {
  const name = user.value?.profilePictureName
  if (!name) return ''
  const url = resolveFileUrl(name, '')
  if (!url || url === PLACEHOLDER || url === '/images/placeholder.svg' || isKnownBrokenUrl(url)) return ''
  return url
})
const avatarInitials = computed(() => {
  const n = user.value?.fullName?.trim() ?? user.value?.email ?? '?'
  return n.split(/\s+/).slice(0, 2).map(s => s[0]?.toUpperCase()).join('') || '?'
})
const avatarFailed = ref(false)
const hasAvatar = computed(() => !!avatarSrc.value && !avatarFailed.value)
const userRoleLabel = computed(() =>
  // 4-role model: Provider/Distributor (has company) vs Customer (buyer) vs Admin/Staff.
  user.value ? t(`admin.${authService.resolveBusinessRoleKey()}`) : '',
)
const { count: cartCount } = useCart()
const wishlistCount = computed(() => wishlistService.count.value)
const { logoUrl: headerLogoUrl } = useSiteLogo()

const handleLogout = async () => { userMenuOpen.value = false; mobileOpen.value = false; mobileSearchOpen.value = false; await authService.logout() }
const closeMobile  = () => { mobileOpen.value = false; mobileSearchOpen.value = false }
const navigate     = (name: string) => { void router.push({ name }); mobileOpen.value = false; mobileSearchOpen.value = false }
const onSearch = () => {
  if (!searchQuery.value.trim()) return
  void router.push({ name: 'marketplace', query: { search: searchQuery.value.trim() } })
  searchQuery.value = ''
  mobileOpen.value = false
  mobileSearchOpen.value = false
}

const onClickOutside = (e: MouseEvent) => {
  const target = e.target as HTMLElement
  if (!target.closest('.header__user-wrap')) userMenuOpen.value = false
  if (!target.closest('.header__mobile-search-bar') && !target.closest('.header__search-mobile-btn')) {
    mobileSearchOpen.value = false
  }
}
watch(avatarSrc, () => { avatarFailed.value = false })
watch(isAuthed, (v) => { if (v) void authService.loadProfile().catch(() => {}) })

onMounted(() => {
  document.addEventListener('click', onClickOutside)
  if (isAuthed.value) void authService.loadProfile().catch(() => {})
  void wishlistService.load().catch(() => {})
})
onUnmounted(() => document.removeEventListener('click', onClickOutside))
watch(isAuthed, (v) => {
  if (v) void wishlistService.refresh().catch(() => {})
  else wishlistService.clear()
})
</script>

<template>
  <header class="header">
    <div class="header__sweep" aria-hidden="true"></div>
    <div class="header__inner">
      <div class="header__brand">
        <button
          v-if="!((isStaff || isProvider) && isAuthed)"
          class="header__burger"
          :aria-label="t('nav.toggleMenu')"
          :aria-expanded="mobileOpen"
          type="button"
          @click="mobileOpen = !mobileOpen; mobileSearchOpen = false"
        >
          <span :class="{ open: mobileOpen }"></span>
          <span :class="{ open: mobileOpen }"></span>
          <span :class="{ open: mobileOpen }"></span>
        </button>

        <router-link :to="isStaff && isAuthed ? '/admin' : (isProvider && isAuthed ? '/provider' : '/')" class="logo" @click="closeMobile" :aria-label="t('nav.home')">
          <img v-if="headerLogoUrl" :src="headerLogoUrl" alt="" class="logo__img" width="120" height="28" loading="eager" />
          <span class="logo__word">SNUL</span>
        </router-link>
      </div>

      <nav v-if="!((isStaff || isProvider) && isAuthed)" class="navbar-menu" :aria-label="t('nav.navigation')">
        <template v-if="isBuyer && isAuthed">
          <router-link to="/" class="navbar-menu__link">{{ t('nav.home') }}</router-link>
          <router-link to="/marketplace" class="navbar-menu__link">{{ t('nav.marketplace') }}</router-link>
          <router-link to="/about" class="navbar-menu__link">{{ t('nav.about') }}</router-link>
          <router-link to="/account" class="navbar-menu__link">{{ t('nav.account') }}</router-link>
          <router-link to="/wishlist" class="navbar-menu__link">{{ t('nav.wishlist') }}</router-link>
          <router-link to="/help/my-tickets" class="navbar-menu__link">{{ t('help.myTickets') }}</router-link>
          <router-link to="/help" class="navbar-menu__link">{{ t('nav.help') }}</router-link>
        </template>
        <template v-else>
          <router-link to="/" class="navbar-menu__link">{{ t('nav.home') }}</router-link>
          <router-link to="/marketplace" class="navbar-menu__link">{{ t('nav.marketplace') }}</router-link>
          <router-link to="/providers" class="navbar-menu__link">{{ t('nav.providers') }}</router-link>
          <router-link to="/about" class="navbar-menu__link">{{ t('nav.about') }}</router-link>
          <router-link to="/certifications" class="navbar-menu__link">{{ t('nav.certifications') }}</router-link>
          <router-link to="/help" class="navbar-menu__link">{{ t('nav.help') }}</router-link>
        </template>
      </nav>
      <div v-else class="navbar-menu navbar-menu--spacer"></div>

      <form v-if="!((isStaff || isProvider) && isAuthed)" class="header__search" @submit.prevent="onSearch" role="search">
        <span class="material-symbols-outlined header__search-icon" aria-hidden="true">search</span>
        <input v-model="searchQuery" :placeholder="t('marketplace.searchPlaceholder')" :aria-label="t('marketplace.searchPlaceholder')" />
        <span class="header__search-kbd mono">⌘K</span>
      </form>

      <div class="header__actions">
        <button
          v-if="!((isStaff || isProvider) && isAuthed)"
          class="icon-btn header__search-mobile-btn"
          :aria-label="t('marketplace.searchPlaceholder')"
          type="button"
          @click="toggleMobileSearch"
        >
          <span class="material-symbols-outlined" style="font-size:18px">search</span>
        </button>

        <router-link v-if="isAuthed && !isStaff && !isProvider" to="/wishlist" class="icon-btn" :aria-label="t('nav.wishlist')" :title="t('nav.wishlist')">
          <span class="material-symbols-outlined" style="font-size:18px">favorite</span>
          <span v-if="wishlistCount > 0" class="icon-btn__badge">{{ wishlistCount > 9 ? '9+' : wishlistCount }}</span>
        </router-link>
        <router-link v-if="!isStaff && !isProvider" to="/cart" class="icon-btn" :aria-label="t('nav.cart')" :title="t('nav.cart')">
          <span class="material-symbols-outlined" style="font-size:18px">shopping_bag</span>
          <span v-if="cartCount > 0" class="icon-btn__badge icon-btn__badge--cart">{{ cartCount > 9 ? '9+' : cartCount }}</span>
        </router-link>

        <button class="icon-btn lang-btn" :aria-label="locale === 'ar' ? 'English' : 'العربية'" :title="locale === 'ar' ? 'Switch to English' : 'التحويل إلى العربية'" @click="toggleLang">
          <span class="material-symbols-outlined" style="font-size:18px" aria-hidden="true">language</span>
        </button>

        <template v-if="isAuthed">
          <div class="header__user-wrap">
            <button class="header__user" type="button" @click.stop="userMenuOpen = !userMenuOpen" :aria-expanded="userMenuOpen">
              <span class="header__avatar" :style="{ background: user?.tint || '#0F3D56' }">
                <img v-if="hasAvatar" :src="avatarSrc" :alt="user?.fullName ?? ''" class="header__avatar-img" @error="avatarFailed = true; markBrokenUrl(avatarSrc)" />
                <span v-else class="header__avatar-fallback">{{ avatarInitials }}</span>
              </span>
              <span class="header__user-text">
                <span class="header__user-name">{{ user?.fullName }}</span>
                <span class="header__user-role mono">{{ isStaff ? (isAdmin ? t('admin.roleAdmin') : t('admin.roleSales')) : (isProvider ? t('admin.roleProvider') : userRoleLabel) }}</span>
              </span>
            </button>
            <Transition name="drop">
              <div v-if="userMenuOpen" class="header__dropdown" role="menu">
                <div class="header__dropdown-head">
                  <strong>{{ user?.fullName }}</strong>
                  <span>{{ user?.email }}</span>
                </div>
                <router-link v-if="isProvider" to="/provider" class="header__dropdown-item" role="menuitem" @click="userMenuOpen=false">
                  <span class="material-symbols-outlined text-[18px]">dashboard</span>
                  <span>{{ t('provider.dashboard') }}</span>
                </router-link>
                <router-link v-if="isProvider" to="/provider/catalog" class="header__dropdown-item" role="menuitem" @click="userMenuOpen=false">
                  <span class="material-symbols-outlined text-[18px]">inventory_2</span>
                  <span>{{ t('provider.myCatalog') }}</span>
                </router-link>
                <router-link v-if="isProvider" to="/provider/quotes" class="header__dropdown-item" role="menuitem" @click="userMenuOpen=false">
                  <span class="material-symbols-outlined text-[18px]">request_quote</span>
                  <span>{{ t('provider.quotes') }}</span>
                </router-link>
                <router-link v-if="isProvider" to="/provider/orders" class="header__dropdown-item" role="menuitem" @click="userMenuOpen=false">
                  <span class="material-symbols-outlined text-[18px]">local_shipping</span>
                  <span>{{ t('provider.orders') }}</span>
                </router-link>
                <router-link to="/profile" class="header__dropdown-item" role="menuitem" @click="userMenuOpen=false">
                  <span class="material-symbols-outlined text-[18px]">person</span>
                  <span>{{ t('nav.profile') }}</span>
                </router-link>
                <router-link v-if="isBuyer" to="/account/orders" class="header__dropdown-item" role="menuitem" @click="userMenuOpen=false">
                  <span class="material-symbols-outlined text-[18px]">local_shipping</span>
                  <span>{{ t('account.myOrders') }}</span>
                </router-link>
                <router-link v-if="isBuyer" to="/help/my-tickets" class="header__dropdown-item" role="menuitem" @click="userMenuOpen=false">
                  <span class="material-symbols-outlined text-[18px]">confirmation_number</span>
                  <span>{{ t('help.myTickets') }}</span>
                </router-link>
                <button
                  type="button"
                  class="header__dropdown-item"
                  role="menuitem"
                  @click="toggleLang"
                >
                  <span class="material-symbols-outlined text-[18px]">language</span>
                  <span>{{ locale === 'ar' ? 'English (الإنجليزية)' : 'العربية (Arabic)' }}</span>
                </button>
                <button class="header__dropdown-item header__dropdown-item--danger" role="menuitem" @click="handleLogout">
                  <span class="material-symbols-outlined text-[18px]">logout</span>
                  <span>{{ t('nav.logout') }}</span>
                </button>
              </div>
            </Transition>
          </div>
        </template>
        <template v-else>
          <div class="header__auth-desktop">
            <button class="btn btn-ghost btn-sm" type="button" @click="navigate('login')">{{ t('nav.login') }}</button>
            <button class="btn btn-primary btn-sm" type="button" @click="navigate('register')">{{ t('nav.register') }}</button>
          </div>
          <button class="icon-btn header__auth-mobile" :aria-label="t('nav.login')" type="button" @click="navigate('login')">
            <span class="material-symbols-outlined" style="font-size:18px">person</span>
          </button>
        </template>
      </div>
    </div>

    <!-- Mobile Expandable Search Bar -->
    <Transition name="search-slide">
      <div v-if="mobileSearchOpen" class="header__mobile-search-bar">
        <form class="header__mobile-search-form" @submit.prevent="onSearch" role="search">
          <span class="material-symbols-outlined" style="font-size:18px;color:var(--fg-muted)">search</span>
          <input
            ref="mobileSearchInput"
            v-model="searchQuery"
            :placeholder="t('marketplace.searchPlaceholder')"
            :aria-label="t('marketplace.searchPlaceholder')"
          />
          <button v-if="searchQuery" type="button" class="search-clear-btn" @click="searchQuery = ''" aria-label="Clear">
            <span class="material-symbols-outlined" style="font-size:16px">close</span>
          </button>
          <button type="submit" class="btn btn-primary btn-sm search-submit-btn">
            {{ locale === 'ar' ? 'بحث' : 'Search' }}
          </button>
        </form>
      </div>
    </Transition>

    <Transition name="drawer">
      <nav v-if="mobileOpen" class="header__drawer" aria-label="Mobile">
        <template v-if="isBuyer && isAuthed">
          <router-link to="/" class="header__drawer-link" @click="closeMobile">{{ t('nav.home') }}</router-link>
          <router-link to="/marketplace" class="header__drawer-link" @click="closeMobile">{{ t('nav.marketplace') }}</router-link>
          <router-link to="/about" class="header__drawer-link" @click="closeMobile">{{ t('nav.about') }}</router-link>
          <router-link to="/account" class="header__drawer-link" @click="closeMobile">{{ t('nav.account') }}</router-link>
          <router-link to="/account/orders" class="header__drawer-link" @click="closeMobile">{{ t('account.myOrders') }}</router-link>
          <router-link to="/wishlist" class="header__drawer-link" @click="closeMobile">{{ t('nav.wishlist') }}</router-link>
          <router-link to="/cart" class="header__drawer-link" @click="closeMobile">{{ t('nav.cart') }}</router-link>
          <router-link to="/help/my-tickets" class="header__drawer-link" @click="closeMobile">{{ t('help.myTickets') }}</router-link>
          <router-link to="/help" class="header__drawer-link" @click="closeMobile">{{ t('nav.help') }}</router-link>
          <router-link v-if="isProvider" to="/provider" class="header__drawer-link" @click="closeMobile">{{ t('provider.dashboard') }}</router-link>
        </template>
        <template v-else>
          <router-link to="/" class="header__drawer-link" @click="closeMobile">{{ t('nav.home') }}</router-link>
          <router-link to="/marketplace" class="header__drawer-link" @click="closeMobile">{{ t('nav.marketplace') }}</router-link>
          <router-link to="/providers" class="header__drawer-link" @click="closeMobile">{{ t('nav.providers') }}</router-link>
          <router-link to="/about" class="header__drawer-link" @click="closeMobile">{{ t('nav.about') }}</router-link>
          <router-link to="/certifications" class="header__drawer-link" @click="closeMobile">{{ t('nav.certifications') }}</router-link>
          <router-link to="/help" class="header__drawer-link" @click="closeMobile">{{ t('nav.help') }}</router-link>
          <router-link v-if="!isAuthed" to="/auth/login" class="header__drawer-link" @click="closeMobile">{{ t('nav.login') }}</router-link>
          <router-link v-if="!isAuthed" to="/auth/register" class="header__drawer-link" @click="closeMobile">{{ t('nav.register') }}</router-link>
        </template>
        <div class="header__drawer-footer">
          <button type="button" class="header__drawer-btn" @click="toggleLang">
            <span class="material-symbols-outlined text-[18px]">language</span>
            <span>{{ locale === 'ar' ? 'English' : 'العربية' }}</span>
          </button>
        </div>
      </nav>
    </Transition>
  </header>
</template>

<style scoped>
.header {
  position: sticky;
  top: 0;
  z-index: var(--z-sticky);
  background: radial-gradient(circle at 85% 24%, rgba(2, 132, 199, 0.25), transparent 22rem), linear-gradient(118deg, #071526 0%, #0A2342 52%, #0C3E6D 100%) !important;
  border-bottom: 1px solid rgba(216, 228, 240, 0.15) !important;
  box-shadow: 0 8px 28px rgba(7, 21, 38, 0.35) !important;
  color: #ffffff !important;
  padding-inline-start: env(safe-area-inset-left, 0px);
  padding-inline-end: env(safe-area-inset-right, 0px);
}
.header__sweep { display: none; }
.header__inner {
  max-width: var(--wl-max-width);
  margin: 0 auto;
  padding: 0 var(--wl-gutter);
  padding-inline-start: max(var(--wl-gutter), env(safe-area-inset-left));
  padding-inline-end: max(var(--wl-gutter), env(safe-area-inset-right));
  height: var(--wl-header-height, 56px);
  min-height: var(--wl-header-height, 56px);
  display: flex;
  align-items: center;
  justify-content: space-between;
  gap: 1rem;
  min-width: 0;
  width: 100%;
  direction: inherit;
}
.header__brand {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
  min-width: 0;
}
.logo {
  display: inline-flex;
  align-items: center;
  gap: 0.6rem;
  text-decoration: none;
  flex-shrink: 0;
}
.logo__img { height: 26px; width: auto; border-radius: 6px; max-width: none; }
.logo__word {
  font-family: var(--font-display);
  font-weight: var(--weight-bold);
  font-size: var(--text-xl);
  letter-spacing: var(--tracking-tight);
  white-space: nowrap;
  color: #ffffff;
}
.navbar-menu {
  display: flex;
  gap: var(--space-1);
  flex: 0 1 auto;
  align-items: center;
  justify-content: flex-start;
  min-width: 0;
  max-width: 100%;
  margin-inline: auto;
  padding: 3px;
  background: rgba(255, 255, 255, 0.10);
  border: 1px solid rgba(255, 255, 255, 0.18);
  border-radius: var(--radius-md, 6px);
  overflow-x: auto;
  overflow-y: hidden;
  scrollbar-width: none;
  -ms-overflow-style: none;
  backdrop-filter: blur(8px);
}
.navbar-menu:empty, .navbar-menu--spacer:empty { display: none; }
.navbar-menu::-webkit-scrollbar { display: none; }
.navbar-menu__link {
  flex-shrink: 0;
  padding: var(--space-2) var(--space-3);
  font-size: var(--text-md);
  font-weight: var(--weight-medium);
  color: rgba(247, 255, 254, 0.90);
  text-decoration: none;
  border-radius: var(--radius-sm, 4px);
  transition: background var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out);
  white-space: nowrap;
}
.navbar-menu__link:hover { color: #ffffff; background: rgba(255, 255, 255, 0.18); text-decoration: none; }
.navbar-menu__link.router-link-active { color: #ffffff; background: linear-gradient(135deg, #0C63B8 0%, #0284C7 100%); font-weight: 700; box-shadow: 0 2px 10px rgba(2, 132, 199, 0.35); }
.header__search {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: var(--radius-sm, 4px);
  padding: 0 0.6rem 0 0.7rem;
  height: 38px;
  max-height: 38px;
  min-width: var(--wl-header-search-min, 170px);
  max-width: var(--wl-header-search-max, 230px);
  flex-shrink: 1;
  transition: border-color var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out), background var(--duration-fast) var(--ease-out);
  overflow: hidden;
}
.header__search:focus-within { border-color: #38BDF8; box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.25); background: rgba(255, 255, 255, 0.20); }
.header__search-icon { font-size: 18px; color: rgba(255, 255, 255, 0.75); flex-shrink: 0; }
.header__search input { flex: 1; min-width: 0; min-height: 0; height: 100%; border: none; background: transparent; outline: none; font-size: 13px; color: #ffffff; font-family: var(--font-body); }
.header__search input:focus { background: transparent !important; }
.header__search input::placeholder { color: rgba(247, 255, 254, 0.65); }
[dir="rtl"] .header__search input { direction: rtl; text-align: right; }
.header__search-kbd {
  background: rgba(255, 255, 255, 0.14);
  border: 1px solid rgba(255, 255, 255, 0.24);
  border-bottom-width: 2px;
  padding: 0.1rem 0.35rem;
  border-radius: var(--radius-xs, 3px);
  font-family: var(--font-mono, monospace);
  font-size: 10px;
  color: rgba(255, 255, 255, 0.85);
  flex-shrink: 0;
}
.header__actions {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  flex-shrink: 0;
  margin: 0;
  margin-inline-start: auto;
}
.header__actions > * {
  margin: 0;
  flex-shrink: 0;
}
.header__auth-desktop {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  margin: 0;
  flex-shrink: 0;
}
.header__auth-desktop .btn {
  min-height: 40px;
  margin: 0;
  flex-shrink: 0;
}
/* NOTE: higher specificity than .icon-btn (which sets display:grid later in
 * this file) so the mobile-only buttons stay hidden on desktop. */
.icon-btn.header__auth-mobile,
.icon-btn.header__search-mobile-btn {
  display: none;
}
.icon-btn {
  width: 40px;
  height: 40px;
  min-width: 40px;
  min-height: 40px;
  border: 0;
  background: transparent;
  color: rgba(247, 255, 254, 0.9);
  display: grid;
  place-items: center;
  border-radius: var(--radius-pill);
  cursor: pointer;
  position: relative;
  transition: background var(--duration-fast) var(--ease-out), color var(--duration-fast) var(--ease-out);
  flex-shrink: 0;
}
.icon-btn:hover { background: rgba(255, 255, 255, 0.16); color: #ffffff; }
.icon-btn:focus-visible { outline: none; box-shadow: 0 0 0 3px rgba(214, 243, 106, 0.35); }
.icon-btn:active { transform: translateY(1px); }
.lang-btn {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  width: auto;
  min-width: 40px;
  padding-inline: var(--space-3);
  font-family: var(--font-body);
  font-size: var(--text-md);
  font-weight: var(--weight-medium);
  color: rgba(247, 255, 254, 0.9);
}
.lang-btn:hover { background: rgba(255, 255, 255, 0.16); color: #ffffff; }
.lang-btn__text {
  display: inline-block;
  line-height: 1;
}
.theme-btn {
  font-size: 18px;
  color: rgba(247, 255, 254, 0.9);
}
.icon-btn__badge {
  position: absolute;
  top: -6px;
  inset-inline-end: -6px;
  min-width: 18px;
  height: 18px;
  padding: 0 4px;
  background: #ef4444;
  color: #ffffff;
  font-family: var(--wl-font-mono);
  font-variant-numeric: tabular-nums;
  font-size: 10px;
  font-weight: 700;
  display: grid;
  place-items: center;
  border-radius: var(--radius-full);
  border: 2px solid #062f45;
}
.icon-btn__badge--cart {
  top: -5px;
  inset-inline-end: -5px;
  min-width: 21px;
  height: 21px;
  padding: 0 5px;
  background: var(--accent);
  color: #ffffff;
  border-color: #071526;
  font-size: 11px;
  font-weight: 800;
  box-shadow: 0 2px 8px rgba(2, 132, 199, 0.45);
}
.btn {
  font-family: var(--wl-font-body);
  font-weight: 600;
  font-size: 13px;
  padding: 8px 14px;
  border-radius: var(--radius-sm, 4px);
  border: 1px solid transparent;
  cursor: pointer;
  display: inline-flex;
  align-items: center;
  gap: 6px;
  transition: all 0.12s ease;
  white-space: nowrap;
  flex-shrink: 0;
}
.btn-primary { background: var(--brand); color: var(--fg-on-brand); border-color: var(--brand); box-shadow: var(--shadow-brand); }
.btn-primary:hover { background: var(--brand-hover); color: var(--fg-on-brand); }
.btn-ghost { background: var(--wl-surface); color: var(--wl-ink-strong); border-color: var(--wl-border); }
.btn-ghost:hover { background: var(--wl-surface-soft); }
.btn-sm { padding: 6px 12px; font-size: 12.5px; }
/* --accent (#0284C7) only reaches 4.09:1 against white text, which fails
   WCAG AA. Step down the ramp to --accent-hover (#0369A1, 5.93:1). */
.header__auth-desktop .btn-primary {
  background: var(--accent-hover);
  color: #ffffff;
  border-color: var(--accent-hover);
  font-weight: 700;
}
.header__auth-desktop .btn-primary:hover {
  background: var(--color-accent-800);
  color: #ffffff;
  box-shadow: 0 4px 14px rgba(3, 105, 161, 0.4);
}
.header__auth-desktop .btn-ghost {
  background: rgba(255, 255, 255, 0.12);
  color: #ffffff;
  border: 1px solid rgba(255, 255, 255, 0.25);
}
.header__auth-desktop .btn-ghost:hover {
  background: rgba(255, 255, 255, 0.22);
  border-color: rgba(255, 255, 255, 0.4);
}
.header__user-wrap { position: relative; flex-shrink: 0; }
.header__user {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  padding: var(--space-1) var(--space-2);
  border: 1px solid rgba(255, 255, 255, 0.16);
  background: rgba(255, 255, 255, 0.10);
  border-radius: var(--radius-pill);
  cursor: pointer;
  max-width: 180px;
  text-align: start;
}
.header__user:hover { background: rgba(255, 255, 255, 0.18); }
.header__avatar {
  width: 28px;
  height: 28px;
  border-radius: 50%;
  display: grid;
  place-items: center;
  color: white;
  font-weight: 700;
  font-size: 0.75rem;
  overflow: hidden;
  flex-shrink: 0;
}
.header__avatar-img { width: 100%; height: 100%; object-fit: cover; }
.header__avatar-fallback { width: 100%; height: 100%; display: grid; place-items: center; font-size: 0.7rem; font-weight: 700; }
.header__user-text { display: flex; flex-direction: column; align-items: flex-start; line-height: 1; min-width: 0; }
.header__user-name { font-size: var(--text-md); font-weight: var(--weight-semibold); color: #ffffff; max-width: 100px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; line-height: 1.3; }
.header__user-role { font-size: var(--text-xs); color: rgba(247, 255, 254, 0.7); }
.header__dropdown {
  position: absolute;
  top: calc(100% + var(--space-2));
  inset-inline-end: 0;
  min-width: 200px;
  max-width: calc(100vw - 1.5rem);
  padding: var(--space-2);
  background: var(--bg-surface);
  border: 1px solid var(--border);
  border-radius: var(--radius-md);
  box-shadow: var(--shadow-lg);
  overflow: hidden;
  z-index: var(--z-dropdown);
}
[dir="rtl"] .header__dropdown {
  direction: rtl;
  text-align: right;
}
[dir="ltr"] .header__dropdown {
  direction: ltr;
  text-align: left;
}
.header__dropdown-head { padding: 0.9rem 1rem; border-bottom: 1px solid var(--wl-border); display: flex; flex-direction: column; gap: 0.15rem; background: var(--wl-surface-soft); }
.header__dropdown-head strong { font-size: 0.85rem; color: var(--wl-ink-strong); }
.header__dropdown-head span { font-size: 0.75rem; color: var(--wl-muted); word-break: break-all; }
.header__dropdown-item {
  display: flex;
  align-items: center;
  gap: var(--space-3);
  width: 100%;
  padding: var(--space-3);
  background: none;
  border: 0;
  border-radius: var(--radius-sm);
  color: var(--fg-body);
  font-size: var(--text-md);
  cursor: pointer;
  text-decoration: none;
  min-height: 44px;
  text-align: start;
}
.header__dropdown-item:hover { background: var(--bg-app); color: var(--fg-heading); text-decoration: none; }
.header__dropdown-item--danger { color: var(--fg-danger); }
.header__burger {
  display: none;
  flex-direction: column;
  gap: 4px;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.22);
  cursor: pointer;
  padding: 8px;
  border-radius: var(--radius-md);
  width: 40px;
  height: 40px;
  min-width: 40px;
  min-height: 40px;
  align-items: center;
  justify-content: center;
  flex-shrink: 0;
  transition: background var(--duration-fast) var(--ease-out), border-color var(--duration-fast) var(--ease-out);
}
.header__burger:hover {
  background: rgba(255, 255, 255, 0.20);
  border-color: rgba(255, 255, 255, 0.35);
}
.header__burger span {
  width: 18px;
  height: 2px;
  background: #ffffff;
  border-radius: 999px;
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  display: block;
}
.header__burger span.open:nth-child(1) { transform: translateY(6px) rotate(45deg); }
.header__burger span.open:nth-child(2) { opacity: 0; transform: scaleX(0); }
.header__burger span.open:nth-child(3) { transform: translateY(-6px) rotate(-45deg); }
.header__drawer { display: none; }
@media (max-width: 1360px) {
  .header__inner { padding: 0 1.1rem; }
  .header__search { min-width: var(--wl-header-search-min, 170px); max-width: var(--wl-header-search-max, 230px); }
  .header__search-kbd { display: none; }
  .navbar-menu__link { padding: var(--space-2) var(--space-2); font-size: var(--text-sm); }
}
@media (max-width: 1180px) {
  .header__search { min-width: 160px; max-width: 210px; }
  .navbar-menu { gap: 0; }
  .navbar-menu__link { padding: var(--space-2) var(--space-2); font-size: var(--text-sm); }
  .header__actions { gap: 0.35rem; }
}
@media (max-width: 1024px) {
  .header__search { display: none; }
  .navbar-menu { display: none; }
  .header__burger { display: inline-flex; }
  .icon-btn.header__search-mobile-btn { display: inline-grid; }
  .header__actions {
    gap: 0.35rem;
    margin-inline-start: auto;
  }
  .header__drawer {
    display: flex;
    flex-direction: column;
    gap: 0.2rem;
    padding: 0.9rem 1rem 1.1rem;
    background: radial-gradient(circle at 85% 15%, rgba(214, 243, 106, 0.16), transparent 18rem), linear-gradient(135deg, #062f45 0%, #0b6370 58%, #094752 100%);
    border-top: 1px solid rgba(255, 255, 255, 0.12);
    box-shadow: var(--shadow-lg);
    max-height: calc(100dvh - var(--wl-header-height, 56px));
    overflow-y: auto;
    -webkit-overflow-scrolling: touch;
  }
  [dir="rtl"] .header__drawer { direction: rtl; text-align: right; }
  [dir="ltr"] .header__drawer { direction: ltr; text-align: left; }
  .header__drawer-link {
    display: flex;
    align-items: center;
    gap: 0.6rem;
    padding: 0.75rem 0.85rem;
    color: rgba(247, 255, 254, 0.9);
    text-decoration: none;
    border-radius: 8px;
    font-weight: 500;
    font-size: 14px;
    min-height: 44px;
  }
  .header__drawer-link:hover { background: rgba(255, 255, 255, 0.12); color: #ffffff; }
  .header__drawer-link.router-link-active { background: linear-gradient(135deg, #0C63B8, #0284C7); color: #ffffff; font-weight: 700; box-shadow: 0 2px 8px rgba(12, 99, 184, 0.40); }
  .header__drawer-footer {
    display: flex;
    gap: 0.5rem;
    padding-top: 0.8rem;
    margin-top: 0.5rem;
    border-top: 1px solid rgba(255, 255, 255, 0.14);
  }
  .header__drawer-btn {
    flex: 1;
    display: inline-flex;
    align-items: center;
    justify-content: center;
    gap: 0.5rem;
    padding: 0.65rem 0.75rem;
    border-radius: 8px;
    font-size: 13px;
    font-weight: 600;
    cursor: pointer;
    background: rgba(255, 255, 255, 0.12);
    border: 1px solid rgba(255, 255, 255, 0.22);
    color: #ffffff;
    transition: all 0.12s ease;
    min-height: 42px;
  }
  .header__drawer-btn:hover {
    border-color: #38BDF8;
    color: #38BDF8;
  }
}
.header__mobile-search-bar {
  padding: 0.55rem var(--wl-gutter, 1rem);
  background: #071526;
  border-bottom: 1px solid rgba(255, 255, 255, 0.12);
  box-shadow: var(--shadow-sm);
}
.header__mobile-search-form {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  background: rgba(255, 255, 255, 0.12);
  border: 1px solid rgba(255, 255, 255, 0.22);
  border-radius: var(--radius-md);
  padding: 0.35rem 0.6rem;
  transition: border-color var(--duration-fast) var(--ease-out), box-shadow var(--duration-fast) var(--ease-out);
}
.header__mobile-search-form:focus-within {
  border-color: #38BDF8;
  box-shadow: 0 0 0 3px rgba(56, 189, 248, 0.25);
}
.header__mobile-search-form input {
  flex: 1;
  min-width: 0;
  border: none;
  background: transparent;
  outline: none;
  font-size: 14px;
  color: #ffffff;
}
.header__mobile-search-form input:focus {
  background: transparent !important;
}
.header__mobile-search-form input::placeholder {
  color: rgba(247, 255, 254, 0.65);
}
[dir="rtl"] .header__mobile-search-form input {
  direction: rtl;
  text-align: right;
}
.search-clear-btn {
  border: none;
  background: transparent;
  color: rgba(255, 255, 255, 0.7);
  cursor: pointer;
  padding: 4px;
  display: grid;
  place-items: center;
  border-radius: 50%;
}
.search-clear-btn:hover {
  background: rgba(255, 255, 255, 0.15);
  color: #ffffff;
}
.search-submit-btn {
  flex-shrink: 0;
  padding: 4px 12px;
  font-size: 12px;
  min-height: 32px;
}
.search-slide-enter-active, .search-slide-leave-active {
  transition: all 0.2s cubic-bezier(0.16, 1, 0.3, 1);
  overflow: hidden;
}
.search-slide-enter-from, .search-slide-leave-to {
  opacity: 0;
  transform: translateY(-6px);
}

@media (max-width: 768px) {
  .header__auth-desktop { display: none; }
  .icon-btn.header__auth-mobile { display: inline-grid; }
}
@media (max-width: 640px) {
  .header__inner { gap: 0.5rem; }
  .header__user-text { display: none; }
  .header__user { padding: 0.2rem; border-radius: 50%; }
  .header__dropdown { min-width: 200px; max-width: calc(100vw - 1rem); inset-inline-end: 0; inset-inline-start: auto; }
  .header__actions { gap: 0.25rem; }
}
@media (max-width: 480px) {
  .header__inner {
    padding-inline: 0.65rem;
    gap: 0.35rem;
  }
  .header__brand { gap: 0.35rem; }
  .logo__word { display: none; }
  .logo__img { height: 24px; }
  .header__actions { gap: 0.2rem; }
  .lang-btn {
    padding-inline: 0.4rem;
    min-width: 36px;
  }
  .lang-btn .material-symbols-outlined { font-size: 16px; }
  .lang-btn__text { font-size: 11px; }
  .icon-btn, .header__burger {
    width: 38px;
    height: 38px;
    min-width: 38px;
    min-height: 38px;
  }
}
@media (max-width: 360px) {
  .header__inner {
    padding-inline: 0.45rem;
    gap: 0.2rem;
  }
  .header__brand { gap: 0.25rem; }
  .header__actions { gap: 0.15rem; }
  .icon-btn, .header__burger {
    width: 34px;
    height: 34px;
    min-width: 34px;
    min-height: 34px;
  }
}
.drop-enter-active, .drop-leave-active { transition: all 0.15s ease; }
.drop-enter-from, .drop-leave-to { opacity: 0; transform: translateY(-4px) scale(0.98); }
.drawer-enter-active, .drawer-leave-active { transition: all 0.2s ease; }
.drawer-enter-from, .drawer-leave-to { opacity: 0; transform: translateY(-6px); }
</style>
