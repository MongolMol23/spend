import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { ChevronRight, Clock3, Minus, PieChart, Plus, ReceiptText, Wallet } from 'lucide-react'
import { useFormats } from '../../i18n/useFormats'
import type { Label } from '../../i18n/locales'
import { Amount } from '../../ui/Amount'
import type { DebtOverview } from '../debts/api'
import { categoryLabel, type Expense } from '../purchases/api'
import './dashboard.css'

export type DashboardPurchases = {
  summary: { category: string; total_minor: number }[]
  recent: Pick<Expense, 'id' | 'item' | 'amount_minor' | 'spent_on'>[]
}

export function Dashboard({ ledger, debts }: { ledger: DashboardPurchases; debts?: DebtOverview }) {
  const { t, i18n } = useTranslation()
  const { date } = useFormats()
  const categories: [Label, number][] = ledger.summary
    .map((row): [Label, number] => [categoryLabel(row.category), Number(row.total_minor)])
    .sort((a, b) => b[1] - a[1])
  const totalMinor = categories.reduce((total, [, amount]) => total + amount, 0)
  const monthlyTotal = totalMinor / 100
  const percent = new Intl.NumberFormat(i18n.language, { style: 'percent' })
  const due = debts?.due_id && debts.due_on && debts.due_minor !== null ? debts : undefined
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
        <div className="overview-card-heading">
          <h2 className="section-heading"><span className="icon-tile" aria-hidden="true"><PieChart size={18} /></span>{t('breakdown')}</h2>
          <Link className="secondary overview-card-link" to="/analytics" aria-label={t('analytics')} title={t('analytics')}><ChevronRight size={17} aria-hidden="true" /></Link>
        </div>
        {categories.length > 0 ? <><div className="category-bar" aria-hidden="true">
          {categories.map(([label, value]) => <span key={label} data-category={label} style={{ flexGrow: value }} />)}
        </div>
        <ul className="overview-list categories">
          {categories.map(([label, value]) => <li className="overview-list-row" key={label}>
            <span className="category-name" data-category={label}>{t(label)}</span>
            <span className="overview-list-value"><strong><Amount value={value / 100} /></strong><small>{percent.format(value / totalMinor)}</small></span>
          </li>)}
        </ul></> : <p className="empty-state">{t('noPurchases')}</p>}
      </section>
      <section className="panel purchases">
        <div className="overview-card-heading">
          <h2 className="section-heading"><span className="icon-tile" aria-hidden="true"><ReceiptText size={18} /></span>{t('recent')}</h2>
          <Link className="secondary overview-card-link" to="/purchases" aria-label={t('analyticsManage')} title={t('analyticsManage')}><ChevronRight size={17} aria-hidden="true" /></Link>
        </div>
        {ledger.recent.length > 0 ? <ul className="overview-list">
          {ledger.recent.map(row => <li className="overview-list-row" key={row.id}>
            <span className="overview-purchase-name"><strong><bdi>{row.item}</bdi></strong><time dateTime={row.spent_on}>{date.format(new Date(row.spent_on))}</time></span>
            <strong className="overview-list-value"><Amount value={row.amount_minor / 100} /></strong>
          </li>)}
        </ul> : <p className="empty-state">{t('noPurchases')}</p>}
      </section>
      {debts && (debts.pending_count > 0 || due) && <section className="panel follow-up">
        <h2 className="section-heading"><span className="icon-tile" aria-hidden="true"><Clock3 size={18} /></span>{t('followUp')}</h2>
        {debts.pending_count > 0 && <Link to="/connections" className="follow-item follow-link row">
          <strong>{t('needsResponse')}</strong>
          <span className="status">{new Intl.NumberFormat(i18n.language).format(debts.pending_count)}</span>
        </Link>}
        {due?.due_on && due.due_minor !== null && <Link
          to={due.due_source === 'private' ? '/debts?debt=' + due.due_id : '/connections?request=' + due.due_id}
          className="follow-item follow-link">
          <span className="muted">{t('due')} <time dateTime={due.due_on}>{date.format(new Date(due.due_on))}</time></span>
          <span className="row"><strong className="reason"><bdi>{due.due_label}</bdi></strong><Amount value={due.due_minor / 100} /></span>
        </Link>}
      </section>}
    </div>
  </>
}
