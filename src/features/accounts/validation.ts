import { z } from 'zod'
import type { Label } from '../../i18n/locales'

export const emailSchema = z.email()
export const passwordSchema = z.string().min(8).max(72).refine(value => new TextEncoder().encode(value).length <= 72)
export const profileSchema = z.object({
  username: z.string().trim().toLowerCase().regex(/^[a-z0-9_]{3,24}$/),
  display_name: z.string().trim().min(1).max(80),
  language: z.enum(['en', 'ar']),
})

export const signupProfileSchema = profileSchema.pick({ username: true, language: true }).extend({
  name_ar: z.string().trim().min(1).max(80).regex(/\p{Script=Arabic}/u),
  name_en: z.string().trim().min(1).max(80).regex(/\p{Script=Latin}/u),
})

export const signupFields = ['name_ar', 'name_en', 'username', 'email', 'password', 'confirm_password'] as const
export type AccountField = typeof signupFields[number]

export function accountFieldError(field: AccountField, values: FormData, signingIn: boolean): Label | undefined {
  const value = String(values.get(field) ?? '')
  switch (field) {
    case 'name_ar': return signupProfileSchema.shape.name_ar.safeParse(value).success ? undefined : 'invalidArabicName'
    case 'name_en': return signupProfileSchema.shape.name_en.safeParse(value).success ? undefined : 'invalidEnglishName'
    case 'username': return profileSchema.shape.username.safeParse(value).success ? undefined : 'invalidUsername'
    case 'email': return emailSchema.safeParse(value.trim()).success ? undefined : 'invalidEmail'
    case 'password':
      if (!value) return 'passwordRequired'
      return signingIn || passwordSchema.safeParse(value).success ? undefined : 'invalidPassword'
    case 'confirm_password':
      if (!value) return 'confirmPasswordRequired'
      return value === values.get('password') ? undefined : 'passwordMismatch'
  }
}

