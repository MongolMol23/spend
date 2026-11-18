import { Toast } from '../../ui/Toast'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { CalendarDays, ChevronRight, Vault } from 'lucide-react'
import { Amount } from '../../ui/Amount'
import { debtKey, debtOverview } from '../debts/api'
import { installmentKey, readInstallmentOverview } from '../installments/api'
import { ledgerToday } from '../../data/calendar'
import { useFormats } from '../../i18n/useFormats'
import { monthlyPurchases, purchasesKey, recentPurchases, type PurchaseClient } from '../purchases/api'
import { readSavingsOverview, savingsKey } from '../savings/api'
import { Dashboard } from './Dashboard'
import { BudgetCard } from '../budget/BudgetCard'
import { OverviewLoading } from './OverviewLoading'

export function PurchaseOverview({ client, month }: { client: PurchaseClient; month: string }) {
  const { t } = useTranslation()
  const { date } = useFormats()
  const query = useQuery({
    queryKey: [...purchasesKey, 'overview', month],
    queryFn: async ({ signal }) => {
      const [summary, recent] = await Promise.all([
        monthlyPurchases(client, month, signal), recentPurchases(client, signal),
      ])
      return { summary, recent }
    },
  })
  const debts = useQuery({
    queryKey: [...debtKey, 'overview'],
    queryFn: ({ signal }) => debtOverview(client, signal),
    refetchInterval: 5000,
  })
  const savings = useQuery({
    queryKey: [...savingsKey, 'overview', month],
    queryFn: ({ signal }) => readSavingsOverview(client, month, signal),
  })
  const installments = useQuery({
    queryKey: [...installmentKey, 'overview', month],
    queryFn: ({ signal }) => readInstallmentOverview(client, month, signal),
  })
  if (query.isPending) return <OverviewLoading />
  if (!query.data) return <div className="panel">
    <Toast message={t('failed')} />
    <button className="primary" type="button" disabled={query.isFetching} aria-busy={query.isFetching} onClick={() => void query.refetch()}>{t('retry')}</button>
  </div>
  return <>
    {query.isError && <Toast message={t('failed')} />}
    {debts.isError && <div className="panel">
      <Toast message={t('debtOverviewFailed')} />
      <button type="button" className="secondary" disabled={debts.isFetching} aria-busy={debts.isFetching} onClick={() => void debts.refetch()}>{t('retry')}</button>
    </div>}
    <BudgetCard client={client} />
    <Dashboard ledger={query.data} debts={debts.data ?? undefined} />
    <div className="overview-plans">
      <section className="panel overview-plan overview-savings">
        <div className="overview-card-heading">
          <h2 className="section-heading"><span className="icon-tile" aria-hidden="true"><Vault size={18} /></span>{t('savingsGoals')}</h2>
          <Link className="secondary overview-card-link" to="/savings" aria-label={t('savingsViewGoals')} title={t('savingsViewGoals')}><ChevronRight size={17} aria-hidden="true" /></Link>
        </div>
        {savings.isPending && <p className="loading-state" role="status">{t('loading')}</p>}
        {savings.isError && <><Toast message={t('savingsOverviewFailed')} />
          <button type="button" className="secondary" disabled={savings.isFetching} aria-busy={savings.isFetching} onClick={() => void savings.refetch()}>{t('retry')}</button></>}
        {savings.data && <dl className="overview-plan-totals">
          {([
            ['savingsActiveTotal', savings.data.saved_minor],
            ['savingsThisMonthIn', savings.data.deposited_minor],
            ['savingsThisMonthOut', savings.data.withdrawn_minor],
          ] as const).map(([label, amount]) => <div key={label}><dt>{t(label)}</dt><dd><Amount value={amount / 100} /></dd></div>)}
        </dl>}
      </section>
      <section className="panel overview-plan overview-installments">
        <div className="overview-card-heading">
          <h2 className="section-heading"><span className="icon-tile" aria-hidden="true"><CalendarDays size={18} /></span>{t('installments')}</h2>
          <Link className="secondary overview-card-link" to="/installments" aria-label={t('installmentViewPlans')} title={t('installmentViewPlans')}><ChevronRight size={17} aria-hidden="true" /></Link>
        </div>
        {installments.isPending && <p className="loading-state" role="status">{t('loading')}</p>}
        {installments.isError && <><Toast message={t('installmentOverviewFailed')} />
          <button type="button" className="secondary" disabled={installments.isFetching} aria-busy={installments.isFetching} onClick={() => void installments.refetch()}>{t('retry')}</button></>}
        {installments.data && <dl className="overview-plan-totals">
          {([
            ['installmentRemaining', installments.data.remaining_minor],
            ['installmentMonthPaid', installments.data.paid_minor],
            ['installmentOverdueBalance', installments.data.overdue_minor],
          ] as const).map(([label, amount]) => <div key={label}><dt>{t(label)}</dt><dd><Amount value={amount / 100} /></dd></div>)}
        </dl>}
        {installments.data?.next_plan_id && installments.data.next_due_on && installments.data.next_minor !== null &&
          <Link className="follow-item follow-link" to={'/installments?plan=' + installments.data.next_plan_id}>
            <span className="muted">{t(installments.data.next_due_on < ledgerToday() ? 'installmentOverdue' : 'due')}{' '}
              <time dateTime={installments.data.next_due_on}>{date.format(new Date(installments.data.next_due_on))}</time></span>
            <span className="row"><strong className="reason"><bdi>{installments.data.next_name}</bdi></strong>
              <Amount value={installments.data.next_minor / 100} /></span>
          </Link>}
      </section>
    </div>
  </>
}
