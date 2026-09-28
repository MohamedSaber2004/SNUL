<script setup lang="ts">
import { ref, computed, onMounted } from 'vue'
import { t, locale } from '../i18n'
import { useAddresses } from '../composables/useAddresses'
import { useCompanyAddresses } from '../composables/useCompanyAddresses'
import { locationService, authService, companyService } from '../di/container'
import { currencyForAddressCountry } from '../utils/country-currency-map'
import BaseModal from '../components/ui/BaseModal.vue'
import BackButton from '../components/ui/BackButton.vue'
import SkeletonLoader from '../components/ui/SkeletonLoader.vue'
import ErrorState from '../components/ui/ErrorState.vue'
import EmptyState from '../components/ui/EmptyState.vue'

const personal = useAddresses()
const company = useCompanyAddresses()

const activeTab = ref<'personal' | 'company'>('personal')
const isCompanyUser = computed(() => authService.isOrganizationUser.value)

onMounted(async () => {
  await locationService.loadCountries().catch(() => {})
  if (isCompanyUser.value) {
    await companyService.loadMyCompany().catch(() => {})
    if (companyService.myCompany.value?.id) void company.load()
  }
})

const groupedPersonal = computed(() => {
  const m = new Map<string, typeof personal.addresses.value>()
  for (const a of personal.addresses.value) {
    const arr = m.get(a.countryId) ?? []
    arr.push(a)
    m.set(a.countryId, arr)
  }
  return [...m.entries()]
})

const groupedCompany = computed(() => {
  const m = new Map<string, typeof company.addresses.value>()
  for (const a of company.addresses.value) {
    const arr = m.get(a.countryId) ?? []
    arr.push(a)
    m.set(a.countryId, arr)
  }
  return [...m.entries()]
})

const localized = (en?: string | null, ar?: string | null): string => {
  if (locale.value === 'ar') return ar || en || ''
  return en || ar || ''
}

const countryLabel = (countryId: string) => {
  const c = locationService.getCountryById(countryId)
  if (!c) return '—'
  return localized(c.nameEn, c.nameAr)
}
const countryPhone = (countryId: string) => locationService.getCountryPhoneCode(countryId)
const countryIso = (countryId: string) => locationService.getCountryIso(countryId)
// Billing currency from the group's country when the API links one (null = unknown, pill hidden)
const groupCurrency = (countryId: string): string | null =>
  currencyForAddressCountry(locationService.countries.value, countryId)

const totalPersonal = computed(() => personal.addresses.value.length)
const totalCompany = computed(() => company.addresses.value.length)
</script>

