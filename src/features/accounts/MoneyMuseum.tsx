import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { CalendarCheck, Landmark, LockKeyhole, ReceiptText, Vault } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../data/supabase'
import './money-museum.css'

const exhibits = [
  { key: 'purchase', title: 'museumPurchase', locked: 'museumPurchaseLocked', icon: ReceiptText },
  { key: 'deposit', title: 'museumDeposit', locked: 'museumDepositLocked', icon: Vault },
  { key: 'bill', title: 'museumBill', locked: 'museumBillLocked', icon: CalendarCheck },
] as const

export function MoneyMuseum({ owner }: { owner: string }) {
  const { t, i18n } = useTranslation()
  const [turned, setTurned] = useState<(typeof exhibits)[number]['key']>()
  const date = new Intl.DateTimeFormat(i18n.language === 'ar' ? 'ar-EG' : 'en-EG', { dateStyle: 'medium', timeZone: 'UTC' })
  const museum = useQuery({
    queryKey: ['money-museum', owner],
    queryFn: async ({ signal }) => {
      const client = supabase!
      const [purchase, deposit, bill] = await Promise.all([
        client.from('expenses').select('spent_on').eq('owner_id', owner).eq('from_monthly_expense', false)
          .neq('category', 'bills').is('archived_at', null).order('spent_on').limit(1).abortSignal(signal).maybeSingle(),
        client.from('savings_movements').select('moved_on').eq('direction', 'deposit')
          .order('moved_on').limit(1).abortSignal(signal).maybeSingle(),
        client.from('expenses').select('spent_on').eq('owner_id', owner).eq('from_monthly_expense', true)
          .is('archived_at', null).order('spent_on').limit(1).abortSignal(signal).maybeSingle(),
      ])
      const error = purchase.error ?? deposit.error ?? bill.error
      if (error) throw error
      return { purchase: purchase.data?.spent_on, deposit: deposit.data?.moved_on, bill: bill.data?.spent_on }
    },
  })

  return <section className="panel money-museum" aria-labelledby="museum-title">
    <h2 id="museum-title" className="section-heading">
      <span className="icon-tile" aria-hidden="true"><Landmark size={19} /></span>{t('museumTitle')}
    </h2>
    {museum.isPending && <p className="loading-state" role="status">{t('loading')}</p>}
    {museum.isError && <div className="museum-error">
      <p>{t('failed')}</p>
      <button type="button" className="secondary" disabled={museum.isFetching} aria-busy={museum.isFetching}
        onClick={() => void museum.refetch()}>{t('retry')}</button>
    </div>}
    {museum.data && <ul className="museum-shelf">
      {exhibits.map(({ key, title, locked, icon: Icon }) => {
        const day = museum.data[key]
        const flipped = turned === key
        return <li key={key} data-exhibit={key}>
          <button type="button" className="museum-exhibit" aria-expanded={flipped} data-earned={Boolean(day)}
            onClick={() => setTurned(flipped ? undefined : key)}>
            <span className="museum-card">
              <span className="museum-face museum-front" aria-hidden={flipped}>
                <span className="museum-object" aria-hidden="true">
                  <Icon size={23} />
                  {!day && <span className="museum-lock"><LockKeyhole size={11} /></span>}
                </span>
                <strong>{t(title)}</strong>
              </span>
              <span className="museum-face museum-back" aria-hidden={!flipped}>
                <strong>{t(title)}</strong>
                {day ? <time dateTime={day}>{date.format(new Date(day))}</time> : <small>{t(locked)}</small>}
              </span>
            </span>
          </button>
        </li>
      })}
    </ul>}
  </section>
}
