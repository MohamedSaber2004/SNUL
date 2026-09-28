<script setup lang="ts">
import { ref, computed, watch, onMounted } from 'vue'
import { locale, t } from '../../i18n'
import { locationService } from '../../di/container'

const props = withDefaults(
  defineProps<{
    modelValue?: string
    label?: string
    placeholder?: string
    required?: boolean
    disabled?: boolean
    error?: string
    id?: string
    /** Optional ISO 2 (AE, EG) to default the dial code — decoupled from territory Country */
    countryCode?: string | null
    /** Territory Country id — when set, dial auto-syncs to Country.phoneCode (backend linked) */
    countryId?: string | null
    /** If true, dial follows countryId strictly (register flow linkage) */
    syncWithCountry?: boolean
  }>(),
  {
    modelValue: '',
    label: '',
    placeholder: '300 1234567',
    required: false,
    disabled: false,
    error: '',
    id: undefined,
    countryCode: null,
    countryId: null,
    syncWithCountry: false,
  },
)

const emit = defineEmits<{
  'update:modelValue': [value: string]
}>()

const selectedDial = ref('')
const localNumber = ref('')

/** Dial codes purely from API Countries (phoneCode) — no static fallback */
const mergedDials = computed(() => locationService.mergedDials.value)

onMounted(() => {
  // Ensure countries are loaded for dial codes — pure API, no mock
  if (!locationService.countries.value.length) {
    void locationService.loadCountries().catch(() => {})
  }
})

const getFlagEmoji = (code?: string | null): string => {
  if (!code || code.length !== 2) return '🌐'
  const offset = 127397
  return String.fromCodePoint(...[...code.toUpperCase()].map((c) => c.charCodeAt(0) + offset))
}

const localizedDialName = (d: { nameEn: string; nameAr: string }) => (locale.value === 'ar' ? d.nameAr : d.nameEn)

const findByDial = (dial: string) => mergedDials.value.find((c) => c.dial === dial)
const findByCode = (code: string) => mergedDials.value.find((c) => c.code.toLowerCase() === code.toLowerCase())
const findByCountryId = (id: string) => locationService.getCountryById(id)

const parseModelValue = (fullVal: string) => {
  if (!fullVal) {
    localNumber.value = ''
    return
  }
  const clean = fullVal.trim()
  const sorted = [...mergedDials.value].sort((a, b) => b.dial.length - a.dial.length)
  for (const c of sorted) {
    if (clean.startsWith(c.dial)) {
      selectedDial.value = c.dial
      localNumber.value = clean.slice(c.dial.length).trim()
      return
    }
  }
  const match = clean.match(/^(\+\d{1,4})(.*)$/)
  if (match && match[1] && match[2] !== undefined) {
    selectedDial.value = match[1]
    localNumber.value = match[2].trim()
  } else {
    localNumber.value = clean
  }
}

const emitCombined = () => {
  const num = localNumber.value.trim().replace(/^\+/, '').replace(/\s+/g, ' ')
  if (!num) {
    emit('update:modelValue', '')
    return
  }
  // If no dial selected yet but we have a dial list, use first dial as fallback upon emit
  const dialToUse = selectedDial.value || (mergedDials.value[0]?.dial ?? '')
  if (!dialToUse) {
    emit('update:modelValue', num)
    return
  }
  emit('update:modelValue', `${dialToUse} ${num}`.trim())
}

watch(selectedDial, () => emitCombined())
watch(localNumber, () => emitCombined())

// Auto-select first dial when API loads and nothing selected yet
watch(
  () => mergedDials.value.length,
  (len) => {
    if (len && !selectedDial.value) {
      // Prefer dial for given countryId/code if provided, else first API dial
      if (props.countryId) {
        const c = findByCountryId(props.countryId)
        if (c?.phoneCode) {
          selectedDial.value = c.phoneCode.trim()
          return
        }
      }
      if (props.countryCode) {
        const found = findByCode(props.countryCode)
        if (found) {
          selectedDial.value = found.dial
          return
        }
      }
      // Fallback to first API dial
      const first = mergedDials.value[0]
      if (first) selectedDial.value = first.dial
    }
    if (props.modelValue) parseModelValue(props.modelValue)
    if (props.countryId) {
      const country = findByCountryId(props.countryId)
      if (country?.phoneCode) selectedDial.value = country.phoneCode.trim()
    }
  },
)

// Sync from countryCode prop (e.g. address's country) without loading territory Countries
watch(
  () => props.countryCode,
  (code) => {
    if (!code) return
    const found = findByCode(code)
    if (found) selectedDial.value = found.dial
  },
  { immediate: true },
)

// Sync from territory Country id — backend-linked phoneCode (e.g. register with address country)
watch(
  () => props.countryId,
  (cid) => {
    if (!cid) return
    const country = findByCountryId(cid)
    const dial = country?.phoneCode?.trim()
    if (dial) {
      // auto-sync if requested or if current model is empty / newly selected country
      if (props.syncWithCountry || !localNumber.value || !selectedDial.value) {
        selectedDial.value = dial
      } else if (!findByDial(selectedDial.value)) {
        // current dial not in list → correct it
        selectedDial.value = dial
      }
    }
  },
  { immediate: true },
)

watch(
  () => props.modelValue,
  (val) => {
    const combinedCurrent = localNumber.value
      ? `${selectedDial.value} ${localNumber.value.trim()}`.replace(/\s+/g, '')
      : ''
    const cleanIn = (val ?? '').replace(/\s+/g, '')
    if (cleanIn !== combinedCurrent) parseModelValue(val ?? '')
  },
  { immediate: true },
)

