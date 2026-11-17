import { readHistory } from '../../data/readHistory'
import { Toast } from '../../ui/Toast'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { HistoryDisclosure, HistoryEntry } from '../../ui/HistoryEntry'
import { HistoryDates, useHistoryDates } from '../../ui/HistoryDates'
import { useQuery } from '@tanstack/react-query'
import { cairoDayStart } from '../../data/calendar'
import { Link, useSearchParams } from 'react-router'
import { ArrowDownLeft, ArrowUpRight, ArrowLeft, ChevronRight, HandCoins, Inbox, Send } from 'lucide-react'
import { ActiveLinkIndicator } from '../../ui/ActiveLinkIndicator'
import { LedgerEditor, LedgerHeading } from '../../ui/LedgerEditor'
import { z } from 'zod'
import type { Database } from '../../data/database.types'
import { listRequestHistory, requestHistoryPageSize, toMinorUnits, type Client, type MoneyRequest, type RunAction } from './api'
import { PaymentSection } from './PaymentSection'
import { Select } from '../../ui/Select'

const requestInput = z.object({
  friend: z.uuid(),
  amount: z.string().transform(toMinorUnits).pipe(z.number()),
  reason: z.string().refine(value => value.trim().length > 0 && [...value].length <= 500),
  deadline: z.union([z.iso.date(), z.literal('')]),
})

type Person = Database['public']['Functions']['connection_names']['Returns'][number]
type Payment = Database['public']['Tables']['request_payments']['Row']
type Correction = Database['public']['Tables']['request_corrections']['Row']

