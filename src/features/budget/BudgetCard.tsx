import { useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { Wallet } from 'lucide-react'
import { Link } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ledgerToday, shiftLedgerDay } from '../../data/calendar'
import { toMinorUnits } from '../../data/money'
import { useFormats } from '../../i18n/useFormats'
import { Amount } from '../../ui/Amount'
import { LedgerEditor } from '../../ui/LedgerEditor'
import { Toast } from '../../ui/Toast'
import type { PurchaseClient } from '../purchases/api'
import { budgetKey, budgetProgress, readBudget } from './budget'
import './budget.css'

export function BudgetCard({ client }: { client: PurchaseClient }) {
  const { t, i18n } = useTranslation()
  const { date } = useFormats()
  const cache = useQueryClient()
  const [editing, setEditing] = useState(false)
  const [invalid, setInvalid] = useState(false)
  const budget = useQuery({
    queryKey: budgetKey,
    queryFn: ({ signal }) => readBudget(client, signal),
    refetchInterval: 30_000,
  })
  const save = useMutation({
    mutationFn: async ({ amount, end }: { amount: number; end: string }) => {
      const { error } = await client.rpc('spend_save_budget', { p_amount: amount, p_end: end })
      if (error) throw error
    },
    onSuccess: () => {
      setEditing(false)
      void cache.invalidateQueries({ queryKey: budgetKey })
    },
  })
  const data = budget.data
  const progress = data ? budgetProgress(data) : undefined
  const today = data?.today ?? ledgerToday()
  const maxEnd = shiftLedgerDay(progress?.days && data ? data.starts_on : today, 365)
  const warning = !progress ? undefined
    : progress.balance < 0 ? 'budgetOverTotal'
    : progress.days && progress.balance === 0 ? 'budgetUsedUp'
    : progress.days && data && data.today_minor > progress.allowance ? 'budgetOverToday'
    : undefined

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (save.isPending) return
    const values = new FormData(event.currentTarget)
    const amount = toMinorUnits(String(values.get('amount') ?? ''))
    const end = String(values.get('end') ?? '')
    if (!amount || end < today || end > maxEnd) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    save.mutate({ amount, end })
  }

  return <section className="panel budget-card" aria-labelledby="budget-title">
    <div className="row budget-heading">
      <h2 id="budget-title" className="section-heading"><span className="icon-tile" aria-hidden="true"><Wallet size={19} /></span>{t('budgetTitle')}</h2>
      {budget.isSuccess && <button type="button" className="secondary" onClick={() => {
        setInvalid(false)
        save.reset()
        setEditing(true)
      }}>{t(progress?.days ? 'budgetEdit' : 'budgetStart')}</button>}
    </div>
    {budget.isPending && <p className="loading-state" role="status">{t('loading')}</p>}
    {budget.isError && <button type="button" className="secondary" disabled={budget.isFetching}
      aria-busy={budget.isFetching} onClick={() => void budget.refetch()}>{t('retry')}</button>}
    {data === null && <p className="muted">{t('budgetIntro')}</p>}
    {data && progress && <>
      <p className="budget-pace muted">
        <span>{t('budgetAmount')} <Amount value={data.amount_minor / 100} /></span>
        <span>{t('budgetUntil')} <time dateTime={data.ends_on}>{date.format(new Date(data.ends_on))}</time></span>
      </p>
      <dl className="budget-figures">
        {progress.days > 0 && <div><dt>{t('budgetToday')}</dt><dd><Amount value={progress.available / 100} /></dd></div>}
        <div><dt>{t('budgetBalance')}</dt><dd><Amount value={progress.balance / 100} /></dd></div>
        <div><dt>{t('budgetSpent')}</dt><dd><Amount value={data.spent_minor / 100} /></dd></div>
      </dl>
      {progress.days > 0 && <p className="budget-pace">
        {t('budgetDaysLeft', { days: progress.days.toLocaleString(i18n.language === 'ar' ? 'ar-EG' : 'en-EG') })}
        <span>{t('budgetDailyTarget')} <Amount value={progress.allowance / 100} /></span>
      </p>}
      {warning && <p className="budget-warning" role="status">{t(warning)}</p>}
      {progress.days === 0 && <div className="budget-finished">
        <p>{t(progress.balance > 0 ? 'budgetSaveLeftover' : 'budgetFinished')}</p>
        {progress.balance > 0 && <Link className="secondary" to="/savings">{t('savingsViewGoals')}</Link>}
      </div>}
    </>}
    {editing && <LedgerEditor titleId="budget-edit-title" busy={save.isPending} onClose={() => setEditing(false)}>
      <section className="panel">
        <h2 id="budget-edit-title">{t(progress?.days ? 'budgetEdit' : 'budgetStart')}</h2>
        <form className="budget-form" onSubmit={submit}>
          <label>{t('budgetAmount')}<input name="amount" inputMode="decimal" dir="ltr" required
            defaultValue={data && progress?.days ? (data.amount_minor / 100).toFixed(2) : ''} /></label>
          <label>{t('budgetEnd')}<input type="date" name="end" required min={today} max={maxEnd}
            defaultValue={data && progress?.days ? data.ends_on : shiftLedgerDay(today, 9)} /></label>
          {invalid && <p role="alert">{t('budgetInvalid')}</p>}
          {save.isError && <Toast message={t('failed')} />}
          <button className="primary" disabled={save.isPending} aria-busy={save.isPending}>{t('budgetSave')}</button>
        </form>
      </section>
    </LedgerEditor>}
  </section>
}