<template>
  <div class="page-shell addresses-view">
    <BackButton fallback="/profile" variant="minimal" class="mb-3" />

    <!-- Breadcrumb -->
    <nav class="crumb-bar mono" :aria-label="t('common.breadcrumb')">
      <router-link to="/">{{ t('nav.home') }}</router-link>
      <span class="crumb-sep icon--directional">/</span>
      <router-link to="/profile">{{ t('profile.title') }}</router-link>
      <span class="crumb-sep icon--directional">/</span>
      <span class="crumb-active">{{ t('profile.addresses') }}</span>
    </nav>

    <!-- Executive Header -->
    <header class="addresses-head">
      <div>
        <div class="head-chip mono">
          <span class="pulse-dot"></span>
          <span>{{ t('addresses.eyebrow') }}</span>
        </div>
        <h1 class="head-title">{{ t('profile.addresses') }}</h1>
        <p class="head-subtitle">{{ t('profile.addressesDesc') }}</p>
      </div>

      <div class="head-actions">
        <button
          v-if="activeTab === 'personal'"
          type="button"
          class="btn-create-addr"
          @click="personal.openCreate()"
        >
          <span class="material-symbols-outlined text-[18px]">add_location</span>
          <span>{{ t('profile.addAddress') }}</span>
        </button>
        <button
          v-else
          type="button"
          class="btn-create-addr"
          @click="company.openCreate()"
        >
          <span class="material-symbols-outlined text-[18px]">add_business</span>
          <span>{{ t('addresses.addCompany') }}</span>
        </button>
      </div>
    </header>

    <!-- Tabs if Company User -->
    <div v-if="isCompanyUser" class="tab-ribbon">
      <button
        type="button"
        class="tab-btn mono"
        :class="{ 'is-active': activeTab === 'personal' }"
        @click="activeTab = 'personal'"
      >
        <span>{{ t('addresses.personalTab') }}</span>
        <span class="tab-chip">({{ totalPersonal }})</span>
      </button>
      <button
        type="button"
        class="tab-btn mono"
        :class="{ 'is-active': activeTab === 'company' }"
        @click="activeTab = 'company'"
      >
        <span>{{ t('addresses.companyTab') }}</span>
        <span class="tab-chip">({{ totalCompany }})</span>
      </button>
    </div>

    <!-- Info Callout Banner -->
    <div class="territory-info-banner">
      <span class="material-symbols-outlined banner-icon">share_location</span>
      <p class="banner-text">
        {{ t('addresses.hierarchyNote') }}
      </p>
    </div>

    <!-- TAB 1: Personal Addresses -->
    <template v-if="activeTab === 'personal'">
      <SkeletonLoader v-if="personal.loading.value && !personal.addresses.value.length" type="address-grid" :count="2" />

      <ErrorState
        v-else-if="personal.error.value && !personal.addresses.value.length"
        :message="personal.error.value"
        @retry="personal.load"
      />

      <EmptyState
        v-else-if="!personal.addresses.value.length"
        :title="t('profile.addressesEmpty')"
        :description="t('profile.addFirstDesc')"
        :action-text="t('profile.addAddress')"
        @action="personal.openCreate()"
      />

      <div v-else class="address-groups-stack">
        <div v-for="[countryId, group] in groupedPersonal" :key="countryId" class="country-cluster">
          <div class="cluster-head">
            <span class="material-symbols-outlined text-[18px] text-indigo-600">public</span>
            <h2 class="cluster-title">{{ countryLabel(countryId) }}</h2>
            <span class="mono country-pill">{{ countryIso(countryId) || '—' }} {{ countryPhone(countryId) || '' }}</span>
            <span class="mono cluster-count">{{ t('addresses.countInCountry', { count: group.length }) }}</span>
          </div>

          <div class="address-cards-grid">
            <article v-for="addr in group" :key="addr.id" class="address-card">
              <div class="card-main">
                <div class="addr-icon-box">
                  <span class="material-symbols-outlined">home</span>
                </div>
                <div class="addr-details">
                  <h3 class="street-name">{{ addr.street }}</h3>
                  <p class="building-meta">
                    <span v-if="addr.building">{{ t('profile.buildingShort', { building: addr.building }) }}</span>
                    <span v-if="addr.floor">, {{ t('profile.floorShort', { floor: addr.floor }) }}</span>
                    <span v-if="addr.apartment">, {{ t('profile.apartmentShort', { apartment: addr.apartment }) }}</span>
                  </p>
                  <div class="hierarchy-tags">
                    <span class="geo-pill mono">{{ localized(addr.countryNameEn, addr.countryNameAr) || countryLabel(addr.countryId) }}</span>
                    <span class="crumb-sep icon--directional">→</span>
                    <span class="geo-pill geo-pill--subtle mono">{{ localized(addr.cityNameEn, addr.cityNameAr) }}</span>
                    <span class="crumb-sep icon--directional">→</span>
                    <span class="geo-pill geo-pill--teal mono">{{ localized(addr.zoneNameEn, addr.zoneNameAr) }}</span>
                  </div>
                </div>
              </div>

              <div class="card-actions">
                <button type="button" class="btn-action-ghost" @click="personal.openEdit(addr)">
                  <span class="material-symbols-outlined text-[15px]">edit</span>
                  <span>{{ t('common.edit') }}</span>
                </button>
                <button type="button" class="btn-action-danger" @click="personal.handleDelete(addr.id)">
                  <span class="material-symbols-outlined text-[15px]">delete</span>
                  <span>{{ t('common.delete') }}</span>
                </button>
              </div>
            </article>
          </div>
        </div>
      </div>

      <!-- Personal Modal -->
      <BaseModal
        v-model="personal.showModal.value"
        :title="personal.editingId.value ? t('profile.editAddress') : t('profile.addAddress')"
        max-width="520px"
      >
        <form class="modal-form-stack" @submit.prevent="personal.handleSubmit">
          <div class="field-item">
            <label class="vip-field-label mono">{{ t('profile.country') }} *</label>
            <select v-model="personal.form.value.countryId" required class="vip-select">
              <option value="">{{ t('profile.selectCountry') }}</option>
              <option v-for="c in personal.countries.value" :key="c.id" :value="c.id">
                {{ localized(c.nameEn, c.nameAr) }} — {{ c.code }} {{ c.phoneCode }}
              </option>
            </select>
          </div>

          <div class="fields-2col">
            <div class="field-item">
              <label class="vip-field-label mono">{{ t('profile.city') }} *</label>
              <select
                v-model="personal.form.value.cityId"
                :disabled="!personal.form.value.countryId"
                required
                class="vip-select"
              >
                <option value="">{{ t('profile.selectCity') }}</option>
                <option v-for="c in personal.cities.value" :key="c.id" :value="c.id">
                  {{ localized(c.nameEn, c.nameAr) }}
                </option>
              </select>
            </div>

            <div class="field-item">
              <label class="vip-field-label mono">{{ t('profile.zone') }} *</label>
              <select
                v-model="personal.form.value.zoneId"
                :disabled="!personal.form.value.cityId"
                required
                class="vip-select"
              >
                <option value="">{{ t('profile.selectZone') }}</option>
                <option v-for="z in personal.zones.value" :key="z.id" :value="z.id">
                  {{ localized(z.nameEn, z.nameAr) }}
                </option>
              </select>
            </div>
          </div>

          <div class="field-item">
            <label class="vip-field-label mono">{{ t('profile.street') }} *</label>
            <input
              v-model="personal.form.value.street"
              required
              :placeholder="t('profile.streetPlaceholder')"
              class="vip-input"
            />
          </div>

          <div class="fields-3col">
            <div class="field-item">
              <label class="vip-field-label mono">{{ t('profile.building') }}</label>
              <input v-model="personal.form.value.building" :placeholder="t('profile.buildingPlaceholder')" class="vip-input" />
            </div>
            <div class="field-item">
              <label class="vip-field-label mono">{{ t('profile.floor') }}</label>
              <input v-model="personal.form.value.floor" :placeholder="t('profile.floorPlaceholder')" class="vip-input" />
            </div>
            <div class="field-item">
              <label class="vip-field-label mono">{{ t('profile.apartment') }}</label>
              <input v-model="personal.form.value.apartment" :placeholder="t('profile.apartmentPlaceholder')" class="vip-input" />
            </div>
          </div>

          <p v-if="personal.formError.value" class="modal-error-banner">{{ personal.formError.value }}</p>

          <div class="modal-btn-grid">
            <button type="submit" :disabled="personal.submitting.value" class="btn-modal-save">
              {{ personal.submitting.value ? t('common.loading') : t('common.save') }}
            </button>
            <button type="button" class="btn-modal-cancel" @click="personal.showModal.value = false">
              {{ t('common.cancel') }}
            </button>
          </div>
        </form>
      </BaseModal>
    </template>

    <!-- TAB 2: Company Addresses -->
    <template v-else>
      <SkeletonLoader v-if="company.loading.value && !company.addresses.value.length" type="address-grid" :count="2" />

      <ErrorState
        v-else-if="company.error.value && !company.addresses.value.length"
        :message="company.error.value"
        @retry="company.load"
      />

      <EmptyState
        v-else-if="!company.addresses.value.length"
        :title="t('addresses.noCompanyTitle')"
        :description="t('addresses.noCompanyDesc')"
        :action-text="t('addresses.addCompany')"
        @action="company.openCreate()"
      />

      <div v-else class="address-groups-stack">
        <div v-for="[countryId, group] in groupedCompany" :key="countryId" class="country-cluster">
          <div class="cluster-head">
            <span class="material-symbols-outlined text-[18px] text-indigo-600">domain</span>
            <h2 class="cluster-title">{{ countryLabel(countryId) }}</h2>
            <span class="mono country-pill">{{ countryIso(countryId) || '—' }} {{ countryPhone(countryId) || '' }}</span>
            <span v-if="groupCurrency(countryId)" class="mono currency-pill" :title="t('checkout.currency')">{{ groupCurrency(countryId) }}</span>
            <span class="mono cluster-count">{{ t('addresses.countInCountry', { count: group.length }) }}</span>
          </div>

          <div class="address-cards-grid">
            <article v-for="addr in group" :key="addr.id" class="address-card">
              <div class="card-main">
                <div class="addr-icon-box addr-icon-box--company">
                  <span class="material-symbols-outlined">business</span>
                </div>
                <div class="addr-details">
                  <div class="street-line">
                    <h3 class="street-name">{{ addr.street }}</h3>
                    <span v-if="addr.isDefault" class="default-badge mono">{{ t('addresses.defaultBadge') }}</span>
                  </div>
                  <p class="building-meta">
                    <span v-if="addr.building">{{ t('profile.buildingShort', { building: addr.building }) }}</span>
                    <span v-if="addr.floor">, {{ t('profile.floorShort', { floor: addr.floor }) }}</span>
                    <span v-if="addr.apartment">, {{ t('profile.apartmentShort', { apartment: addr.apartment }) }}</span>
                  </p>
                  <div class="hierarchy-tags">
                    <span class="geo-pill mono">{{ localized(addr.countryNameEn, addr.countryNameAr) || countryLabel(addr.countryId) }}</span>
                    <span class="crumb-sep icon--directional">→</span>
                    <span class="geo-pill geo-pill--subtle mono">{{ localized(addr.cityNameEn, addr.cityNameAr) }}</span>
                    <span class="crumb-sep icon--directional">→</span>
                    <span class="geo-pill geo-pill--teal mono">{{ localized(addr.zoneNameEn, addr.zoneNameAr) }}</span>
                  </div>
                </div>
              </div>

              <div class="card-actions">
                <button type="button" class="btn-action-ghost" @click="company.openEdit(addr)">
                  <span class="material-symbols-outlined text-[15px]">edit</span>
                  <span>{{ t('common.edit') }}</span>
                </button>
                <button type="button" class="btn-action-danger" @click="company.handleDelete(addr.id)">
                  <span class="material-symbols-outlined text-[15px]">delete</span>
                  <span>{{ t('common.delete') }}</span>
                </button>
              </div>
            </article>
          </div>
        </div>
      </div>

      <!-- Company Modal -->
      <BaseModal
        v-model="company.showModal.value"
        :title="company.editingId.value ? t('addresses.editCompany') : t('addresses.addCompanyTitle')"
        max-width="520px"
      >
        <form class="modal-form-stack" @submit.prevent="company.handleSubmit">
          <div class="field-item">
            <label class="vip-field-label mono">{{ t('profile.country') }} *</label>
            <select v-model="company.form.value.countryId" required class="vip-select">
              <option value="">{{ t('profile.selectCountry') }}</option>
              <option v-for="c in company.countries.value" :key="c.id" :value="c.id">
                {{ localized(c.nameEn, c.nameAr) }} — {{ c.code }} {{ c.phoneCode }}
              </option>
            </select>
          </div>

          <div class="fields-2col">
            <div class="field-item">
              <label class="vip-field-label mono">{{ t('profile.city') }} *</label>
              <select
                v-model="company.form.value.cityId"
                :disabled="!company.form.value.countryId"
                required
                class="vip-select"
              >
                <option value="">{{ t('profile.selectCity') }}</option>
                <option v-for="c in company.cities.value" :key="c.id" :value="c.id">
                  {{ localized(c.nameEn, c.nameAr) }}
                </option>
              </select>
            </div>

            <div class="field-item">
              <label class="vip-field-label mono">{{ t('profile.zone') }} *</label>
              <select
                v-model="company.form.value.zoneId"
                :disabled="!company.form.value.cityId"
                required
                class="vip-select"
              >
                <option value="">{{ t('profile.selectZone') }}</option>
                <option v-for="z in company.zones.value" :key="z.id" :value="z.id">
                  {{ localized(z.nameEn, z.nameAr) }}
                </option>
              </select>
            </div>
          </div>

          <div class="field-item">
            <label class="vip-field-label mono">{{ t('profile.street') }} *</label>
            <input
              v-model="company.form.value.street"
              required
              :placeholder="t('profile.streetPlaceholder')"
              class="vip-input"
            />
          </div>

          <div class="fields-3col">
            <div class="field-item">
              <label class="vip-field-label mono">{{ t('profile.building') }}</label>
              <input v-model="company.form.value.building" :placeholder="t('profile.buildingPlaceholder')" class="vip-input" />
            </div>
            <div class="field-item">
              <label class="vip-field-label mono">{{ t('profile.floor') }}</label>
              <input v-model="company.form.value.floor" :placeholder="t('profile.floorPlaceholder')" class="vip-input" />
            </div>
            <div class="field-item">
              <label class="vip-field-label mono">{{ t('profile.apartment') }}</label>
              <input v-model="company.form.value.apartment" :placeholder="t('profile.apartmentPlaceholder')" class="vip-input" />
            </div>
          </div>

          <label class="default-checkbox-wrap mono">
            <input type="checkbox" v-model="company.form.value.isDefault" class="vip-checkbox" />
            <span>{{ t('addresses.setDefault') }}</span>
          </label>

          <p v-if="company.formError.value" class="modal-error-banner">{{ company.formError.value }}</p>

          <div class="modal-btn-grid">
            <button type="submit" :disabled="company.submitting.value" class="btn-modal-save">
              {{ company.submitting.value ? t('common.loading') : t('common.save') }}
            </button>
            <button type="button" class="btn-modal-cancel" @click="company.showModal.value = false">
              {{ t('common.cancel') }}
            </button>
          </div>
        </form>
      </BaseModal>
    </template>
  </div>
