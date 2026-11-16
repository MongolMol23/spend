import { Modal } from '../../ui/Modal'
import { Toast } from '../../ui/Toast'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ledgerToday } from '../../data/calendar'
import type { Label } from '../../i18n/locales'
import { Amount } from '../../ui/Amount'
import { Select } from '../../ui/Select'
import { paymentInput, type Due, type InstallmentChange, type Plan } from './api'

export function PlanDetail({ plan, dues, date, busy, paymentError, archiveError, save, edit }: {
  plan: Plan
  dues: Due[]
  date: Intl.DateTimeFormat
  busy: boolean
  paymentError?: Label
  archiveError?: Label
  save: (change: InstallmentChange) => Promise<boolean>
  edit: () => void
}) {
  const { t } = useTranslation()
  const [filter, setFilter] = useState('all')
  const [selected, setSelected] = useState<string>()
  const [invalid, setInvalid] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const today = ledgerToday()
  const paid = dues.reduce((total, due) => total + due.paid_minor, 0)
  const message = invalid ? 'installmentInvalidPayment' : paymentError
  const state = (due: Due) => due.paid_minor === due.amount_minor ? 'installmentPaid'
    : due.due_on < today ? 'installmentOverdue' : 'installmentUpcoming'
  const visible = dues.filter(due => filter === 'all' || filter === state(due))
  useEffect(() => { heading.current?.focus() }, [])

  async function submit(event: FormEvent<HTMLFormElement>, due: Due) {
    event.preventDefault()
    const result = paymentInput.safeParse(Object.fromEntries(new FormData(event.currentTarget)))
    if (!result.success || result.data.amount > due.amount_minor - due.paid_minor) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    if (await save({ kind: 'pay', plan, due, input: result.data })) setSelected(undefined)
  }

  return <section className="panel debt-detail installment-detail">
    <h2 ref={heading} tabIndex={-1}><bdi>{plan.name}</bdi></h2>
    {plan.archived_at && <p className="status">{t('installmentArchived')}</p>}
    <dl className="debt-balances">
      {([
        ['installmentTotal', plan.total_minor], ['installmentPaid', paid], ['remaining', plan.total_minor - paid],
      ] as const).map(([label, amount]) => <div key={label}><dt>{t(label)}</dt><dd><Amount value={amount / 100} /></dd></div>)}
    </dl>
    <label className="installment-filter">{t('installmentFilter')} <Select value={filter} onChange={event => {
      setFilter(event.target.value)
      setSelected(undefined)
      setInvalid(false)
    }}>
      <option value="all">{t('installmentAll')}</option>
      {(['installmentUpcoming', 'installmentOverdue', 'installmentPaid'] as const)
        .map(value => <option value={value} key={value}>{t(value)}</option>)}
    </Select></label>
    {visible.length ? <ul className="ledger installment-dues">
      {visible.map(due => {
        const status = state(due)
        const remaining = due.amount_minor - due.paid_minor
        return <li key={due.id}>
          <div className="row debt-row">
            <time dateTime={due.due_on}>{date.format(new Date(due.due_on))}</time>
            <span className="status" data-state={status === 'installmentPaid' ? 'settled' : status === 'installmentOverdue' ? 'declined' : undefined}>{t(status)}</span>
          </div>
          <p className="row debt-row">
            <span>{t('installmentAmount')} · <Amount value={due.amount_minor / 100} /></span>
            <span>{t('installmentPaid')} · <Amount value={due.paid_minor / 100} /></span>
            <span>{t('remaining')} · <Amount value={remaining / 100} /></span>
          </p>
          {!plan.archived_at && remaining > 0 && (selected === due.id
            ? <form onSubmit={event => void submit(event, due)} noValidate onChange={() => setInvalid(false)}>
              <fieldset className="debt-form" disabled={busy} aria-label={t('debtPay')}>
                <div className="debt-pair">
                  <label>{t('debtPaymentAmount')}<input name="amount" inputMode="decimal" dir="ltr" required /></label>
                  <label>{t('debtPaidOn')}<input name="paidOn" type="date" dir="ltr" min="0001-01-01" max="9999-12-31" defaultValue={today} required /></label>
                </div>
                {message && <Toast message={t(message)} />}
                <div className="debt-actions">
                  <button className="primary" type="submit">{t('debtPay')}</button>
                  <button className="secondary" type="button" onClick={() => setSelected(undefined)}>{t('cancelPurchase')}</button>
                </div>
              </fieldset>
            </form>
            : <button type="button" className="secondary" disabled={busy}
              onClick={() => { setSelected(due.id); setInvalid(false) }}>{t('debtPay')}</button>)}
        </li>
      })}
    </ul> : <p className="empty-state">{t('installmentNoDues')}</p>}
    {!plan.archived_at && <div className="debt-actions">
      <button type="button" className="secondary" disabled={busy} onClick={edit}>{t('installmentEdit')}</button>
      <button type="button" className="secondary" disabled={busy} onClick={() => dialog.current?.showModal()}>{t('installmentArchive')}</button>
    </div>}
    <Modal ref={dialog} busy={busy} className="panel debt-dialog" aria-labelledby="archive-installment-title">
      <h2 id="archive-installment-title">{t('installmentArchive')}</h2>
      <p><bdi>{plan.name}</bdi></p>
      <p>{t('installmentArchivePrompt')}</p>
      {archiveError && <Toast message={t(archiveError)} />}
      <div className="debt-actions">
        <button type="button" className="secondary" disabled={busy} onClick={() => dialog.current?.close()}>{t('cancelPurchase')}</button>
        <button type="button" className="primary" disabled={busy} onClick={async () => {
          if (await save({ kind: 'archive', plan })) dialog.current?.close()
        }}>{t('debtArchiveConfirm')}</button>
      </div>
    </Modal>
  </section>
}
