import { useTranslation } from 'react-i18next'

export function useFormats() {
  const { i18n } = useTranslation()
  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-EG'
  // Sample dates are calendar dates, so format in UTC to avoid shifting the day.
  return {
    money: new Intl.NumberFormat(locale, { style: 'currency', currency: 'EGP', minimumFractionDigits: 0, maximumFractionDigits: 2 }),
    date: new Intl.DateTimeFormat(locale, { month: 'short', day: 'numeric', timeZone: 'UTC' })
  }
}
