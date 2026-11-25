// @vitest-environment jsdom
import { cleanup, render, screen } from '@testing-library/react'
import i18n from 'i18next'
import { initReactI18next } from 'react-i18next'
import { MemoryRouter } from 'react-router'
import { afterEach, beforeAll, expect, test, vi } from 'vitest'
import { resources } from '../../i18n/locales'
import { Account } from './Account'
import { passwordSchema, profileEditSchema, profileSchema } from './validation'

vi.mock('../../data/supabase', () => ({ supabase: null }))

beforeAll(async () => {
  await i18n.use(initReactI18next).init({ lng: 'en', resources })
})
afterEach(cleanup)

test.each([
  ['en', 'Connect Supabase to use accounts.'],
  ['ar', 'خدمة الحسابات مش متاحة دلوقتي.'],
])('explains the missing backend in %s', async (locale, message) => {
  await i18n.changeLanguage(locale)
  render(<MemoryRouter><div id="toast-region" /><Account /></MemoryRouter>)
  expect(screen.getByRole('alert').textContent).toBe(message)
})

test('normalizes usernames and preserves an Arabic display name', () => {
  expect(profileSchema.parse({ username: ' Mo_5 ', display_name: 'محمد', language: 'ar' }))
    .toEqual({ username: 'mo_5', display_name: 'محمد', language: 'ar' })
})

test.each([
  ['ar', 'en', 'محمد'],
  ['en', 'ar', 'Mohamed'],
])('saves the %s display name independently of the %s interface', (display_language, language, display_name) => {
  expect(profileEditSchema.parse({ username: ' Mo_5 ', name_ar: ' محمد ', name_en: ' Mohamed ', language, display_language }))
    .toEqual({ username: 'mo_5', name_ar: 'محمد', name_en: 'Mohamed', language, display_name })
})

test('rejects a password over the UTF-8 byte limit', () => {
  expect(passwordSchema.safeParse('م'.repeat(37)).success).toBe(false)
})
