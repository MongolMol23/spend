import { useId, useState, type FormEvent } from 'react'
import { CalendarMinus, Trash2 } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { z } from 'zod'
import { ledgerToday } from '../../data/calendar'
import { toMinorUnits } from '../../data/money'
import { HistoryCalendar } from '../../ui/HistoryCalendar'
import { LedgerEditor } from '../../ui/LedgerEditor'
import { Select } from '../../ui/Select'
import { Toast } from '../../ui/Toast'
import { expenseCategories } from '../purchases/api'
import type { MonthlyChange, MonthlyDue } from './api'

export type MonthlyEditorMode = { kind: 'add' } | { kind: 'pay' | 'unpay' | 'manage' | 'stop' | 'remove'; due: MonthlyDue }

export function MonthlyEditor({ mode, busy, failed, close, save, choose }: {
  mode: MonthlyEditorMode; busy: boolean; failed: boolean; close: () => void
  save: (change: MonthlyChange) => void
  choose: (kind: 'stop' | 'remove', due: MonthlyDue) => void
}) {
  const { t } = useTranslation()
  const title = useId()
  const dateId = useId()
  const [operationId] = useState(() => crypto.randomUUID())
  const [invalid, setInvalid] = useState(false)
  const today = ledgerToday()
  const monthStart = mode.kind === 'pay' ? mode.due.due_on.slice(0, 7) + '-01' : today
  const maxDate = today
  const [paidOn, setPaidOn] = useState(maxDate)
  const labels = {
    add: 'monthlyAdd', pay: 'monthlyMarkPaid', unpay: 'monthlyUndo',
    manage: 'monthlyManage', stop: 'monthlyStop', remove: 'monthlyRemove',
  } as const

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    if (mode.kind === 'stop' || mode.kind === 'remove') { save({ kind: mode.kind, due: mode.due }); return }
    if (mode.kind === 'unpay' && mode.due.expense_id) {
      save({ kind: 'unpay', due: mode.due, expenseId: mode.due.expense_id })
      return
    }
    const values = new FormData(event.currentTarget)
    const amount = toMinorUnits(String(values.get('amount') ?? ''))
    const name = String(values.get('name') ?? '').trim()
    const day = Number(values.get('day'))
    const category = expenseCategories.find(value => value === values.get('category'))
    if (!amount || (mode.kind === 'add' && (!name || name.length > 120 || !Number.isInteger(day) || day < 1 || day > 31 || !category))
      || (mode.kind === 'pay' && (!z.iso.date().safeParse(paidOn).success || paidOn < monthStart || paidOn > maxDate))) {
      setInvalid(true)
      return
    }
    if (mode.kind === 'add' && category) save({ kind: 'add', id: operationId, name, amount, day, category })
    if (mode.kind === 'pay') save({ kind: 'pay', due: mode.due, expenseId: operationId, amount, date: paidOn })
  }

  return <LedgerEditor titleId={title} busy={busy} onClose={close}>
    <section className="panel monthly-editor">
      <h2 id={title}>{t(labels[mode.kind])}</h2>
      {mode.kind !== 'add' && <p className="monthly-editor-name"><bdi>{mode.due.name}</bdi></p>}
      {mode.kind === 'manage' ? <div className="monthly-manage-options">
        {!mode.due.stops_on && <button type="button" className="secondary" onClick={() => choose('stop', mode.due)}>
          <CalendarMinus size={18} aria-hidden="true" />{t('monthlyStop')}
        </button>}
        <button type="button" className="secondary monthly-remove" onClick={() => choose('remove', mode.due)}>
          <Trash2 size={18} aria-hidden="true" />{t('monthlyRemove')}
        </button>
      </div> : <form onSubmit={submit} onChange={() => setInvalid(false)} noValidate>
        {mode.kind === 'add' && <label>{t('monthlyName')}<input name="name" dir="auto" maxLength={120} required /></label>}
        {(mode.kind === 'add' || mode.kind === 'pay') && <label>{t(mode.kind === 'pay' ? 'monthlyActual' : 'monthlyExpected')}
          <input name="amount" dir="ltr" inputMode="decimal" required
            defaultValue={mode.kind === 'pay' ? (mode.due.expected_minor / 100).toFixed(2) : ''} />
        </label>}
        {mode.kind === 'add' && <>
          <label>{t('monthlyDay')}<input name="day" type="number" dir="ltr" inputMode="numeric" min={1} max={31} step={1} defaultValue={1} required /></label>
          <p className="muted monthly-help">{t('monthlyDayHelp')}</p>
          <label>{t('purchaseCategory')}<Select name="category" defaultValue="bills">
            {expenseCategories.map(category => <option value={category} key={category}>{t(category)}</option>)}
          </Select></label>
          <p className="muted monthly-help">{t('monthlyRepeatHelp')}</p>
        </>}
        {mode.kind === 'pay' && <div className="monthly-date">
          <label htmlFor={dateId}>{t('monthlyPaidDate')}</label>
          <HistoryCalendar triggerId={dateId} label={t('monthlyPaidDate')} day={paidOn} today={today} min={monthStart} max={maxDate} selectDay={setPaidOn} />
          <p className="muted monthly-help">{t('monthlyPayHelp')}</p>
        </div>}
        {mode.kind === 'unpay' && <p>{t('monthlyUndoHelp')}</p>}
        {mode.kind === 'stop' && <p>{t('monthlyStopHelp')}</p>}
        {mode.kind === 'remove' && <p>{t('monthlyRemoveHelp')}</p>}
        {invalid && <p className="monthly-error" role="alert">{t('monthlyInvalid')}</p>}
        {failed && <Toast message={t('monthlyChanged')} />}
        <div className="monthly-editor-actions">
          <button type="button" className="secondary" disabled={busy} onClick={close}>{t('cancelPurchase')}</button>
          <button type="submit" className={mode.kind === 'remove' ? 'primary monthly-remove' : 'primary'}
            disabled={busy} aria-busy={busy}>{t(mode.kind === 'add' ? 'monthlySave' : labels[mode.kind])}</button>
        </div>
      </form>}
    </section>
  </LedgerEditor>
}
