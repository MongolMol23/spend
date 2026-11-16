import { SignInLink } from '../accounts/SignInLink'
import { CalendarDays, ReceiptText, Scale, Vault } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { useLedgerOwner } from '../../data/LedgerSession'
import { Brand } from '../../ui/Brand'
import { HeaderPreferences } from '../../ui/HeaderPreferences'
import { HowItWorks } from './HowItWorks'
import { PrivacyAndFaq } from './PrivacyAndFaq'
import './landing.css'

const features = [
  ['purchases', 'landingPurchases', ReceiptText],
  ['privateDebts', 'landingDebts', Scale],
  ['savingsGoals', 'landingSavings', Vault],
  ['installments', 'landingInstallments', CalendarDays],
] as const

export function Landing() {
  const { t } = useTranslation()
  const owner = useLedgerOwner()

  return <>
    <header className="site-header">
      <div className="shell row landing-header">
        <Link to="/" className="brand" aria-current="page"><Brand /></Link>
        <HeaderPreferences />
      </div>
    </header>
    <main className="shell">
      <section className="panel landing-hero">
        <div>
          <div className="landing-title-row">
            <h1>{t('landingTitle')}</h1>
            <span className="landing-receipt" aria-hidden="true"><ReceiptText size={26} /></span>
          </div>
          <p>{t('landingIntro')}</p>
        </div>
        <div className="overview-account-actions landing-actions">
          {owner === undefined ? <span className="loading-state" role="status">{t('loading')}</span>
            : owner ? <Link className="primary" to="/overview">{t('landingOpen')}</Link>
            : <>
              <Link className="primary" to="/account/signup">{t('signup')}</Link>
              <SignInLink className="secondary" />
            </>}
        </div>
      </section>
      <ul className="landing-features">
        {features.map(([title, description, Icon]) => <li className="panel" key={title}>
          <h2 className="section-heading"><span className="icon-tile" aria-hidden="true"><Icon size={18} /></span>{t(title)}</h2>
          <p>{t(description)}</p>
        </li>)}
      </ul>
      <HowItWorks />
      <PrivacyAndFaq />
    </main>
  </>
}