</template>

<style scoped>
.addresses-view {
  width: 100%;
}

.crumb-bar {
  display: flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--step--1);
  color: var(--wl-muted);
}

.crumb-bar a {
  color: var(--wl-muted);
  text-decoration: none;
  transition: color 0.15s ease;
}

.crumb-bar a:hover {
  color: var(--wl-primary);
}

.crumb-bar a:focus-visible {
  outline: 2px solid var(--wl-primary);
  outline-offset: 2px;
}

.crumb-sep {
  color: var(--wl-muted-soft);
}

.crumb-active {
  color: var(--wl-ink-strong);
  font-weight: 700;
}

.addresses-head {
  display: flex;
  justify-content: space-between;
  align-items: flex-start;
  gap: var(--space-6);
  flex-wrap: wrap;
}

.head-chip {
  display: inline-flex;
  align-items: center;
  gap: var(--space-2);
  font-size: var(--step--1);
  font-weight: 700;
  color: var(--wl-primary);
  background: var(--wl-primary-soft);
  border: 1px solid rgba(var(--wl-primary-rgb), 0.3);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-pill);
  letter-spacing: 0.06em;
  margin-bottom: var(--space-2);
}

.pulse-dot {
  width: 6px;
  height: 6px;
  border-radius: var(--radius-pill);
  background: var(--wl-primary);
}

