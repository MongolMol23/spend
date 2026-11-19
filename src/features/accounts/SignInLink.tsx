import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

export function SignInLink({ className = 'primary', to = '/account' }: { className?: string; to?: string }) {
  const { t } = useTranslation()
  return <Link className={className} to={to}>{t('signin')}</Link>
}
