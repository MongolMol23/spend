import { Toast } from '../../ui/Toast'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ledgerToday } from '../../data/calendar'
import { toMinorUnits } from '../../data/money'
import type { Label } from '../../i18n/locales'
import { planInput, scheduleLimit, type Due, type InstallmentChange, type Plan } from './api'

export function PlanForm({ plan, dues, busy, error, save, cancel }: {
  plan?: Plan
  dues?: Due[]
  busy: boolean
  error?: Label
  save: (change: InstallmentChange) => Promise<boolean>
  cancel: () => void
}) {
  const { t } = useTranslation()
  const name = useRef<HTMLInputElement>(null)
  const [rows, setRows] = useState(() => (dues ?? [undefined]).map((due, key) => ({
    key, date: due?.due_on ?? ledgerToday(), amount: due ? (due.amount_minor / 100).toFixed(2) : '',
  })))
  const next = useRef(rows.length)
  const [invalid, setInvalid] = useState(false)
  const locked = dues?.some(due => due.paid_minor > 0)
  const message = invalid ? 'installmentInvalidSchedule' : error
  useEffect(() => { if (plan) name.current?.focus() }, [plan])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    const dates = values.getAll('dueOn')
    const schedule = values.getAll('amount').map((amount, index) => ({
      amount_minor: toMinorUnits(String(amount)), due_on: dates[index],
    }))
    const result = planInput.safeParse({ name: values.get('name'), total: values.get('total'), schedule })
    setInvalid(!result.success)
    if (!result.success) return
    if (await save({ kind: 'save', plan, input: result.data }) && !plan) {
      form.reset()
      setRows([{ key: next.current++, date: ledgerToday(), amount: '' }])
    }
  }

  return <section className="panel savings-entry installment-entry">
    <h2 id="installment-form-title">{t(plan ? 'installmentEdit' : 'installmentAdd')}</h2>
    <form onSubmit={submit} noValidate onChange={() => setInvalid(false)}>
      <fieldset className="debt-form" disabled={busy} aria-labelledby="installment-form-title">
        <label>{t('installmentName')}<input ref={name} name="name" defaultValue={plan?.name} dir="auto" required maxLength={120} /></label>
        <label>{t('installmentTotal')}<input name="total" defaultValue={plan ? (plan.total_minor / 100).toFixed(2) : ''}
          inputMode="decimal" dir="ltr" required readOnly={locked} /></label>
        <fieldset className="installment-schedule">
          <legend>{t('installmentSchedule')}</legend>
          <p className="muted">{t(locked ? 'installmentLocked' : 'installmentScheduleHint')}</p>
          {rows.map((row, index) => <div className="installment-schedule-row" key={row.key}>
            <div className="debt-pair">
              <label>{t('installmentDueDate')}<input name="dueOn" type="date" dir="ltr" min="0001-01-01" max="9999-12-31"
                defaultValue={row.date} required readOnly={locked} /></label>
              <label>{t('installmentAmount')}<input name="amount" inputMode="decimal" dir="ltr"
                defaultValue={row.amount} required readOnly={locked} /></label>
            </div>
            {!locked && rows.length > 1 && <button type="button" className="secondary"
              aria-label={t('installmentRemoveNumber', { number: index + 1 })}
              onClick={() => { setRows(rows.filter(value => value.key !== row.key)); setInvalid(false) }}>{t('installmentRemoveDue')}</button>}
          </div>)}
          {!locked && rows.length < scheduleLimit && <button type="button" className="secondary"
            onClick={() => setRows([...rows, { key: next.current++, date: '', amount: '' }])}>{t('installmentAddDue')}</button>}
        </fieldset>
        {message && <Toast message={t(message)} />}
        <div className="debt-actions">
          <button type="submit" className="primary">{t('installmentSave')}</button>
          {plan && <button type="button" className="secondary" onClick={cancel}>{t('cancelPurchase')}</button>}
        </div>
      </fieldset>
    </form>
  </section>
}
