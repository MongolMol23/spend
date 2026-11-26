import { Modal } from '../../ui/Modal'
import { readHistory } from '../../data/readHistory'
import { Toast } from '../../ui/Toast'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { ArrowLeft, Pencil, Archive, Plus } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { HistoryDisclosure, HistoryEntry } from '../../ui/HistoryEntry'
import { ledgerToday } from '../../data/calendar'
import type { Label } from '../../i18n/locales'
import { Amount } from '../../ui/Amount'
import { LedgerEditor } from '../../ui/LedgerEditor'
import { debtKey, debtPageSize, listDebtPayments, paymentInput, type DebtChange, type DebtClient, type PrivateDebt } from './api'

export function DebtDetail({ client, debt, date, backTo, busy, pending, payError, archiveError, save, edit }: {
  client: DebtClient
  debt: PrivateDebt
  date: Intl.DateTimeFormat
  backTo: string
  busy: boolean
  pending?: DebtChange['kind']
  payError?: Label
  archiveError?: Label
  save: (change: DebtChange) => Promise<boolean>
  edit: () => void
}) {
  const { t } = useTranslation()
  const [invalid, setInvalid] = useState(false)
  const [paying, setPaying] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const remaining = debt.amount_minor - debt.paid_minor
  const paymentError = invalid ? 'debtInvalidPayment' : payError
  const payments = useQuery({
    queryKey: [...debtKey, 'payments', debt.id],
    queryFn: ({ signal }) => readHistory(debtPageSize, page => listDebtPayments(client, debt.id, page, signal)),
  })
  useEffect(() => { heading.current?.focus() }, [])

  async function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const result = paymentInput.safeParse(Object.fromEntries(new FormData(form)))
    if (!result.success || result.data.amount > remaining) {
      setInvalid(true)
      const field = !result.success && result.error.issues[0]?.path[0] === 'paidOn' ? 'paidOn' : 'amount'
      form.querySelector<HTMLInputElement>(`[name="${field}"]`)?.focus()
      return
    }
    setInvalid(false)
    if (await save({ kind: 'pay', debt, input: result.data })) {
      setPaying(false)
    }
  }

  return <section className="panel debt-detail">
    <div className="debt-detail-heading">
      <div className="debt-person">
        <span className="debt-avatar" aria-hidden="true">{Array.from(debt.contact)[0]?.toLocaleUpperCase()}</span>
        <h2 ref={heading} tabIndex={-1}><bdi>{debt.contact}</bdi></h2>
      </div>
      <Link className="secondary debt-back" to={backTo}><ArrowLeft size={16} aria-hidden="true" />{t('debtBack')}</Link>
    </div>
    <div className="debt-balance-summary" data-direction={debt.direction}>
      <div className="row">
        <strong>{t(debt.direction)}</strong>
        <span className="status" data-state={remaining ? undefined : 'settled'}>{t(remaining ? 'debtOpen' : 'debtSettled')}</span>
      </div>
      <span className="debt-remaining-label">{t('remaining')}</span>
      <strong className="debt-remaining"><Amount value={remaining / 100} /></strong>
      {debt.due_on && <span className="debt-due">{t('due')} <time dateTime={debt.due_on}>{date.format(new Date(debt.due_on))}</time></span>}
      <div className="debt-progress" aria-hidden="true"><span style={{ inlineSize: (debt.paid_minor / debt.amount_minor) * 100 + '%' }} /></div>
    </div>
    <dl className="debt-detail-totals">
      {([
        ['debtTotal', debt.amount_minor], ['paid', debt.paid_minor],
      ] as const).map(([label, amount]) => <div key={label}><dt>{t(label)}</dt><dd><Amount value={amount / 100} /></dd></div>)}
    </dl>
    <div className="debt-detail-tools">
      {remaining > 0 && <button type="button" className="primary" disabled={busy}
        onClick={() => { setInvalid(false); setPaying(true) }}><Plus size={17} aria-hidden="true" />{t('debtPay')}</button>}
      <button type="button" className="secondary" disabled={busy} onClick={edit}><Pencil size={16} aria-hidden="true" />{t('editDebt')}</button>
      <button type="button" className="secondary debt-archive-action" disabled={busy} aria-label={t('archiveDebt')} title={t('archiveDebt')}
        onClick={() => dialog.current?.showModal()}><Archive size={18} aria-hidden="true" /></button>
    </div>
    {paying && <LedgerEditor titleId="debt-payment-title" busy={busy} onClose={() => setPaying(false)}>
      <section className="panel debt-payment-editor">
      <h2 id="debt-payment-title">{t('debtPay')}</h2>
      <p><bdi>{debt.contact}</bdi> · {t('remaining')} <Amount value={remaining / 100} /></p>
      <form onSubmit={submitPayment} noValidate onChange={() => setInvalid(false)}>
      <fieldset className="debt-form" disabled={busy} aria-label={t('debtPay')}>
        <div className="debt-pair">
          <label>{t('debtPaymentAmount')}<input name="amount" inputMode="decimal" dir="ltr" required /></label>
          <DateField label={t('debtPaidOn')} name="paidOn" defaultValue={ledgerToday()} onChange={() => setInvalid(false)} />
        </div>
        {paymentError && <Toast message={t(paymentError)} />}
        <div><button type="submit" className="primary" aria-busy={pending === 'pay'}>{t('debtPay')}</button></div>
      </fieldset>
      </form>
      </section>
    </LedgerEditor>}
    <HistoryDisclosure className="record-history" title={t('debtPayments')}>
      {payments.isPending && <p className="loading-state" role="status">{t('loading')}</p>}
      {payments.isError && <><Toast message={t('failed')} />
        <button type="button" className="secondary" disabled={payments.isFetching} aria-busy={payments.isFetching} onClick={() => void payments.refetch()}>{t('retry')}</button></>}
      {payments.data && (payments.data.length ? <ol className="history-list debt-payments" role="list">
        {payments.data.map(payment => <HistoryEntry key={payment.id}
          title={t('debtPaymentSaved')} timestamp={payment.paid_on} date={date}
          amount={<Amount value={payment.amount_minor / 100} />} />)}
      </ol> : <p className="empty-state">{t('noDebtPayments')}</p>)}
    </HistoryDisclosure>
    <Modal ref={dialog} busy={busy} className="panel debt-dialog" aria-labelledby="archive-debt-title">
      <h2 id="archive-debt-title">{t('archiveDebt')}</h2>
      <p><bdi>{debt.contact}</bdi></p>
      <p>{t('debtArchivePrompt')}</p>
      {archiveError && <Toast message={t(archiveError)} />}
      <div className="debt-actions">
        <button type="button" className="secondary" disabled={busy} onClick={() => dialog.current?.close()}>{t('cancelPurchase')}</button>
        <button type="button" className="primary" disabled={busy} aria-busy={pending === 'archive'} onClick={async () => {
          if (await save({ kind: 'archive', debt })) dialog.current?.close()
        }}>{t('debtArchiveConfirm')}</button>
      </div>
    </Modal>
  </section>
}
import { DateField } from '../../ui/DateField'
