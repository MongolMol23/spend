import { useEffect, useRef } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { ArrowLeft, HandCoins } from 'lucide-react'
import { Link } from 'react-router'
import { readHistory } from '../../data/readHistory'
import { cairoDayStart } from '../../data/calendar'
import type { Json } from '../../data/database.types'
import type { Label } from '../../i18n/locales'
import { HistoryDisclosure, HistoryEntry } from '../../ui/HistoryEntry'
import { HistoryDates, useHistoryDates } from '../../ui/HistoryDates'
import { changedHistoryFields, HistoryChanges, type HistoryField } from '../../ui/HistoryChanges'
import { isSharedDebt, listRequestHistory, requestAuthor, requestHistoryPageSize, requestTarget,
  type Client, type MoneyRequest, type Person, type RequestCorrection, type RequestPayment, type RunAction } from './api'
import { PaymentSection } from './PaymentSection'

export const requestStateLabel = (state: string) => (state === 'settled' ? 'requestSettled' : state === 'accepted' ? 'requestAccepted' : state === 'declined'
    ? 'requestDeclined' : state === 'cancelled' ? 'requestCancelled' : 'pending')

export function RequestDetail({ client, userId, names, selected, activeId, payments, corrections, busy, pending, run, backTo, backLabel }: {
  client: Client; userId: string; names: Map<string, Person>; selected?: MoneyRequest; activeId: string;
  payments: RequestPayment[]; corrections: RequestCorrection[]; busy: boolean; pending?: string; run: RunAction;
  backTo: string; backLabel: Label
}) {
  const { t, i18n } = useTranslation()
  const detailHeading = useRef<HTMLHeadingElement>(null)
  const money = new Intl.NumberFormat(i18n.language === 'ar' ? 'ar-EG' : 'en-EG', { style: 'currency', currency: 'EGP' })
  const date = new Intl.DateTimeFormat(i18n.language === 'ar' ? 'ar-EG' : 'en-EG', { dateStyle: 'medium', timeZone: 'UTC' })
  const eventTime = new Intl.DateTimeFormat(i18n.language === 'ar' ? 'ar-EG' : 'en-EG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo' })
  const historyDates = useHistoryDates()
  const { from, until } = historyDates
  const history = useQuery({
    queryKey: ['request-history', userId, activeId, from, until],
    enabled: !!selected,
    queryFn: ({ signal }) => readHistory(requestHistoryPageSize, page => listRequestHistory(client, activeId, page, cairoDayStart(from), cairoDayStart(until), signal)),
    refetchInterval: 3000,
    refetchIntervalInBackground: true,
  })
  // A request may be opened from a list farther down the page, especially on mobile.
  useEffect(() => {
    if (activeId) detailHeading.current?.focus()
  }, [activeId])

  const eventLabel = (event: string) => t(event === 'sent' ? 'requestSent'
    : event === 'payment_recorded' ? 'paymentRecorded' : event === 'payment_confirmed' ? 'paymentConfirmed'
    : event === 'payment_declined' ? 'paymentDeclined' : event === 'correction_proposed' ? 'correctionProposed'
    : event === 'correction_approved' ? 'correctionApproved' : event === 'correction_declined' ? 'correctionDeclined'
    : event === 'reopened' ? 'requestReopened' : event === 'settled' ? 'requestSettled'
    : event === 'accepted' ? 'requestAccepted' : event === 'declined' ? 'requestDeclined' : 'requestCancelled')

  function correctionFields(value: Json | undefined): HistoryField[] {
    if (!value || typeof value !== 'object' || Array.isArray(value)) return []
    const fields: HistoryField[] = []
    if (typeof value.amount === 'number') fields.push({
      label: t('requestAmount'), raw: value.amount, display: <bdi>{money.format(value.amount / 100)}</bdi>,
    })
    if (typeof value.reason === 'string') fields.push({
      label: t('reason'), raw: value.reason, display: <bdi>{value.reason}</bdi>,
    })
    if (typeof value.state === 'string') fields.push({
      label: t('historyStatus'), raw: value.state, display: t(value.state === 'cancelled' ? 'requestCancelled' : 'paymentConfirmed'),
    })
    return fields
  }

  return <section className="panel request-card">
      <div className="request-detail-heading">
        <h2 ref={detailHeading} tabIndex={-1} className="section-heading">
          <span className="icon-tile" aria-hidden="true"><HandCoins size={18} /></span>{t('request')}
        </h2>
        <Link className="secondary request-back" to={backTo}>
          <ArrowLeft size={17} aria-hidden="true" />{t(backLabel)}
        </Link>
      </div>
      {!selected ? <p>{t('requestUnavailable')}</p> : <>
        <div className="request-detail-summary">
          <span className="status" data-state={selected.state}>{t(requestStateLabel(selected.state))}</span>
          <strong className="request-amount"><bdi>{money.format(selected.amount_minor / 100)}</bdi></strong>
          <p className="reason"><bdi>{selected.reason}</bdi></p>
          {selected.is_offer && <span>{t(selected.sender === userId ? 'owed' : 'owe')}</span>}
        </div>
        <dl className="request-participants">
          {([
            ['requestFrom', requestAuthor(selected)],
            ['requestTo', requestTarget(selected)],
          ] as const).map(([label, id]) => <div key={label}>
            <dt>{t(label)}</dt>
            <dd><bdi>{names.get(id)?.display_name}</bdi></dd>
          </div>)}
        </dl>
        {selected.due_date && <p>{t('due')} <time dateTime={selected.due_date}>{date.format(new Date(selected.due_date))}</time></p>}
        {selected.state === 'pending' && <div className="connection-actions request-detail-actions">
          {(requestTarget(selected) === userId ? ['accepted', 'declined'] : ['cancelled']).map(decision =>
            <button type="button" className="secondary" data-decision={decision} disabled={busy} key={decision}
              aria-busy={pending === 'request:' + selected.id + ':' + decision}
              onClick={() => void run('request:' + selected.id + ':' + decision, () =>
              client.rpc('respond_money_request', { request_id: selected.id, decision }))}>
              {t(decision === 'accepted' ? 'acceptRequest' : decision === 'declined' ? 'declineRequest' : 'cancelRequest')}
            </button>)}
        </div>}
        {isSharedDebt(selected) && <PaymentSection key={selected.id}
          client={client} userId={userId} request={selected}
          payments={payments.filter(payment => payment.request_id === selected.id)}
          corrections={corrections.filter(correction => correction.request_id === selected.id)} busy={busy} pending={pending} run={run} />}
        <HistoryDisclosure title={t('activity')} filters={<HistoryDates {...historyDates} />}>
        {history.isPending && <p className="loading-state" role="status">{t('loading')}</p>}
        {history.isError && <button type="button" className="secondary" disabled={history.isFetching} aria-busy={history.isFetching} onClick={() => void history.refetch()}>{t('retry')}</button>}
        {history.data?.length === 0 && <p className="empty-state">{t('historyNoEntries')}</p>}
        {!!history.data?.length && <ol className="history-list" role="list">
          {history.data.map(event => {
            const details = event.details && typeof event.details === 'object' && !Array.isArray(event.details) ? event.details : {}
            const before = correctionFields(details.before)
            const changes = changedHistoryFields(correctionFields(details.after), before)
            const hasDetails = typeof details.explanation === 'string' || typeof details.reason === 'string' || changes.length > 0
            return <HistoryEntry key={event.id} timestamp={event.created_at} date={eventTime}
              detailLabel={t(changes.length ? 'historyChanges' : 'historyDetails')}
              title={<><bdi>{names.get(event.actor)?.display_name}</bdi> · {eventLabel(event.event)}</>}
              amount={typeof details.amount === 'number' && <bdi>{money.format(details.amount / 100)}</bdi>}>
              {hasDetails ? <>
              {typeof details.explanation === 'string' && <p><bdi>{details.explanation}</bdi></p>}
              {typeof details.reason === 'string' && <p><bdi>{details.reason}</bdi></p>}
              <HistoryChanges changes={changes} />
              </> : null}
            </HistoryEntry>
          })}
        </ol>}
        </HistoryDisclosure>
      </>}
    </section>
}
