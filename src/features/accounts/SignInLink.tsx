import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'

export function SignInLink({ className = 'primary' }: { className?: string }) {
  const { t } = useTranslation()
  return <Link className={className} to="/account">{t('signin')}</Link>
}
