import { Toast } from '../../ui/Toast'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { Label } from '../../i18n/locales'
import { Select } from '../../ui/Select'
import { debtInput, type DebtChange, type PrivateDebt } from './api'

export function DebtForm({ debt, busy, error, save, cancel }: {
  debt?: PrivateDebt
  busy: boolean
  error?: Label
  save: (change: DebtChange) => Promise<boolean>
  cancel: () => void
}) {
  const { t } = useTranslation()
  const [invalid, setInvalid] = useState<Label>()
  const contact = useRef<HTMLInputElement>(null)
  const message = invalid ?? error
  useEffect(() => { if (debt) contact.current?.focus() }, [debt])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const result = debtInput.safeParse(Object.fromEntries(new FormData(form)))
    if (!result.success) {
      setInvalid('debtInvalid')
      const field = form.elements.namedItem(String(result.error.issues[0]?.path[0]))
      if (field instanceof HTMLElement) field.focus()
      return
    }
    if (debt && result.data.amount < debt.paid_minor) {
      setInvalid('debtBelowPaid')
      form.querySelector<HTMLInputElement>('[name="amount"]')?.focus()
      return
    }
    setInvalid(undefined)
    if (await save({ kind: 'save', debt, input: result.data }) && !debt) form.reset()
  }
  return <section className="panel debt-entry">
    <h2 id="debt-entry-title">{t(debt ? 'editDebt' : 'addDebt')}</h2>
    <form onSubmit={submit} noValidate onChange={() => setInvalid(undefined)}>
      <fieldset className="debt-form" aria-labelledby="debt-entry-title" disabled={busy}>
        <label>{t('debtContact')}<input ref={contact} name="contact" defaultValue={debt?.contact} dir="auto" required maxLength={120} /></label>
        {debt && debt.paid_minor > 0 ? <p>{t('debtDirection')} · {t(debt.direction)}
          <input type="hidden" name="direction" value={debt.direction} />
        </p> : <label>{t('debtDirection')}
          <Select name="direction" defaultValue={debt?.direction ?? 'owed'}>
            <option value="owed">{t('owed')}</option><option value="owe">{t('owe')}</option>
          </Select>
        </label>}
        <label>{t('debtAmount')}<input name="amount" defaultValue={debt ? (debt.amount_minor / 100).toFixed(2) : ''}
          inputMode="decimal" dir="ltr" required /></label>
        <label>{t('debtDue')}<input name="dueOn" type="date" dir="ltr" min="0001-01-01" max="9999-12-31" defaultValue={debt?.due_on ?? ''} /></label>
        {message && <Toast message={t(message)} />}
        <div className="debt-actions">
          <button type="submit" className="primary" aria-busy={busy}>{t('debtSave')}</button>
          {debt && <button type="button" className="secondary" onClick={cancel}>{t('cancelPurchase')}</button>}
        </div>
      </fieldset>
    </form>
  </section>
}
