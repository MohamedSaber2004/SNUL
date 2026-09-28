import { ref } from 'vue'
import type { Messages } from './messages'
import { en } from './en'
import { ar } from './ar'

export type Locale = 'en' | 'ar'

const STORAGE_KEY = 'snul-locale'

const messages: Record<Locale, Messages> = { en, ar }

export type MessageKey = NestedKeyOf<Messages>

export type NestedKeyOf<T> = T extends Record<string, unknown>
  ? {
      [K in keyof T]: K extends string
        ? T[K] extends Record<string, unknown>
          ? `${K}.${NestedKeyOf<T[K]>}`
          : K
        : never
    }[keyof T]
  : never

const readStoredLocale = (): Locale => {
  const stored = localStorage.getItem(STORAGE_KEY)
  return stored === 'en' ? 'en' : stored === 'ar' ? 'ar' : 'en'
}

const applyDocument = (locale: Locale) => {
  document.documentElement.lang = locale
  document.documentElement.dir = locale === 'ar' ? 'rtl' : 'ltr'
}

export const locale = ref<Locale>(readStoredLocale())

export const setLocale = (next: Locale) => {
  locale.value = next
  localStorage.setItem(STORAGE_KEY, next)
  applyDocument(next)
  localeChangeListeners.forEach((listener) => listener(next))
}

const lookup = (lang: Locale, key: string): string | undefined => {
  let value: unknown = messages[lang]
  for (const part of key.split('.')) {
    if (typeof value !== 'object' || value === null) return undefined
    value = (value as Record<string, unknown>)[part]
  }
  return typeof value === 'string' ? value : undefined
}

export const t = (key: MessageKey, params?: Record<string, string | number>): string => {
  const text0 = lookup(locale.value, key) ?? lookup('en', key)
  let text = text0 ?? String(key)
  if (params) {
    if (typeof params.count === 'number' && text.includes('|')) {
      const parts = text.split('|').map((p) => p.trim())
      const count = params.count
      if (locale.value === 'ar' && parts.length >= 3) {
        text = parts[count === 1 ? 0 : count === 2 ? 1 : 2] ?? text
      } else {
        text = parts[count === 1 ? 0 : 1] ?? text
      }
    }
    for (const [name, replacement] of Object.entries(params)) {
      text = text.replaceAll(`{${name}}`, String(replacement))
    }
  }
  return text
}

type LocaleChangeListener = (locale: Locale) => void
const localeChangeListeners: LocaleChangeListener[] = []

export const onLocaleChange = (listener: LocaleChangeListener) => {
  localeChangeListeners.push(listener)
}

export const initI18n = () => {
  applyDocument(locale.value)
}
