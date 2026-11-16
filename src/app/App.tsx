import { Toast } from '../ui/Toast'
import { useTranslation } from 'react-i18next'
import { Plus } from 'lucide-react'
import { Link } from 'react-router'
import { supabase } from '../data/supabase'
import { PurchaseOverview } from '../features/dashboard/PurchaseOverview'
import { purchaseToday } from '../features/purchases/api'
import { LedgerQueries, useLedgerOwner } from '../data/LedgerSession'
import { SignInLink } from '../features/accounts/SignInLink'

export function App() {
  const { t, i18n } = useTranslation()
  const owner = useLedgerOwner()
  const month = purchaseToday().slice(0, 7)
  const monthLabel = new Intl.DateTimeFormat(i18n.language === 'ar' ? 'ar-EG' : 'en-EG', {
    month: 'long', year: 'numeric', timeZone: 'UTC',
  }).format(new Date(month + '-01'))
  return <main id="main" tabIndex={-1} className="shell">
      <div className="intro panel"><div>{owner && <p className="eyebrow">
        {t('purchasePrivate')} · {monthLabel}
      </p>}
        <h1 id="page-title">{t('summary')}</h1></div>
        {owner && <Link className="primary" to="/purchases"><Plus size={18} aria-hidden="true" />{t('addPurchase')}</Link>}
      </div>
      {!supabase ? <Toast message={t('accountUnavailable')} />
        : owner === undefined ? <div className="panel"><p className="loading-state" role="status">{t('loading')}</p></div>
        : owner ? <LedgerQueries key={owner}><PurchaseOverview client={supabase} month={month} /></LedgerQueries>
        : <section className="panel">
          <h2>{t('overviewGuestTitle')}</h2>
          <p>{t('overviewGuestIntro')}</p>
          <div className="overview-account-actions">
            <SignInLink />
            <Link className="secondary" to="/account/signup">{t('signup')}</Link>
          </div>
        </section>}
    </main>
}
