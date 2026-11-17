import { Modal } from '../../ui/Modal'
import { readHistory } from '../../data/readHistory'
import { HistoryDates, useHistoryDates } from '../../ui/HistoryDates'
import { Toast } from '../../ui/Toast'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { HistoryDisclosure, HistoryEntry } from '../../ui/HistoryEntry'
import { ledgerToday } from '../../data/calendar'
import type { Label } from '../../i18n/locales'
import { Amount } from '../../ui/Amount'
import { debtKey, debtPageSize, listDebtPayments, paymentInput, type DebtChange, type DebtClient, type PrivateDebt } from './api'

export function DebtDetail({ client, debt, date, busy, pending, payError, archiveError, save, edit }: {
  client: DebtClient
  debt: PrivateDebt
  date: Intl.DateTimeFormat
  busy: boolean
  pending?: DebtChange['kind']
  payError?: Label
  archiveError?: Label
  save: (change: DebtChange) => Promise<boolean>
  edit: () => void
}) {
  const { t } = useTranslation()
  const historyDates = useHistoryDates()
  const { from, until } = historyDates
  const [invalid, setInvalid] = useState(false)
  const heading = useRef<HTMLHeadingElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const remaining = debt.amount_minor - debt.paid_minor
  const paymentError = invalid ? 'debtInvalidPayment' : payError
  const payments = useQuery({
    queryKey: [...debtKey, 'payments', debt.id, from, until],
    queryFn: ({ signal }) => readHistory(debtPageSize, page => listDebtPayments(client, debt.id, page, signal, from, until)),
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
      form.reset()
    }
  }

  return <section className="panel debt-detail">
    <h2 ref={heading} tabIndex={-1}>{t('debtDetails')} · <bdi>{debt.contact}</bdi></h2>
    <div className="row debt-row">
      <span>{t(debt.direction)}</span>
      <span className="status" data-state={remaining ? undefined : 'settled'}>{t(remaining ? 'debtOpen' : 'debtSettled')}</span>
    </div>
    {debt.due_on && <p>{t('due')} <time dateTime={debt.due_on}>{date.format(new Date(debt.due_on))}</time></p>}
    <dl className="debt-balances">
      {([
        ['debtTotal', debt.amount_minor], ['paid', debt.paid_minor], ['remaining', remaining],
      ] as const).map(([label, amount]) => <div key={label}><dt>{t(label)}</dt><dd><Amount value={amount / 100} /></dd></div>)}
    </dl>
    {remaining > 0 && <form onSubmit={submitPayment} noValidate onChange={() => setInvalid(false)}>
      <fieldset className="debt-form" disabled={busy} aria-label={t('debtPay')}>
        <div className="debt-pair">
          <label>{t('debtPaymentAmount')}<input name="amount" inputMode="decimal" dir="ltr" required /></label>
          <label>{t('debtPaidOn')}<input name="paidOn" type="date" dir="ltr" min="0001-01-01" max="9999-12-31" defaultValue={ledgerToday()} required /></label>
        </div>
        {paymentError && <Toast message={t(paymentError)} />}
        <div><button type="submit" className="primary" aria-busy={pending === 'pay'}>{t('debtPay')}</button></div>
      </fieldset>
    </form>}
    <HistoryDisclosure className="record-history" title={t('debtPayments')}
    filters={<HistoryDates {...historyDates} />}>
      {payments.isPending && <p className="loading-state" role="status">{t('loading')}</p>}
      {payments.isError && <><Toast message={t('failed')} />
        <button type="button" className="secondary" disabled={payments.isFetching} aria-busy={payments.isFetching} onClick={() => void payments.refetch()}>{t('retry')}</button></>}
      {payments.data && (payments.data.length ? <ol className="history-list debt-payments" role="list">
        {payments.data.map(payment => <HistoryEntry key={payment.id}
          title={t('debtPaymentSaved')} timestamp={payment.paid_on} date={date}
          amount={<Amount value={payment.amount_minor / 100} />} />)}
      </ol> : <p className="empty-state">{t('historyNoEntries')}</p>)}
    </HistoryDisclosure>
    <div className="debt-actions">
      <button type="button" className="secondary" disabled={busy} onClick={edit}>{t('editDebt')}</button>
      <button type="button" className="secondary" disabled={busy} onClick={() => dialog.current?.showModal()}>{t('archiveDebt')}</button>
    </div>
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