.head-title {
  font-family: var(--wl-font-display, system-ui);
  font-size: var(--step-2);
  font-weight: 800;
  letter-spacing: -0.025em;
  color: var(--wl-ink-strong);
  margin: 0;
  line-height: 1.1;
  background: var(--wl-gradient-gold);
  -webkit-background-clip: text;
  background-clip: text;
}

.head-subtitle {
  font-size: var(--step-0);
  color: var(--wl-muted);
  margin: var(--space-1) 0 0;
}

.btn-create-addr {
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.45rem;
  height: 44px;
  padding: 0 1.25rem;
  background: var(--wl-primary);
  color: var(--wl-on-primary);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--step-0);
  font-weight: 700;
  cursor: pointer;
  box-shadow: var(--shadow-card);
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.btn-create-addr:hover:not(:disabled) {
  background: var(--wl-primary-hover);
  transform: translateY(-1px);
}

.btn-create-addr:active:not(:disabled) {
  transform: translateY(0);
}

.btn-create-addr:focus-visible {
  outline: 2px solid var(--wl-primary);
  outline-offset: 2px;
}

/* Tabs */
.tab-ribbon {
  display: flex;
  gap: var(--space-2);
  border-bottom: 1.5px solid var(--border, #D9E2EC);
}

.tab-btn {
  padding: var(--space-3) var(--space-5);
  border: none;
  background: transparent;
  font-size: var(--step-0);
  font-weight: 700;
  color: var(--fg-muted, #627D98);
  cursor: pointer;
  border-bottom: 2px solid transparent;
  margin-bottom: -1.5px;
  display: inline-flex;
  align-items: center;
  gap: 0.45rem;
  transition: all 0.18s ease;
}

.tab-btn:hover {
  color: var(--fg-heading, #102A43);
}

.tab-btn:focus-visible {
  outline: 2px solid var(--wl-primary);
  outline-offset: 2px;
}

.tab-btn.is-active {
  color: var(--brand);
  border-bottom-color: var(--brand);
}

.tab-chip {
  font-size: var(--step--1);
  font-weight: 700;
  background: var(--wl-surface-soft);
  color: var(--wl-ink-soft);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-pill);
}

/* Territory Info Banner */
.territory-info-banner {
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  padding: var(--space-3) var(--space-4);
  display: flex;
  align-items: center;
  gap: var(--space-3);
}

.banner-icon {
  font-size: var(--step-1);
  color: var(--wl-primary);
  flex-shrink: 0;
}

.banner-text {
  font-size: var(--step-0);
  color: var(--wl-ink-soft);
  line-height: 1.5;
  margin: 0;
}

/* Clusters & Address Cards */
.address-groups-stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-7);
}

