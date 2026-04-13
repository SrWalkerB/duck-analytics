import test from 'node:test'
import assert from 'node:assert/strict'
import { defaultLocale, resolveLocale, translate } from './locale.ts'

test('prefers the persisted locale over the browser locale', () => {
  assert.equal(
    resolveLocale({
      persistedLocale: 'es',
      browserLocales: ['en-US', 'pt-BR'],
    }),
    'es',
  )
})

test('normalizes supported browser locales', () => {
  assert.equal(
    resolveLocale({
      persistedLocale: null,
      browserLocales: ['en-US', 'fr-FR'],
    }),
    'en',
  )
})

test('falls back to pt-BR when the browser locale is unsupported', () => {
  assert.equal(
    resolveLocale({
      persistedLocale: null,
      browserLocales: ['fr-FR'],
    }),
    defaultLocale,
  )
})

test('translates shared UI messages', () => {
  assert.equal(translate('Settings', 'en'), 'Settings')
  assert.equal(translate('Settings', 'pt-BR'), 'Configurações')
  assert.equal(translate('Settings', 'es'), 'Configuración')
})
