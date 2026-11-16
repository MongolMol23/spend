import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { Clock3, Minus, PieChart, Plus, ReceiptText, Wallet } from 'lucide-react'
import { useFormats } from '../../i18n/useFormats'
import type { Label } from '../../i18n/locales'
import { Amount } from '../../ui/Amount'
import type { DebtOverview } from '../debts/api'
import { categoryLabel, type Expense } from '../purchases/api'
import './dashboard.css'

export type DashboardPurchases = {
  summary: { category: string; total_minor: number }[]
  recent: Pick<Expense, 'id' | 'item' | 'amount_minor'>[]
}

export function Dashboard({ ledger, debts }: { ledger: DashboardPurchases; debts?: DebtOverview }) {
  const { t, i18n } = useTranslation()
  const { date } = useFormats()
  const categories: [Label, number][] = ledger.summary.map(row => [categoryLabel(row.category), Number(row.total_minor)])
  const monthlyTotal = categories.reduce((total, [, amount]) => total + amount, 0) / 100
  const metrics = [['spending', monthlyTotal, Wallet]] as const
  const balances = debts ? [
    ['owed', Number(debts.owed_minor) / 100, Plus],
    ['owe', Number(debts.owe_minor) / 100, Minus],
  ] as const : []
  return <>
    <div className={debts ? 'metrics' : 'metrics metrics-personal'}>{[...metrics, ...balances].map(([label, value, Icon]) => <div className="metric panel" key={label}>
      <span className="icon-tile" aria-hidden="true"><Icon size={18} /></span>
      <span className="metric-label">{t(label)}</span>
      <strong><Amount value={value} /></strong>
    </div>)}</div>
    <div className="dashboard-detail">
      <section className="panel spending-detail">
        <h2 className="section-heading"><span className="icon-tile" aria-hidden="true"><PieChart size={18} /></span>{t('breakdown')}</h2>
        {categories.length > 0 ? <><div className="category-bar" aria-hidden="true">
          {categories.map(([label, value]) => <span key={label} data-category={label} style={{ flexGrow: value }} />)}
        </div>
        <ul className="ledger categories">
          {categories.map(([label, value]) => <li className="row" key={label}>
            <span className="category-name" data-category={label}>{t(label)}</span><Amount value={value / 100} />
          </li>)}
        </ul></> : <p className="empty-state">{t('noPurchases')}</p>}
      </section>
      <section className="panel purchases">
        <h2 className="section-heading"><span className="icon-tile" aria-hidden="true"><ReceiptText size={18} /></span>{t('recent')}</h2>
        {ledger.recent.length > 0 ? <ul className="ledger">
          {ledger.recent.map(row => <li className="row" key={row.id}><bdi>{row.item}</bdi><Amount value={row.amount_minor / 100} /></li>)}
        </ul> : <p className="empty-state">{t('noPurchases')}</p>}
      </section>
      {debts && <section className="panel follow-up">
        <h2 className="section-heading"><span className="icon-tile" aria-hidden="true"><Clock3 size={18} /></span>{t('followUp')}</h2>
        {debts.pending_count > 0 && <Link to="/connections" className="follow-item follow-link row">
          <strong>{t('needsResponse')}</strong>
          <span className="status">{new Intl.NumberFormat(i18n.language).format(debts.pending_count)}</span>
        </Link>}
        {debts.due_id && debts.due_on && debts.due_minor !== null ? <Link
          to={debts.due_source === 'private' ? '/debts?debt=' + debts.due_id : '/connections?request=' + debts.due_id}
          className="follow-item follow-link">
          <span className="muted">{t('due')} <time dateTime={debts.due_on}>{date.format(new Date(debts.due_on))}</time></span>
          <span className="row"><strong className="reason"><bdi>{debts.due_label}</bdi></strong><Amount value={debts.due_minor / 100} /></span>
        </Link> : <p className="empty-state">{t('debtNoDue')}</p>}
      </section>}
    </div>
  </>
}