export function RequestPanel({ client, userId, friends, names, requests, payments, corrections, activeId, busy, pending, run }: {
  client: Client; userId: string; friends: Person[]; names: Map<string, Person>; requests: MoneyRequest[];
  payments: Payment[]; corrections: Correction[]; activeId: string | null; busy: boolean; pending?: string; run: RunAction
}) {
  const { t, i18n } = useTranslation()
  const [params, setParams] = useSearchParams()
  const [invalid, setInvalid] = useState(false)
  const [composing, setComposing] = useState(false)
  const detailHeading = useRef<HTMLHeadingElement>(null)
  const money = new Intl.NumberFormat(i18n.language === 'ar' ? 'ar-EG' : 'en-EG', { style: 'currency', currency: 'EGP' })
  const date = new Intl.DateTimeFormat(i18n.language === 'ar' ? 'ar-EG' : 'en-EG', { dateStyle: 'medium', timeZone: 'UTC' })
  const eventTime = new Intl.DateTimeFormat(i18n.language === 'ar' ? 'ar-EG' : 'en-EG', { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo' })
  const selected = requests.find(request => request.id === activeId)
  const historyDates = useHistoryDates()
  const { from, until } = historyDates
  const history = useQuery({
    queryKey: ['request-history', userId, activeId, from, until],
    enabled: !!selected,
    queryFn: ({ signal }) => readHistory(requestHistoryPageSize, page => listRequestHistory(client, activeId ?? '', page, cairoDayStart(from), cairoDayStart(until), signal)),
    refetchInterval: 3000,
    refetchIntervalInBackground: true,
  })
  // A request may be opened from a list farther down the page, especially on mobile.
  useEffect(() => {
    if (activeId) detailHeading.current?.focus()
  }, [activeId])
  const groups = [
    { label: 'received', icon: Inbox, accent: 'lavender', entries: requests.filter(request => request.recipient === userId && !['accepted', 'settled'].includes(request.state)) },
    { label: 'sentRequests', icon: Send, accent: 'amber', entries: requests.filter(request => request.sender === userId && !['accepted', 'settled'].includes(request.state)) },
    { label: 'owed', icon: ArrowDownLeft, accent: 'mint', entries: requests.filter(request => request.sender === userId && ['accepted', 'settled'].includes(request.state)) },
    { label: 'owe', icon: ArrowUpRight, accent: 'peach', entries: requests.filter(request => request.recipient === userId && ['accepted', 'settled'].includes(request.state)) },
  ] as const
  const group = groups.find(item => item.label === params.get('group'))
    ?? groups.find(item => item.entries.length > 0) ?? groups[0]
  const listUrl = '/connections?group=' + group.label

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const result = requestInput.safeParse(Object.fromEntries(new FormData(form)))
    setInvalid(!result.success)
    if (!result.success) return
    const input = result.data
    void run('send-request', () => client.rpc('send_money_request', {
      target_id: input.friend,
      minor_units: input.amount,
      request_reason: input.reason,
      ...(input.deadline ? { deadline: input.deadline } : {}),
    }), () => {
      setComposing(false)
      setParams({ group: 'sentRequests' })
    })
  }

  const stateLabel = (state: string) => t(state === 'settled' ? 'requestSettled' : state === 'accepted' ? 'requestAccepted' : state === 'declined'
    ? 'requestDeclined' : state === 'cancelled' ? 'requestCancelled' : 'pending')
  const eventLabel = (event: string) => t(event === 'sent' ? 'requestSent'
    : event === 'payment_recorded' ? 'paymentRecorded' : event === 'payment_confirmed' ? 'paymentConfirmed'
    : event === 'payment_declined' ? 'paymentDeclined' : event === 'correction_proposed' ? 'correctionProposed'
    : event === 'correction_approved' ? 'correctionApproved' : event === 'correction_declined' ? 'correctionDeclined'
    : event === 'reopened' ? 'requestReopened' : event === 'settled' ? 'requestSettled'
    : event === 'accepted' ? 'requestAccepted' : event === 'declined' ? 'requestDeclined' : 'requestCancelled')

  return <div className="connection-stack">
    {composing && <LedgerEditor titleId="request-compose-title" busy={busy} onClose={() => setComposing(false)}>
      <section className="panel request-compose">
        <h2 id="request-compose-title" className="section-heading"><span className="icon-tile" aria-hidden="true"><HandCoins size={18} /></span>{t('newRequest')}</h2>
        <form className="connection-form" onSubmit={submit} noValidate>
          <div className="connection-field"><label htmlFor="request-friend">{t('friend')}</label>
            <Select id="request-friend" name="friend" required defaultValue="">
            <option value="" disabled>{t('chooseFriend')}</option>
            {friends.map(person => <option key={person.id} value={person.id}>{person.display_name}</option>)}
          </Select></div>
          <label>{t('requestAmount')}<input name="amount" inputMode="decimal" dir="ltr" required /></label>
          <label>{t('reason')}<textarea name="reason" dir="auto" maxLength={500} required /></label>
          <label>{t('optionalDueDate')}<input name="deadline" type="date" dir="ltr" /></label>
          {invalid && <Toast message={t('invalidRequest')} />}
          <button className="primary request-send" disabled={busy} aria-busy={pending === 'send-request'}>{t('sendRequest')}</button>
        </form>
      </section>
    </LedgerEditor>}
    {activeId && <section className="panel request-card">
      <div className="request-detail-heading">
        <h2 ref={detailHeading} tabIndex={-1} className="section-heading">
          <span className="icon-tile" aria-hidden="true"><HandCoins size={18} /></span>{t('request')}
        </h2>
        <Link className="secondary request-back" to={listUrl}>
          <ArrowLeft size={17} aria-hidden="true" />{t('backToRequests')}
        </Link>
      </div>
      {!selected ? <p>{t('requestUnavailable')}</p> : <>
        <div className="request-detail-summary">
          <span className="status" data-state={selected.state}>{stateLabel(selected.state)}</span>
          <strong className="request-amount"><bdi>{money.format(selected.amount_minor / 100)}</bdi></strong>
          <p className="reason"><bdi>{selected.reason}</bdi></p>
        </div>
        <dl className="request-participants">
          {([
            ['requestFrom', selected.sender],
            ['requestTo', selected.recipient],
          ] as const).map(([label, id]) => <div key={label}>
            <dt>{t(label)}</dt>
            <dd><bdi>{names.get(id)?.display_name}</bdi></dd>
          </div>)}
        </dl>
        {selected.due_date && <p>{t('due')} <time dateTime={selected.due_date}>{date.format(new Date(selected.due_date))}</time></p>}
        {selected.state === 'pending' && <div className="connection-actions request-detail-actions">
          {(selected.recipient === userId ? ['accepted', 'declined'] : ['cancelled']).map(decision =>
            <button type="button" className="secondary" data-decision={decision} disabled={busy} key={decision}
              aria-busy={pending === 'request:' + selected.id + ':' + decision}
              onClick={() => void run('request:' + selected.id + ':' + decision, () =>
              client.rpc('respond_money_request', { request_id: selected.id, decision }))}>
              {t(decision === 'accepted' ? 'acceptRequest' : decision === 'declined' ? 'declineRequest' : 'cancelRequest')}
            </button>)}
        </div>}
        {['accepted', 'settled'].includes(selected.state) && <PaymentSection key={selected.id}
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
            const hasDetails = typeof details.explanation === 'string' || typeof details.reason === 'string' || details.before || details.after
            return <HistoryEntry key={event.id} timestamp={event.created_at} date={eventTime} collapsible={false}
              title={<><bdi>{names.get(event.actor)?.display_name}</bdi> · {eventLabel(event.event)}</>}
              amount={typeof details.amount === 'number' && <bdi>{money.format(details.amount / 100)}</bdi>}>
              {hasDetails ? <>
              {typeof details.explanation === 'string' && <p><bdi>{details.explanation}</bdi></p>}
              {typeof details.reason === 'string' && <p><bdi>{details.reason}</bdi></p>}
              {(['before', 'after'] as const).map(key => {
                const value = details[key]
                if (!value || typeof value !== 'object' || Array.isArray(value)) return null
                return <p key={key}>{t(key === 'before' ? 'beforeCorrection' : 'afterCorrection')}{' '}
                  {typeof value.amount === 'number' && <bdi>{money.format(value.amount / 100)}</bdi>}
                  {typeof value.reason === 'string' && <bdi>{value.reason}</bdi>}
                  {typeof value.state === 'string' && <span> · {t(value.state === 'cancelled' ? 'requestCancelled' : 'paymentConfirmed')}</span>}
                </p>
              })}
              </> : null}
            </HistoryEntry>
          })}
        </ol>}
        </HistoryDisclosure>
      </>}
    </section>}
    {!activeId && <section className="panel request-groups">
      <LedgerHeading title={t('moneyRequestList')} action={t('newRequest')} busy={busy || friends.length === 0}
        onAdd={() => { setInvalid(false); setComposing(true) }} />
      {friends.length === 0 && <p className="request-hint muted">{t('friendRequired')}{' '}
        <Link to="/connections?view=add">{t('addFriend')}</Link>
      </p>}
      <nav className="request-filters" aria-label={t('moneyRequestList')}>
        <ActiveLinkIndicator selection={group.label} />
        {groups.map(({ label, entries }) => <Link key={label} to={'?group=' + label}
          aria-current={group.label === label ? 'page' : undefined}>
          <span>{t(label)}</span><bdi>{entries.length.toLocaleString(i18n.language === 'ar' ? 'ar-EG' : 'en-EG')}</bdi>
        </Link>)}
      </nav>
      <div className="request-board">
      {[group].map(({ label, accent, entries }) => <div className="request-group" data-accent={accent} key={label}>
        <h3 className="request-list-heading">{t(label)}</h3>
        {entries.length === 0 && <p className="connections-empty">{t('noRequestsInGroup')}</p>}
        {entries.length > 0 && <ul className="ledger">
          {entries.map(request => <li key={request.id}>
            <Link to={'?group=' + label + '&request=' + request.id} className="request-list-link">
              <span className="request-list-info">
                <strong><bdi>{request.reason}</bdi></strong>
                <span className="muted request-counterpart"><bdi>{names.get(request.sender === userId ? request.recipient : request.sender)?.display_name}</bdi></span>
                <span className="status" data-state={request.state}>{stateLabel(request.state)}</span>
              </span>
              <span className="request-list-end"><bdi className="request-list-amount">{money.format((request.amount_minor - payments
                .filter(payment => payment.request_id === request.id && payment.state === 'confirmed')
                .reduce((sum, payment) => sum + payment.amount_minor, 0)) / 100)}</bdi>
                <ChevronRight size={18} aria-hidden="true" />
              </span>
            </Link>
          </li>)}
        </ul>}
      </div>)}
      </div>
    </section>}
  </div>
}