// Initialize from modelValue or countryCode
if (props.countryCode) {
  const found = findByCode(props.countryCode)
  if (found) selectedDial.value = found.dial
}
if (props.countryId) {
  const c = findByCountryId(props.countryId)
  if (c?.phoneCode) selectedDial.value = c.phoneCode.trim()
}
parseModelValue(props.modelValue)
</script>

<template>
  <div class="phone-field" :class="{ 'has-error': Boolean(error), 'is-disabled': disabled }">
    <label v-if="label" :for="id" class="phone-field__label">
      {{ label }}
      <span v-if="required" class="phone-field__req" aria-hidden="true">*</span>
    </label>

    <div class="phone-field__control">
      <!-- Dial code selector — loaded purely from API Countries (phoneCode) -->
      <div class="phone-code-select-wrap">
        <select v-model="selectedDial" :disabled="disabled || !mergedDials.length" class="phone-code-select" :aria-label="t('auth.phoneNumber')">
          <option v-if="!mergedDials.length" value="" disabled>{{ t('common.loading') }}</option>
          <option v-for="d in mergedDials" :key="`${d.code}-${d.dial}-${d.countryId ?? ''}`" :value="d.dial" :title="`${d.dial} ${localizedDialName(d)}`">
            {{ getFlagEmoji(d.code) }} {{ d.dial }}
          </option>
        </select>
        <span class="phone-code-arrow" aria-hidden="true">▾</span>
      </div>

      <span class="phone-field__divider" aria-hidden="true"></span>

      <input
        :id="id"
        v-model="localNumber"
        type="tel"
        inputmode="tel"
        autocomplete="tel-national"
        :placeholder="placeholder"
        :disabled="disabled"
        :required="required"
        class="phone-number-input"
      />
    </div>

    <span v-if="error" class="phone-field__error" role="alert">{{ error }}</span>
    <span v-if="!mergedDials.length && !locationService.loading.value" class="phone-field__error" role="alert">{{ t('auth.errNoDialCodes') }}</span>
  </div>
</template>

<style scoped>
.phone-field { display: flex; flex-direction: column; gap: 0.45rem; text-align: start; width: 100%; }
.phone-field__label { font-family: var(--wl-font-body); font-size: 12px; font-weight: 600; color: var(--wl-ink-soft); letter-spacing: 0.015em; display: flex; align-items: center; gap: 0.25rem; }
.phone-field__req { color: var(--wl-danger); font-weight: 700; margin-inline-start: 2px; }
.phone-field__control {
  display: flex;
  align-items: center;
  background: var(--wl-surface);
  border: 1px solid var(--wl-border);
  border-radius: 10px;
  box-shadow: var(--shadow-xs);
  transition: border-color 0.22s var(--wl-ease-spring),
              box-shadow 0.22s var(--wl-ease-spring),
              transform 0.15s ease,
              background-color 0.2s ease;
  overflow: hidden;
  height: 44px;
  min-height: 44px;
}
.phone-field__control:hover:not(.is-disabled) {
  border-color: var(--wl-border-strong);
  box-shadow: var(--shadow-xs);
}
.phone-field__control:focus-within {
  border-color: var(--wl-primary);
  box-shadow: var(--wl-focus-ring);
  transform: translateY(-0.5px);
  background: var(--wl-surface);
}
.phone-field.has-error .phone-field__control {
  border-color: var(--wl-danger) !important;
  box-shadow: var(--wl-focus-ring-danger) !important;
}
.phone-code-select-wrap {
  position: relative;
  display: flex;
  align-items: center;
  flex-shrink: 0;
  height: 100%;
  background: var(--wl-surface-soft);
  transition: background-color 0.18s ease;
}
.phone-field__control:focus-within .phone-code-select-wrap {
  background: var(--wl-primary-soft);
}
.phone-code-select {
  appearance: none;
  -webkit-appearance: none;
  background: transparent;
  border: none;
  padding-inline-start: 12px;
  padding-inline-end: 24px;
  height: 100%;
  font-size: 0.88rem;
  font-weight: 600;
  color: var(--wl-ink-strong);
  cursor: pointer;
  outline: none;
  font-family: var(--wl-font-mono);
}
.phone-code-arrow {
  position: absolute;
  inset-inline-end: 8px;
  pointer-events: none;
  font-size: 9px;
  color: var(--wl-muted);
  transition: transform 0.2s ease, color 0.18s ease;
}
.phone-field__control:focus-within .phone-code-arrow {
  color: var(--wl-primary);
  transform: rotate(180deg);
}
.phone-field__divider { width: 1px; height: 55%; background: var(--wl-line); flex-shrink: 0; }
.phone-number-input {
  flex: 1;
  min-width: 0;
  height: 100%;
  border: none;
  background: transparent;
  padding: 0 14px;
  font-size: 0.94rem;
  font-weight: 500;
  font-family: var(--wl-font-mono);
  color: var(--wl-ink-strong);
  outline: none;
  letter-spacing: 0.03em;
  box-shadow: none !important;
}
.phone-number-input::placeholder { color: var(--wl-muted); opacity: 0.85; }
.phone-field__error {
  font-size: 0.78rem;
  font-weight: 600;
  color: var(--wl-danger);
  display: flex;
  align-items: center;
  gap: 5px;
  margin-top: 2px;
}
.phone-field__error::before { content: '●'; font-size: 6px; }
.phone-field.is-disabled { opacity: 0.55; pointer-events: none; }
</style>
