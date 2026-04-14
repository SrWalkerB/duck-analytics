import { localeStorageKey } from '@/i18n/locale'
import type { AuthResponse, SupportedLocale } from '@/types'

const tokenStorageKey = 'token'

export function getStoredToken() {
  return localStorage.getItem(tokenStorageKey)
}

export function clearStoredAuth() {
  localStorage.removeItem(tokenStorageKey)
}

export function getStoredLocale() {
  return localStorage.getItem(localeStorageKey)
}

export function setStoredLocale(locale: SupportedLocale) {
  localStorage.setItem(localeStorageKey, locale)
}

export function setStoredSession(auth: AuthResponse) {
  localStorage.setItem(tokenStorageKey, auth.token)
  setStoredLocale(auth.user.locale)
}
