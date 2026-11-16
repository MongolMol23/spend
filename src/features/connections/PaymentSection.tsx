import { Toast } from '../../ui/Toast'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { ChevronDown } from 'lucide-react'
import type { Database } from '../../data/database.types'
import { Select } from '../../ui/Select'
import { retryKey, clearRetryKey } from '../../data/retryKey'
import { toMinorUnits, type Client, type MoneyRequest, type RunAction } from './api'

type Payment = Database['public']['Tables']['request_payments']['Row']
type Correction = Database['public']['Tables']['request_corrections']['Row']
type CorrectionKind = 'request_amount' | 'request_reason' | 'payment_amount' | 'payment_cancel'

export function PaymentSection({ client, userId, request, payments, corrections, busy, run }: {
  client: Client; userId: string; request: MoneyRequest; payments: Payment[]; corrections: Correction[];
  busy: boolean; run: RunAction
}) {
  const { t, i18n } = useTranslation()
  const [paymentError, setPaymentError] = useState(false)
  const [correctionError, setCorrectionError] = useState(false)
  const [kind, setKind] = useState<CorrectionKind>('request_amount')
  const money = new Intl.NumberFormat(i18n.language === 'ar' ? 'ar-EG' : 'en-EG', { style: 'currency', currency: request.currency })
  const confirmed = payments.filter(payment => payment.state === 'confirmed').reduce((sum, payment) => sum + payment.amount_minor, 0)
  const reserved = payments.filter(payment => payment.state === 'pending').reduce((sum, payment) => sum + payment.amount_minor, 0)
  const remaining = request.amount_minor - confirmed
  const available = remaining - reserved
  const canCorrect = request.state === 'accepted' || request.state === 'settled'
  const confirmedPayments = payments.filter(payment => payment.state === 'confirmed')
  const paymentScope = userId + ':' + request.id + ':payment'
  const correctionScope = userId + ':' + request.id + ':correction'

  function submitPayment(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const amount = toMinorUnits(String(new FormData(form).get('payment_amount') ?? ''))
    setPaymentError(amount === null || amount > available)
    if (amount === null || amount > available) return
    void run(async () => {
      const key = await retryKey(paymentScope, amount)
      return client.rpc('record_request_payment', { p_request: request.id, p_amount: amount, p_key: key })
    }, () => { clearRetryKey(paymentScope); form.reset() })
  }

  function submitCorrection(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const values = new FormData(form)
    const explanation = String(values.get('explanation') ?? '')
    const rawReason = String(values.get('new_reason') ?? '')
    const amount = toMinorUnits(String(values.get('correction_amount') ?? ''))
    const payment = String(values.get('payment_id') ?? '')
    const invalid = !explanation.trim() || [...explanation].length > 500 ||
      ((kind === 'request_amount' || kind === 'payment_amount') && amount === null) ||
      (kind === 'request_reason' && (!rawReason.trim() || [...rawReason].length > 500)) ||
      ((kind === 'payment_amount' || kind === 'payment_cancel') && !confirmedPayments.some(item => item.id === payment))
    setCorrectionError(invalid)
    if (invalid) return
    const payload = {
      kind, explanation,
      ...(kind.startsWith('payment_') ? { payment } : {}),
      ...((kind === 'request_amount' || kind === 'payment_amount') ? { amount: amount! } : {}),
      ...(kind === 'request_reason' ? { reason: rawReason } : {}),
    }
    void run(async () => {
      const key = await retryKey(correctionScope, payload)
      return client.rpc('propose_request_correction', {
        p_request: request.id, p_kind: kind, p_explanation: explanation, p_key: key,
        ...('payment' in payload ? { p_payment: payload.payment } : {}),
        ...('amount' in payload ? { p_amount: payload.amount } : {}),
        ...('reason' in payload ? { p_reason: payload.reason } : {}),
      })
    }, () => { clearRetryKey(correctionScope); form.reset(); setKind('request_amount') })
  }

  const label = (state: string) => t(state === 'confirmed' ? 'paymentConfirmed'
    : state === 'declined' ? 'paymentDeclined' : state === 'cancelled' ? 'requestCancelled' : 'paymentPending')

  return <div className="payment-section">
    <dl className="payment-totals">
      <div><dt>{t('paid')}</dt><dd><bdi>{money.format(confirmed / 100)}</bdi></dd></div>
      <div><dt>{t('remaining')}</dt><dd><bdi>{money.format(remaining / 100)}</bdi></dd></div>
      <div><dt>{t('pendingPayments')}</dt><dd><bdi>{money.format(reserved / 100)}</bdi></dd></div>
    </dl>
    <h3>{t('payments')}</h3>
    {payments.length === 0 ? <p className="empty-state">{t('noPayments')}</p> : <ul className="ledger">
      {payments.map(payment => <li key={payment.id}>
        <div className="row"><strong><bdi>{money.format(payment.amount_minor / 100)}</bdi></strong><span className="status" data-state={payment.state}>{label(payment.state)}</span></div>
        {payment.state === 'pending' && request.sender === userId && <div className="connection-actions">
          {(['confirmed','declined'] as const).map(decision => <button type="button" className="secondary" disabled={busy} key={decision}
            onClick={() => void run(() => client.rpc('respond_request_payment', { p_payment: payment.id, p_decision: decision }))}>
            {t(decision === 'confirmed' ? 'confirmPayment' : 'declinePayment')}</button>)}
        </div>}
      </li>)}
    </ul>}
    {request.recipient === userId && request.state === 'accepted' && available > 0 && <form className="connection-form" onSubmit={submitPayment} noValidate>
      <label>{t('paymentAmount')}<input name="payment_amount" inputMode="decimal" dir="ltr" required /></label>
      <small>{t('paymentAvailable')} <bdi>{money.format(available / 100)}</bdi></small>
      {paymentError && <Toast message={t('invalidPayment')} />}
      <button className="primary" disabled={busy}>{t('recordPayment')}</button>
    </form>}
    {canCorrect && <details className="correction-form">
      <summary>{t('proposeCorrection')}<ChevronDown size={17} aria-hidden="true" /></summary>
      <form className="connection-form" onSubmit={submitCorrection} noValidate>
        <label>{t('correctionType')}<Select name="kind" value={kind} onChange={event => setKind(event.target.value as CorrectionKind)}>
          <option value="request_amount">{t('correctRequestAmount')}</option>
          <option value="request_reason">{t('correctRequestReason')}</option>
          <option value="payment_amount">{t('correctPaymentAmount')}</option>
          <option value="payment_cancel">{t('cancelConfirmedPayment')}</option>
        </Select></label>
        {kind.startsWith('payment_') && <label>{t('choosePayment')}<Select name="payment_id" defaultValue="">
          <option value="" disabled>{t('choosePayment')}</option>
          {confirmedPayments.map(payment => <option key={payment.id} value={payment.id}>{money.format(payment.amount_minor / 100)} · {new Date(payment.created_at).toLocaleDateString(i18n.language === 'ar' ? 'ar-EG' : 'en-EG')}</option>)}
        </Select></label>}
        {(kind === 'request_amount' || kind === 'payment_amount') && <label>{t('correctedAmount')}<input name="correction_amount" inputMode="decimal" dir="ltr" required /></label>}
        {kind === 'request_reason' && <label>{t('newReason')}<textarea name="new_reason" maxLength={500} dir="auto" required /></label>}
        <label>{t('correctionExplanation')}<textarea name="explanation" maxLength={500} dir="auto" required /></label>
        {correctionError && <Toast message={t('invalidCorrection')} />}
        <button className="primary" disabled={busy}>{t('sendCorrection')}</button>
      </form>
    </details>}
    {corrections.length > 0 && <section>
      <h3>{t('corrections')}</h3><ul className="ledger">
        {corrections.map(correction => <li key={correction.id}>
          <div className="row"><strong>{t(correction.kind === 'request_amount' ? 'correctRequestAmount'
            : correction.kind === 'request_reason' ? 'correctRequestReason'
              : correction.kind === 'payment_amount' ? 'correctPaymentAmount' : 'cancelConfirmedPayment')}</strong>
            <span className="status" data-state={correction.state}>{t(correction.state === 'approved' ? 'correctionApproved' : correction.state === 'declined' ? 'correctionDeclined' : 'correctionPending')}</span></div>
          {correction.amount_minor !== null && <p><bdi>{money.format(correction.amount_minor / 100)}</bdi></p>}
          {correction.new_reason && <p><bdi>{correction.new_reason}</bdi></p>}
          <p><bdi>{correction.explanation}</bdi></p>
          {correction.payment_id && <p className="muted">{t('originalPayment')} <bdi>{money.format((payments.find(payment => payment.id === correction.payment_id)?.amount_minor ?? 0) / 100)}</bdi></p>}
          {correction.state === 'pending' && correction.proposer !== userId && <div className="connection-actions">
            {(['approved','declined'] as const).map(decision => <button type="button" className="secondary" disabled={busy} key={decision}
              onClick={() => void run(() => client.rpc('respond_request_correction', { p_correction: correction.id, p_decision: decision }))}>
              {t(decision === 'approved' ? 'approveCorrection' : 'declineCorrection')}</button>)}
          </div>}
        </li>)}
      </ul>
    </section>}
  </div>
}

