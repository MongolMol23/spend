import { Modal } from '../../ui/Modal'
import { LedgerEditor } from '../../ui/LedgerEditor'
import { Toast } from '../../ui/Toast'
import { ArrowLeft, CalendarDays, Plus } from 'lucide-react'
import { Link } from 'react-router'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ledgerToday } from '../../data/calendar'
import type { Label } from '../../i18n/locales'
import { Amount } from '../../ui/Amount'
import { Select } from '../../ui/Select'
import { paymentInput, type Due, type InstallmentChange, type Plan } from './api'

export function PlanDetail({ plan, dues, date, busy, pending, paymentError, archiveError, save, edit }: {
  plan: Plan
  dues: Due[]
  date: Intl.DateTimeFormat
  busy: boolean
  pending?: InstallmentChange['kind']
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
  const remaining = plan.total_minor - paid
  const nextDue = dues.find(due => due.paid_minor < due.amount_minor)
  const selectedDue = dues.find(due => due.id === selected)
  const [showPaymentError, setShowPaymentError] = useState(false)
  const message = invalid ? 'installmentInvalidPayment' : showPaymentError ? paymentError : undefined
  const state = (due: Due) => due.paid_minor === due.amount_minor ? 'installmentPaid'
    : due.due_on < today ? 'installmentOverdue' : 'installmentUpcoming'
  const visible = dues.filter(due => filter === 'all' || filter === state(due))
  useEffect(() => { heading.current?.focus() }, [])

  function openPayment(due: Due) {
    setInvalid(false)
    setShowPaymentError(false)
    setSelected(due.id)
  }

  async function submit(event: FormEvent<HTMLFormElement>, due: Due) {
    event.preventDefault()
    const result = paymentInput.safeParse(Object.fromEntries(new FormData(event.currentTarget)))
    if (!result.success || result.data.amount > due.amount_minor - due.paid_minor) {
      setInvalid(true)
      return
    }
    setInvalid(false)
    setShowPaymentError(true)
    if (await save({ kind: 'pay', plan, due, input: result.data })) setSelected(undefined)
  }

  return <section className="panel debt-detail installment-detail">
    <div className="debt-detail-heading">
      <div className="debt-person">
        <span className="debt-avatar" aria-hidden="true"><CalendarDays size={19} /></span>
        <h2 ref={heading} tabIndex={-1}><bdi>{plan.name}</bdi></h2>
      </div>
      <Link className="secondary debt-back" to="/installments">
        <ArrowLeft size={16} aria-hidden="true" />{t('installmentBack')}
      </Link>
    </div>
    <div className="debt-balance-summary installment-balance">
      <div className="row">
        <span className="debt-remaining-label">{t('remaining')}</span>
        {plan.archived_at && <span className="status">{t('installmentArchived')}</span>}
      </div>
      <strong className="debt-remaining"><Amount value={remaining / 100} /></strong>
      <div className="debt-progress" aria-hidden="true"><span style={{ inlineSize: (paid / plan.total_minor) * 100 + '%' }} /></div>
    </div>
    <dl className="debt-detail-totals">
      {([
        ['installmentTotal', plan.total_minor], ['installmentPaid', paid], ['remaining', plan.total_minor - paid],
      ] as const).map(([label, amount]) => <div key={label}><dt>{t(label)}</dt><dd><Amount value={amount / 100} /></dd></div>)}
    </dl>
    {!plan.archived_at && nextDue && <div className="installment-next">
      <div>
        <strong>{t(nextDue.due_on < today ? 'installmentOverdue' : 'installmentNextPayment')}</strong>
        <div className="installment-next-meta">
          <time dateTime={nextDue.due_on}>{date.format(new Date(nextDue.due_on))}</time>
          <strong><Amount value={(nextDue.amount_minor - nextDue.paid_minor) / 100} /></strong>
        </div>
      </div>
      <button type="button" className="primary" disabled={busy} onClick={() => openPayment(nextDue)}>
        <Plus size={17} aria-hidden="true" />{t('debtPay')}
      </button>
    </div>}
    <label className="installment-filter">{t('installmentFilter')} <Select value={filter} onChange={event => setFilter(event.target.value)}>
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
          {!plan.archived_at && remaining > 0 && due.id !== nextDue?.id &&
            <button type="button" className="secondary" disabled={busy} onClick={() => openPayment(due)}>{t('debtPay')}</button>}
        </li>
      })}
    </ul> : <p className="empty-state">{t('installmentNoDues')}</p>}
    {!plan.archived_at && <div className="debt-actions">
      <button type="button" className="secondary" disabled={busy} onClick={edit}>{t('installmentEdit')}</button>
      <button type="button" className="secondary" disabled={busy} onClick={() => dialog.current?.showModal()}>{t('installmentArchive')}</button>
    </div>}
    {!plan.archived_at && selectedDue && <LedgerEditor titleId="installment-payment-title" busy={busy} onClose={() => setSelected(undefined)}>
      <section className="panel debt-payment-editor">
        <h2 id="installment-payment-title">{t('debtPay')}</h2>
        <p><time dateTime={selectedDue.due_on}>{date.format(new Date(selectedDue.due_on))}</time>
          {' · '}{t('remaining')} <Amount value={(selectedDue.amount_minor - selectedDue.paid_minor) / 100} /></p>
        <form onSubmit={event => void submit(event, selectedDue)} noValidate onChange={() => {
          setInvalid(false)
          setShowPaymentError(false)
        }}>
          <fieldset className="debt-form" disabled={busy} aria-labelledby="installment-payment-title">
            <div className="debt-pair">
              <label>{t('debtPaymentAmount')}<input name="amount" inputMode="decimal" dir="ltr" required /></label>
              <label>{t('debtPaidOn')}<input name="paidOn" type="date" dir="ltr" min="0001-01-01" max="9999-12-31" defaultValue={today} required /></label>
            </div>
            {message && <Toast message={t(message)} />}
            <div className="debt-actions">
              <button className="primary" type="submit" aria-busy={pending === 'pay'}>{t('debtPay')}</button>
            </div>
          </fieldset>
        </form>
      </section>
    </LedgerEditor>}
    <Modal ref={dialog} busy={busy} className="panel debt-dialog" aria-labelledby="archive-installment-title">
      <h2 id="archive-installment-title">{t('installmentArchive')}</h2>
      <p><bdi>{plan.name}</bdi></p>
      <p>{t('installmentArchivePrompt')}</p>
      {archiveError && <Toast message={t(archiveError)} />}
      <div className="debt-actions">
        <button type="button" className="secondary" disabled={busy} onClick={() => dialog.current?.close()}>{t('cancelPurchase')}</button>
        <button type="button" className="primary" disabled={busy} aria-busy={pending === 'archive'} onClick={async () => {
          if (await save({ kind: 'archive', plan })) dialog.current?.close()
        }}>{t('debtArchiveConfirm')}</button>
      </div>
    </Modal>
  </section>
}
