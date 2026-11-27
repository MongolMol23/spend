import { Toast } from '../../ui/Toast'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { ChevronRight, HandCoins, Inbox, Send } from 'lucide-react'
import { ActiveLinkIndicator } from '../../ui/ActiveLinkIndicator'
import { LedgerEditor, LedgerHeading } from '../../ui/LedgerEditor'
import { z } from 'zod'
import { isSharedDebt, requestAuthor, requestTarget, toMinorUnits, type Client, type MoneyRequest, type Person,
  type RequestPayment, type RequestCorrection, type RunAction } from './api'
import { RequestDetail, requestStateLabel } from './RequestDetail'
import { Select } from '../../ui/Select'

const requestInput = z.object({
  friend: z.uuid(),
  amount: z.string().transform(toMinorUnits).pipe(z.number()),
  reason: z.string().refine(value => value.trim().length > 0 && [...value].length <= 500),
  deadline: z.union([z.iso.date(), z.literal('')]),
})

export function RequestPanel({ client, userId, friends, names, requests, payments, corrections, activeId, busy, pending, run }: {
  client: Client; userId: string; friends: Person[]; names: Map<string, Person>; requests: MoneyRequest[];
  payments: RequestPayment[]; corrections: RequestCorrection[]; activeId: string | null; busy: boolean; pending?: string; run: RunAction
}) {
  const { t, i18n } = useTranslation()
  const [params, setParams] = useSearchParams()
  const [invalid, setInvalid] = useState(false)
  const [composing, setComposing] = useState(false)
  const money = new Intl.NumberFormat(i18n.language === 'ar' ? 'ar-EG' : 'en-EG', { style: 'currency', currency: 'EGP' })
  const selected = requests.find(request => request.id === activeId)
  const groups = [
    { label: 'received', icon: Inbox, accent: 'lavender', entries: requests.filter(request => requestTarget(request) === userId && !isSharedDebt(request)) },
    { label: 'sentRequests', icon: Send, accent: 'amber', entries: requests.filter(request => requestAuthor(request) === userId && !isSharedDebt(request)) },
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
          <DateField label={t('optionalDueDate')} name="deadline" optional />
          {invalid && <Toast message={t('invalidRequest')} />}
          <button className="primary request-send" disabled={busy} aria-busy={pending === 'send-request'}>{t('sendRequest')}</button>
        </form>
      </section>
    </LedgerEditor>}
    {activeId && <RequestDetail client={client} userId={userId} names={names} selected={selected} activeId={activeId}
      payments={payments} corrections={corrections} busy={busy} pending={pending} run={run} backTo={listUrl} backLabel="backToRequests" />}
    {!activeId && <section className="panel request-groups">
      <LedgerHeading title={t('moneyRequestList')} action={t('newRequest')} busy={busy || friends.length === 0}
        onAdd={() => { setInvalid(false); setComposing(true) }} />
      {friends.length === 0 && <p className="request-hint muted">{t('friendRequired')}{' '}
        <Link to="/connections?view=add">{t('addFriend')}</Link>
      </p>}
      <div data-page-swipe-scope>
      <nav className="request-filters" data-page-swipe-nav="request-groups" data-compact-swipe aria-label={t('moneyRequestList')}>
        <ActiveLinkIndicator selection={group.label} />
        {groups.map(({ label, entries, icon: Icon }) => <Link key={label} to={'?group=' + label}
          aria-current={group.label === label ? 'page' : undefined}>
          <Icon size={17} aria-hidden="true" />
          <span>{t(label)}</span>
          <bdi className="request-filter-count">{entries.length.toLocaleString(i18n.language === 'ar' ? 'ar-EG' : 'en-EG')}</bdi>
        </Link>)}
      </nav>
      <div className="request-board" data-page-swipe-panel="request-groups">
      {[group].map(({ label, accent, entries }) => <div className="request-group" data-accent={accent} key={label}>
        <h3 className="request-list-heading">{t(label)}</h3>
        {entries.length === 0 && <p className="connections-empty">{t('noRequestsInGroup')}</p>}
        {entries.length > 0 && <ul className="ledger">
          {entries.map(request => <li key={request.id}>
            <Link to={'?group=' + label + '&request=' + request.id} className="request-list-link">
              <span className="request-list-info">
                <strong><bdi>{request.reason}</bdi></strong>
                {request.is_offer && <span className="muted">{t(request.sender === userId ? 'owed' : 'owe')}</span>}
                <span className="muted request-counterpart"><bdi>{names.get(request.sender === userId ? request.recipient : request.sender)?.display_name}</bdi></span>
                <span className="status" data-state={request.state}>{t(requestStateLabel(request.state))}</span>
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
      </div>
    </section>}
  </div>
}

import { DateField } from '../../ui/DateField'
