import { useId, useState, type FormEvent } from 'react'
import { CalendarMinus, Trash2, Undo2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { ledgerToday } from '../../data/calendar'
import { toMinorUnits } from '../../data/money'
import { useFormats } from '../../i18n/useFormats'
import { Amount } from '../../ui/Amount'
import { HistoryCalendar } from '../../ui/HistoryCalendar'
import { LedgerEditor } from '../../ui/LedgerEditor'
import { Select } from '../../ui/Select'
import { Toast } from '../../ui/Toast'
import { expenseCategories } from '../purchases/api'
import { remainingMonthly, type MonthlyChange, type MonthlyDue } from './api'

export type MonthlyEditorMode = { kind: 'add' }
  | { kind: 'pay' | 'manage' | 'stop' | 'remove'; due: MonthlyDue }
  | { kind: 'unpay'; due: MonthlyDue; expenseId: string }

export function MonthlyEditor({ mode, busy, failed, close, save, choose }: {
  mode: MonthlyEditorMode; busy: boolean; failed: boolean; close: () => void
  save: (change: MonthlyChange) => void
  choose: (mode: MonthlyEditorMode) => void
}) {
  const { t } = useTranslation()
  const { date } = useFormats()
  const title = useId()
  const dateId = useId()
  const [operationId] = useState(() => crypto.randomUUID())
  const [invalid, setInvalid] = useState(false)
  const today = ledgerToday()
  const monthStart = mode.kind === 'pay' ? mode.due.month : today
  const balance = mode.kind === 'pay' ? remainingMonthly(mode.due) : 0
  const canPay = mode.kind === 'pay' && balance > 0 && monthStart <= today
  const [paidOn, setPaidOn] = useState(today)
  const labels = {
    add: 'monthlyAdd', pay: 'monthlyPayments', unpay: 'monthlyUndo',
    manage: 'monthlyManage', stop: 'monthlyStop', remove: 'monthlyRemove',
  } as const

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    if (mode.kind === 'stop' || mode.kind === 'remove') { save({ kind: mode.kind, due: mode.due }); return }
    if (mode.kind === 'unpay') {
      save(mode)
      return
    }
    const values = new FormData(event.currentTarget)
    const amount = toMinorUnits(String(values.get('amount') ?? ''))
    const name = String(values.get('name') ?? '').trim()
    const rawDay = String(values.get('day') ?? '')
    const day = rawDay === '' ? null : Number(rawDay)
    const dayInput = event.currentTarget.elements.namedItem('day')
    const category = expenseCategories.find(value => value === values.get('category'))
    if (!amount || (mode.kind === 'add' && (!name || name.length > 120 || !category
      || (day !== null && (!Number.isInteger(day) || day < 1 || day > 31))
      || (dayInput instanceof HTMLInputElement && dayInput.validity.badInput)))
      || (mode.kind === 'pay' && (!canPay || amount > balance
        || !z.iso.date().safeParse(paidOn).success || paidOn < monthStart || paidOn > today))) {
      setInvalid(true)
      return
    }
    if (mode.kind === 'add' && category) save({ kind: 'add', id: operationId, name, amount, day, category })
    if (mode.kind === 'pay') save({ kind: 'pay', due: mode.due, amount, date: paidOn })
  }

  return <LedgerEditor titleId={title} busy={busy} onClose={close}>
    <section className="panel monthly-editor">
      <h2 id={title}>{t(labels[mode.kind])}</h2>
      {mode.kind !== 'add' && <p className="monthly-editor-name"><bdi>{mode.due.name}</bdi></p>}
      {mode.kind === 'pay' && <dl className="monthly-totals monthly-payment-totals">
        <div><dt>{t('monthlyPaid')}</dt><dd><Amount value={mode.due.paid_minor / 100} /></dd></div>
        <div><dt>{t('monthlyRemaining')}</dt><dd><Amount value={balance / 100} /></dd></div>
      </dl>}
      {mode.kind === 'manage' ? <div className="monthly-manage-options">
          {!mode.due.stops_on && <button type="button" className="secondary" onClick={() => choose({ kind: 'stop', due: mode.due })}>
            <CalendarMinus size={18} aria-hidden="true" />{t('monthlyStop')}
          </button>}
          <button type="button" className="secondary monthly-remove" onClick={() => choose({ kind: 'remove', due: mode.due })}>
            <Trash2 size={18} aria-hidden="true" />{t('monthlyRemove')}
          </button>
      </div> : (mode.kind !== 'pay' || canPay) && <form onSubmit={submit} onChange={() => setInvalid(false)} noValidate>
        {mode.kind === 'add' && <label>{t('monthlyName')}<input name="name" dir="auto" maxLength={120} required /></label>}
        {(mode.kind === 'add' || mode.kind === 'pay') && <label>{t(mode.kind === 'pay' ? 'monthlyActual' : 'monthlyExpected')}
          <input name="amount" dir="ltr" inputMode="decimal" required
            placeholder={mode.kind === 'pay' ? (balance / 100).toFixed(2) : undefined} />
        </label>}
        {mode.kind === 'add' && <>
          <label>{t('monthlyDay')}<input name="day" type="number" dir="ltr" inputMode="numeric" min={1} max={31} step={1} /></label>
          <p className="muted monthly-help">{t('monthlyDayHelp')}</p>
          <label>{t('purchaseCategory')}<Select name="category" defaultValue="bills">
            {expenseCategories.map(category => <option value={category} key={category}>{t(category)}</option>)}
          </Select></label>
          <p className="muted monthly-help">{t('monthlyRepeatHelp')}</p>
        </>}
        {mode.kind === 'pay' && <div className="monthly-date">
          <label htmlFor={dateId}>{t('monthlyPaidDate')}</label>
          <HistoryCalendar triggerId={dateId} label={t('monthlyPaidDate')} day={paidOn} today={today} min={monthStart} max={today} selectDay={day => { setPaidOn(day); setInvalid(false) }} />
          <p className="muted monthly-help">{t('monthlyPayHelp')}</p>
        </div>}
        {mode.kind === 'unpay' && <p>{t('monthlyUndoHelp')}</p>}
        {mode.kind === 'stop' && <p>{t('monthlyStopHelp')}</p>}
        {mode.kind === 'remove' && <p>{t('monthlyRemoveHelp')}</p>}
        {invalid && <p className="monthly-error" role="alert">{t(mode.kind === 'pay' ? 'monthlyInvalidPayment' : 'monthlyInvalid')}</p>}
        {failed && <Toast message={t('monthlyChanged')} />}
        <div className="monthly-editor-actions">
          <button type="button" className="secondary" disabled={busy} onClick={close}>{t('cancelPurchase')}</button>
          <button type="submit" className={mode.kind === 'remove' ? 'primary monthly-remove' : 'primary'}
            disabled={busy} aria-busy={busy}>{t(mode.kind === 'add' ? 'monthlySave' : mode.kind === 'pay' ? 'monthlyMarkPaid' : labels[mode.kind])}</button>
        </div>
      </form>}
      {mode.kind === 'pay' && mode.due.payments.length > 0 && <ul className="monthly-payment-history" aria-label={t('monthlyPayments')}>
        {mode.due.payments.map(payment => <li key={payment.id}>
          <time dateTime={payment.paid_on}>{date.format(new Date(payment.paid_on))}</time>
          <strong><Amount value={payment.amount_minor / 100} /></strong>
          <button type="button" className="secondary monthly-undo" aria-label={t('monthlyUndo')} title={t('monthlyUndo')} disabled={busy}
            onClick={() => choose({ kind: 'unpay', due: mode.due, expenseId: payment.id })}>
            <Undo2 size={16} aria-hidden="true" />
          </button>
        </li>)}
      </ul>}
    </section>
  </LedgerEditor>
}
