import {
  createContext,
  startTransition,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  defaultLocale,
  localeLabels,
  localeStorageKey,
  resolveLocale,
  supportedLocales,
  translate,
  type MessageKey,
  type SupportedLocale,
} from './locale'

type I18nContextValue = {
  locale: SupportedLocale
  setLocale: (nextLocale: SupportedLocale) => void
  t: (key: MessageKey | string, values?: Record<string, string | number>) => string
  supportedLocales: readonly SupportedLocale[]
  localeLabels: typeof localeLabels
}

const I18nContext = createContext<I18nContextValue | null>(null)

function getInitialLocale() {
  if (typeof window === 'undefined') return defaultLocale

  return resolveLocale({
    persistedLocale: window.localStorage.getItem(localeStorageKey),
    browserLocales: window.navigator.languages,
  })
}

export function I18nProvider({ children }: { children: ReactNode }) {
  const [locale, setLocaleState] = useState<SupportedLocale>(() => getInitialLocale())

  useEffect(() => {
    document.documentElement.lang = locale
    window.localStorage.setItem(localeStorageKey, locale)
  }, [locale])

  const value = useMemo<I18nContextValue>(
    () => ({
      locale,
      setLocale: (nextLocale) => {
        startTransition(() => {
          setLocaleState(nextLocale)
        })
      },
      t: (key, values) => translate(key, locale, values),
      supportedLocales,
      localeLabels,
    }),
    [locale],
  )

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>
}

export function useI18n() {
  const context = useContext(I18nContext)

  if (!context) {
    throw new Error('useI18n must be used within I18nProvider')
  }

  return context
}
