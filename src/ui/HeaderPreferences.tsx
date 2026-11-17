import { useState, type ReactNode } from 'react'
import { Moon, Sun } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LanguageSelect } from './LanguageSelect'

export function HeaderPreferences({ children, notification }: { children?: ReactNode; notification?: ReactNode }) {
  const { t } = useTranslation()
  const [dark, setDark] = useState(() => document.documentElement.dataset.theme === 'dark')
  const Icon = dark ? Sun : Moon

  function toggleTheme() {
    const theme = dark ? 'light' : 'dark'
    document.documentElement.dataset.theme = theme
    setDark(!dark)
    try {
      localStorage.setItem('spend-theme', theme)
    } catch {
      // The current page can still switch themes when browser storage is unavailable.
    }
  }

  return <div className="header-preferences">
    {notification}
    <button type="button" className="secondary theme-toggle" aria-pressed={dark}
      aria-label={t('darkMode')} title={t(dark ? 'lightMode' : 'darkMode')} onClick={toggleTheme}>
      <Icon size={19} aria-hidden="true" />
    </button>
    <LanguageSelect />
    {children}
  </div>
}
