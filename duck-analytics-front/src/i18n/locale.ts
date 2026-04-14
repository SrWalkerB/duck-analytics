import { enMessages, esMessages, ptBRMessages } from './messages.ts'

export const supportedLocales = ['pt-BR', 'en', 'es'] as const
export type SupportedLocale = (typeof supportedLocales)[number]

export const defaultLocale: SupportedLocale = 'pt-BR'
export const localeStorageKey = 'app.locale'

export type MessageKey = keyof typeof enMessages

const localeMessages: Record<SupportedLocale, Record<MessageKey, string>> = {
  'pt-BR': ptBRMessages,
  en: enMessages,
  es: esMessages,
}

function matchSupportedLocale(value: string | null | undefined): SupportedLocale | null {
  if (!value) return null
  if (value === 'pt-BR' || value === 'en' || value === 'es') return value

  const normalized = value.toLowerCase()
  if (normalized.startsWith('pt')) return 'pt-BR'
  if (normalized.startsWith('en')) return 'en'
  if (normalized.startsWith('es')) return 'es'

  return null
}

export function normalizeLocale(value: string | null | undefined): SupportedLocale | null {
  return matchSupportedLocale(value)
}

export function resolveLocale(input: {
  persistedLocale?: string | null
  browserLocales?: readonly string[]
}): SupportedLocale {
  const persisted = matchSupportedLocale(input.persistedLocale)
  if (persisted) return persisted

  for (const browserLocale of input.browserLocales ?? []) {
    const matched = matchSupportedLocale(browserLocale)
    if (matched) return matched
  }

  return defaultLocale
}

export function translate(
  key: MessageKey | string,
  locale: SupportedLocale,
  values?: Record<string, string | number>,
) {
  const template = (localeMessages[locale] as Record<string, string>)[key] ?? key

  if (!values) return template

  return Object.entries(values).reduce(
    (result, [placeholder, value]) =>
      result.replaceAll(`{${placeholder}}`, String(value)),
    template,
  )
}

export const localeLabels: Record<SupportedLocale, MessageKey> = {
  'pt-BR': 'Portuguese',
  en: 'English',
  es: 'Spanish',
}
