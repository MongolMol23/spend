import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { CalendarCheck, Check, MoreHorizontal, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { useSearchParams } from 'react-router'
import { ledgerToday } from '../../data/calendar'
import { LedgerQueries, useLedgerOwner } from '../../data/LedgerSession'
import { supabase } from '../../data/supabase'
import { useFormats } from '../../i18n/useFormats'
import type { Label } from '../../i18n/locales'
import { Amount } from '../../ui/Amount'
import { FeatureHeading } from '../../ui/FeatureHeading'
import { MonthPicker } from '../../ui/MonthPicker'
import { Toast } from '../../ui/Toast'
import { SignInLink } from '../accounts/SignInLink'
import { categoryLabel, purchasesKey, type PurchaseClient } from '../purchases/api'
import { changeMonthly, monthlyKey, readMonthly, remainingMonthly, type MonthlyChange } from './api'
import { MonthlyEditor, type MonthlyEditorMode } from './MonthlyEditor'
import './monthly.css'

function MonthlyWorkspace({ client, owner }: { client: PurchaseClient; owner: string }) {
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
    mutationFn: (change: MonthlyChange) => changeMonthly(client, owner, change),
    onSuccess: async (_, change) => {
      setEditor(undefined)
      await Promise.all([
        cache.invalidateQueries({ queryKey: monthlyKey }),
        cache.invalidateQueries({ queryKey: purchasesKey }),
      ])
      setNotice(change.kind === 'add' ? 'monthlyAdded' : change.kind === 'pay' ? 'monthlyPaidSaved'
        : change.kind === 'unpay' ? 'monthlyUnpaidSaved' : change.kind === 'stop' ? 'monthlyStopped' : 'monthlyRemoved')
    },
    onError: () => cache.invalidateQueries({ queryKey: monthlyKey }),
  })
  const entries = list.data ?? []
  const paid = entries.filter(entry => remainingMonthly(entry) === 0)
  const expected = entries.reduce((total, entry) => total + entry.expected_minor, 0)
  const spent = entries.reduce((total, entry) => total + entry.paid_minor, 0)
  const remaining = entries.reduce((total, entry) => total + remainingMonthly(entry), 0)

  function open(mode: MonthlyEditorMode) {
    mutation.reset()
    setNotice(undefined)
    setEditor(mode)
  }

  return <>
    {notice && <Toast kind="success" message={t(notice)} />}
    {!editor && mutation.isError && <Toast key={mutation.submittedAt} message={t('monthlyChanged')} />}
    {editor && <MonthlyEditor key={editor.kind} mode={editor} busy={mutation.isPending} failed={mutation.isError}
      close={() => { setEditor(undefined); mutation.reset() }} save={change => mutation.mutate(change)}
      choose={open} />}
    <section className="panel monthly-list">
      <div className="monthly-toolbar">
        <MonthPicker value={month} onChange={value => setParams({ month: value })} />
        {month === currentMonth ? <button type="button" className="primary monthly-add" disabled={mutation.isPending}
          onClick={() => open({ kind: 'add' })}><Plus size={18} aria-hidden="true" />{t('monthlyAdd')}</button>
          : <button className="secondary" type="button" onClick={() => setParams({ month: currentMonth })}>{t('thisMonth')}</button>}
      </div>
      {list.isPending && <p className="loading-state" role="status">{t('loading')}</p>}
      {list.isError && <><Toast message={t('failed')} /><button type="button" className="secondary"
        disabled={list.isFetching} aria-busy={list.isFetching} onClick={() => void list.refetch()}>{t('retry')}</button></>}
      {list.data && <>
        {entries.length > 0 && <div className="monthly-summary">
          <div className="monthly-summary-main">
            <div><span>{t('monthlyRemaining')}</span><strong><Amount value={remaining / 100} /></strong></div>
            <p>{t('monthlyProgress', {
              paid: paid.length.toLocaleString(i18n.language === 'ar' ? 'ar-EG' : 'en-EG'),
              total: entries.length.toLocaleString(i18n.language === 'ar' ? 'ar-EG' : 'en-EG'),
            })}</p>
          </div>
          <progress aria-label={t('monthlyPaid')} value={expected - remaining} max={expected} />
          <dl className="monthly-totals">
            {([['monthlyPlanned', expected], ['monthlyPaid', spent]] as const).map(([label, amount]) =>
              <div key={label}><dt>{t(label)}</dt><dd><Amount value={amount / 100} /></dd></div>)}
          </dl>
        </div>}
        {entries.length === 0 && <p className="monthly-empty">{t(month === currentMonth ? 'monthlyEmpty' : 'monthlyEmptyMonth')}</p>}
        <ul className="monthly-items">
          {entries.map(entry => {
            const balance = remainingMonthly(entry)
            const isPaid = balance === 0
            const overdue = !isPaid && entry.due_on !== null && entry.due_on < today
            const lastPayment = isPaid ? entry.payments[0]?.paid_on : undefined
            const shownDate = lastPayment ?? entry.due_on
            return <li key={entry.id} data-paid={isPaid} className="monthly-item">
              <button type="button" className="monthly-item-detail" disabled={mutation.isPending}
                aria-label={t('monthlyOpenName', { name: entry.name })} aria-haspopup="dialog"
                onClick={() => open({ kind: 'pay', due: entry })}>
                <span className="monthly-check-box" aria-hidden="true">
                  {isPaid ? <Check size={18} strokeWidth={3} /> : <Plus size={17} />}
                </span>
              <span className="monthly-item-copy">
                <span className="monthly-item-title">
                  <strong><bdi>{entry.name}</bdi></strong>
                  <strong className="monthly-item-amount"><Amount value={entry.expected_minor / 100} /></strong>
                </span>
                <span className="monthly-item-meta">
                  <span>{t(categoryLabel(entry.category))}</span>
                  {shownDate && <span>{t(lastPayment ? 'monthlyPaidOn' : 'due')}{' '}
                    <time dateTime={shownDate}>{date.format(new Date(shownDate))}</time>
                  </span>}
                  {overdue && <span className="monthly-overdue">{t('monthlyOverdue')}</span>}
                </span>
                {entry.paid_minor > 0 && !isPaid && <span className="monthly-item-meta">
                  <span>{t('monthlyPaid')} <Amount value={entry.paid_minor / 100} /></span>
                  <span>{t('monthlyRemaining')} <Amount value={balance / 100} /></span>
                </span>}
                {entry.stops_on && <small className="muted">{t('monthlyStoppedNote')}</small>}
              </span>
              </button>
              {month === currentMonth && <button type="button" className="secondary monthly-menu" disabled={mutation.isPending}
                aria-label={t('monthlyManageName', { name: entry.name })} aria-haspopup="dialog"
                onClick={() => open({ kind: 'manage', due: entry })}>
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
      : !owner ? <SignInLink /> : <LedgerQueries key={owner}><MonthlyWorkspace client={supabase} owner={owner} /></LedgerQueries>}
  </main>
}
