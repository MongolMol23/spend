import { FeatureHeading } from '../../ui/FeatureHeading'
import { ReceiptText } from 'lucide-react'
import { Toast } from '../../ui/Toast'
import { SignInLink } from '../accounts/SignInLink'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../data/supabase'
import { LedgerQueries, useLedgerOwner } from '../../data/LedgerSession'
import { PurchaseWorkspace } from './PurchaseWorkspace'
import './purchases.css'

export function Purchases() {
  const { t } = useTranslation()
  const owner = useLedgerOwner()
  return <main id="main" tabIndex={-1} className="shell purchase-shell">
    {(!supabase || !owner) && <FeatureHeading title={t('purchases')} icon={ReceiptText} accent="amber" />}
    {!supabase ? <Toast message={t('purchaseUnavailable')} />
      : owner === undefined ? <p className="loading-state" role="status">{t('loading')}</p>
      : owner === null ? <section className="panel"><p>{t('purchaseSignin')}</p>
        <SignInLink /></section>
      : <LedgerQueries key={owner}><PurchaseWorkspace client={supabase} owner={owner} /></LedgerQueries>}
  </main>
}
