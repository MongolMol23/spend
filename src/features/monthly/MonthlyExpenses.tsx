import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarCheck, Check, Circle, MoreHorizontal } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { ledgerToday } from '../../data/calendar'
import { LedgerQueries, useLedgerOwner } from '../../data/LedgerSession'
import { supabase } from '../../data/supabase'
import { useFormats } from '../../i18n/useFormats'
import type { Label } from '../../i18n/locales'
import { Amount } from '../../ui/Amount'
import { FeatureHeading } from '../../ui/FeatureHeading'
import { LedgerHeading } from '../../ui/LedgerEditor'
import { MonthPicker } from '../../ui/MonthPicker'
import { Toast } from '../../ui/Toast'
import { SignInLink } from '../accounts/SignInLink'
import { budgetKey, budgetWarning } from '../budget/budget'
import { categoryLabel, purchasesKey, type PurchaseClient } from '../purchases/api'
import { changeMonthly, monthlyKey, readMonthly, type MonthlyChange } from './api'
import { MonthlyEditor, type MonthlyEditorMode } from './MonthlyEditor'
import './monthly.css'

function MonthlyWorkspace({ client }: { client: PurchaseClient }) {
  const { t, i18n } = useTranslation()
  const { date } = useFormats()
  const [params, setParams] = useSearchParams()
  const today = ledgerToday()
  const currentMonth = today.slice(0, 7)
  const requested = params.get('month') ?? ''
  const month = /^(?!0000)\d{4}-(0[1-9]|1[0-2])$/.test(requested) ? requested : currentMonth
  const [editor, setEditor] = useState<MonthlyEditorMode>()
  const [notice, setNotice] = useState<Label>()
  const cache = useQueryClient()
  const list = useQuery({
    queryKey: [...monthlyKey, month],
    queryFn: ({ signal }) => readMonthly(client, month, signal),
    refetchInterval: 30_000,
  })
  const mutation = useMutation({
    mutationFn: (change: MonthlyChange) => changeMonthly(client, change),
    onSuccess: async (_, change) => {
      setEditor(undefined)
      await Promise.all([
        cache.invalidateQueries({ queryKey: monthlyKey }),
        cache.invalidateQueries({ queryKey: purchasesKey }),
        cache.invalidateQueries({ queryKey: budgetKey }),
      ])
      const warning = change.kind === 'pay' ? await budgetWarning(client) : undefined
      setNotice(warning ?? (change.kind === 'add' ? 'monthlyAdded' : change.kind === 'pay' ? 'monthlyPaidSaved'
        : change.kind === 'unpay' ? 'monthlyUnpaidSaved' : 'monthlyStopped'))
    },
    onError: () => { void cache.invalidateQueries({ queryKey: monthlyKey }) },
  })
  const entries = list.data ?? []
  const paid = entries.filter(entry => entry.expense_id !== null)
  const unpaid = entries.filter(entry => entry.expense_id === null)
  const expected = entries.reduce((total, entry) => total + entry.expected_minor, 0)
  const spent = paid.reduce((total, entry) => total + (entry.paid_minor ?? 0), 0)
  const remaining = unpaid.reduce((total, entry) => total + entry.expected_minor, 0)

  function open(mode: MonthlyEditorMode) {
    mutation.reset()
    setNotice(undefined)
    setEditor(mode)
  }

  return <>
    {notice && <Toast kind={notice.startsWith('budget') ? 'error' : 'success'} message={t(notice)} />}
    {editor && <MonthlyEditor mode={editor} busy={mutation.isPending} failed={mutation.isError}
      close={() => { setEditor(undefined); mutation.reset() }} save={change => mutation.mutate(change)} />}
    <section className="panel monthly-list">
      <LedgerHeading title={t('monthlyChecklist')} action={t('monthlyAdd')}
        busy={mutation.isPending || month !== currentMonth} onAdd={() => open({ kind: 'add' })} />
      <div className="monthly-toolbar">
        <MonthPicker value={month} onChange={value => setParams({ month: value })} />
        <p className="muted">{t('monthlyIntro')}</p>
      </div>
      {month !== currentMonth && <button className="secondary monthly-current" type="button" onClick={() => setParams({ month: currentMonth })}>{t('thisMonth')}</button>}
      {list.isPending && <p className="loading-state" role="status">{t('loading')}</p>}
      {list.isError && <><Toast message={t('failed')} /><button type="button" className="secondary"
        disabled={list.isFetching} aria-busy={list.isFetching} onClick={() => void list.refetch()}>{t('retry')}</button></>}
      {list.data && <>
        <dl className="monthly-totals">
          {([['monthlyPlanned', expected], ['monthlyPaid', spent], ['monthlyRemaining', remaining]] as const).map(([label, amount]) =>
            <div key={label}><dt>{t(label)}</dt><dd><Amount value={amount / 100} /></dd></div>)}
        </dl>
        {entries.length > 0 && <p className="monthly-progress">{t('monthlyProgress', {
          paid: paid.length.toLocaleString(i18n.language === 'ar' ? 'ar-EG' : 'en-EG'),
          total: entries.length.toLocaleString(i18n.language === 'ar' ? 'ar-EG' : 'en-EG'),
        })}</p>}
        {entries.length === 0 && <p className="monthly-empty">{t(month === currentMonth ? 'monthlyEmpty' : 'monthlyEmptyMonth')}</p>}
        <ul className="monthly-items">
          {entries.map(entry => {
            const isPaid = entry.expense_id !== null
            const overdue = !isPaid && entry.due_on < today
            return <li key={entry.id} data-paid={isPaid} className="monthly-item">
              <button type="button" className="secondary monthly-check" disabled={mutation.isPending || month > currentMonth}
                aria-label={t(isPaid ? 'monthlyUndoName' : 'monthlyPayName', { name: entry.name })}
                aria-pressed={isPaid} onClick={() => open({ kind: isPaid ? 'unpay' : 'pay', due: entry })}>
                {isPaid ? <Check size={22} aria-hidden="true" /> : <Circle size={22} aria-hidden="true" />}
              </button>
              <div className="monthly-item-copy">
                <strong><bdi>{entry.name}</bdi></strong>
                <span className="muted">{t(categoryLabel(entry.category))} · {t(isPaid ? 'monthlyPaidOn' : 'due')}{' '}
                  <time dateTime={entry.paid_on ?? entry.due_on}>{date.format(new Date(entry.paid_on ?? entry.due_on))}</time>
                </span>
                <span className="monthly-item-status" data-overdue={overdue}>{t(isPaid ? 'monthlyPaid' : overdue ? 'monthlyOverdue' : 'monthlyUnpaid')}</span>
                {entry.stops_on && <small className="muted">{t('monthlyStoppedNote')}</small>}
              </div>
              <strong className="monthly-item-amount"><Amount value={(entry.paid_minor ?? entry.expected_minor) / 100} /></strong>
              {!entry.stops_on && month === currentMonth && <button type="button" className="secondary monthly-stop" disabled={mutation.isPending}
                aria-label={t('monthlyStopName', { name: entry.name })} title={t('monthlyStop')}
                onClick={() => open({ kind: 'stop', due: entry })}>
                <MoreHorizontal size={19} aria-hidden="true" />
              </button>}
            </li>
          })}
        </ul>
      </>}
    </section>
  </>
}

export function MonthlyExpenses() {
  const { t } = useTranslation()
  const owner = useLedgerOwner()
  return <main id="main" className="shell" tabIndex={-1}>
    <FeatureHeading title={t('monthlyExpenses')} icon={CalendarCheck} accent="mint" />
    {!supabase ? <Toast message={t('failed')} /> : owner === undefined ? <p className="loading-state" role="status">{t('loading')}</p>
      : !owner ? <SignInLink /> : <LedgerQueries key={owner}><MonthlyWorkspace client={supabase} /></LedgerQueries>}
  </main>
}