.country-cluster {
  display: flex;
  flex-direction: column;
  gap: var(--space-3);
}

.cluster-head {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.cluster-title {
  font-size: var(--step-0);
  font-weight: 800;
  color: var(--wl-ink-strong);
  margin: 0;
}

.country-pill {
  font-size: var(--step--1);
  font-weight: 700;
  color: var(--wl-info);
  background: var(--wl-info-soft);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
}

.currency-pill {
  font-size: var(--step--1);
  font-weight: 800;
  color: var(--wl-success);
  background: var(--wl-success-soft);
  border: 1px solid rgba(87, 242, 135, 0.35);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
  letter-spacing: 0.04em;
}

.cluster-count {
  font-size: var(--step--1);
  color: var(--wl-muted-soft);
}

.address-cards-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 320px), 1fr));
  gap: var(--space-4);
}

.address-card {
  background: var(--wl-surface);
  border: 1px solid var(--border, #D9E2EC);
  border-radius: var(--radius-md);
  padding: var(--wl-card-padding, 1.25rem);
  box-shadow: var(--shadow-card);
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  gap: var(--space-4);
  transition: all 0.2s ease;
}

.address-card:hover {
  border-color: var(--wl-border-strong);
  box-shadow: var(--shadow-hover);
}

.address-card:focus-visible {
  outline: 2px solid var(--wl-primary);
  outline-offset: 2px;
}

.card-main {
  display: flex;
  gap: var(--space-3);
  align-items: flex-start;
}

.addr-icon-box {
  width: 40px;
  height: 40px;
  border-radius: var(--radius-md);
  background: var(--wl-primary-soft);
  color: var(--wl-primary);
  display: grid;
  place-items: center;
  flex-shrink: 0;
}

.addr-icon-box--company {
  background: var(--wl-info-soft);
  color: var(--wl-info);
}

.addr-details {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
  flex: 1;
  min-width: 0;
}

.street-line {
  display: flex;
  align-items: center;
  gap: var(--space-2);
}

.street-name {
  font-size: var(--step-0);
  font-weight: 700;
  color: var(--wl-ink-strong);
  margin: 0;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.default-badge {
  font-size: var(--step--1);
  font-weight: 800;
  color: var(--wl-success);
  background: var(--wl-success-soft);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
}

.building-meta {
  font-size: var(--step-0);
  color: var(--wl-muted);
  margin: 0;
}

.hierarchy-tags {
  display: flex;
  align-items: center;
  gap: var(--space-1);
  flex-wrap: wrap;
  margin-top: var(--space-1);
}

.geo-pill {
  font-size: var(--step--1);
  font-weight: 700;
  color: var(--wl-ink-soft);
  background: var(--wl-surface-soft);
  padding: var(--space-1) var(--space-2);
  border-radius: var(--radius-sm);
}

.geo-pill--subtle {
  background: var(--wl-surface-soft);
  border: 1px solid var(--wl-border);
}

.geo-pill--teal {
  color: var(--secondary, #147D92);
  background: var(--secondary-soft, #EDF4FF);
}

.card-actions {
  display: flex;
  gap: var(--space-2);
  padding-top: var(--space-3);
  border-top: 1px solid var(--wl-border);
}

.btn-action-ghost {
  flex: 1;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: var(--radius-md);
  font-size: var(--step-0);
  font-weight: 600;
  color: var(--wl-ink-soft);
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-action-ghost:hover:not(:disabled) {
  border-color: var(--wl-primary);
  color: var(--wl-primary);
  background: var(--wl-primary-soft);
}

.btn-action-ghost:focus-visible {
  outline: 2px solid var(--wl-primary);
  outline-offset: 2px;
}

.btn-action-danger {
  flex: 1;
  height: 36px;
  display: inline-flex;
  align-items: center;
  justify-content: center;
  gap: 0.3rem;
  background: var(--wl-surface);
  border: 1px solid rgba(237, 66, 69, 0.35);
  border-radius: var(--radius-md);
  font-size: var(--step-0);
  font-weight: 600;
  color: var(--wl-danger);
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-action-danger:hover:not(:disabled) {
  background: var(--wl-danger-soft);
}

.btn-action-danger:focus-visible {
  outline: 2px solid var(--wl-danger);
  outline-offset: 2px;
}

/* Modals */
.modal-form-stack {
  display: flex;
  flex-direction: column;
  gap: var(--space-5);
}

.field-item {
  display: flex;
  flex-direction: column;
  gap: var(--space-1);
}

.vip-field-label {
  font-size: var(--step--1);
  font-weight: 700;
  color: var(--wl-ink-soft);
  letter-spacing: 0.05em;
  text-transform: uppercase;
}

.vip-select,
.vip-input {
  width: 100%;
  height: 48px;
  padding: 0 14px;
  background: var(--wl-surface-soft);
  border: 1.5px solid var(--wl-border);
  border-radius: var(--radius-md);
  font-size: var(--step-0);
  color: var(--wl-ink-strong);
  outline: none;
  transition: all 0.18s cubic-bezier(0.16, 1, 0.3, 1);
}

.vip-select:focus,
.vip-input:focus {
  background: var(--wl-surface);
  border-color: var(--wl-primary);
  box-shadow: var(--wl-focus-ring);
}

.fields-2col {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
}

.fields-3col {
  display: grid;
  grid-template-columns: 1fr 1fr 1fr;
  gap: var(--space-3);
}

.default-checkbox-wrap {
  display: flex;
  align-items: center;
  gap: 0.5rem;
  font-size: var(--step-0);
  color: var(--wl-ink-soft);
  cursor: pointer;
}

.vip-checkbox {
  width: 16px;
  height: 16px;
  accent-color: var(--wl-primary);
}

.modal-error-banner {
  background: var(--wl-danger-soft);
  border: 1px solid rgba(237, 66, 69, 0.35);
  color: var(--wl-danger);
  padding: var(--space-2) var(--space-3);
  border-radius: var(--radius-md);
  font-size: var(--step-0);
}

.modal-btn-grid {
  display: grid;
  grid-template-columns: 1fr 1fr;
  gap: var(--space-3);
  margin-top: var(--space-2);
}

.btn-modal-save {
  height: 48px;
  background: var(--wl-primary);
  color: var(--wl-on-primary);
  border: none;
  border-radius: var(--radius-md);
  font-size: var(--step-0);
  font-weight: 700;
  cursor: pointer;
  transition: background 0.15s ease;
}

.btn-modal-save:hover:not(:disabled) {
  background: var(--wl-primary-hover);
}

.btn-modal-save:active:not(:disabled) {
  transform: scale(0.985);
}

.btn-modal-save:focus-visible {
  outline: 2px solid var(--wl-primary);
  outline-offset: 2px;
}

.btn-modal-cancel {
  height: 48px;
  background: var(--wl-surface);
  border: 1.5px solid var(--wl-border);
  color: var(--wl-ink-strong);
  border-radius: var(--radius-md);
  font-size: var(--step-0);
  font-weight: 700;
  cursor: pointer;
  transition: all 0.15s ease;
}

.btn-modal-cancel:hover:not(:disabled) {
  background: var(--wl-surface-soft);
}
</style>

