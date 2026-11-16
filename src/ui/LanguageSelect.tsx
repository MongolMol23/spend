import { useTranslation } from 'react-i18next'
import { Select } from './Select'

export function LanguageSelect() {
  const { t, i18n } = useTranslation()

  return (
      <Select className="language" aria-label={t('language')} value={i18n.language}
        onChange={event => void i18n.changeLanguage(event.target.value)}>
        <option value="en" lang="en">English</option>
        <option value="ar" lang="ar">العربية</option>
      </Select>
  )
}
