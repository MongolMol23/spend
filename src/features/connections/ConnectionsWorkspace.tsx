import { Toast } from '../../ui/Toast'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { loadConnections, type Client, type RunAction } from './api'
import { FriendPanel } from './FriendPanel'
import { Bell, HandCoins, UsersRound } from 'lucide-react'
import { RequestPanel } from './RequestPanel'

export function ConnectionsWorkspace({ client, userId }: { client: Client; userId: string }) {
  const { t, i18n } = useTranslation()
  const [params] = useSearchParams()
  const [busy, setBusy] = useState(false)
  const [feedback, setFeedback] = useState<'connectionSaved' | 'connectionError' | 'friendExists' | 'correctionStale' | 'invalidCorrection'>()
  const query = useQuery({
    queryKey: ['connections', userId],
    queryFn: ({ signal }) => loadConnections(client, signal),
    // Keep the mounted workspace current, including while another app window is active.
    refetchInterval: 3000,
    refetchIntervalInBackground: true,
  })
  const run: RunAction = async (operation, done) => {
    if (busy) return
    setBusy(true)
    setFeedback(undefined)
    try {
      const { error } = await operation()
      if (error) throw error
      done?.()
      setFeedback('connectionSaved')
      await query.refetch()
    } catch (error) {
      const message = typeof error === 'object' && error !== null && 'message' in error ? error.message : ''
      setFeedback(message === 'friend_exists' ? 'friendExists' : message === 'stale_correction'
        ? 'correctionStale' : message === 'invalid_correction' ? 'invalidCorrection' : 'connectionError')
      await query.refetch()
    } finally {
      setBusy(false)
    }
  }

  if (query.isPending) return <p className="loading-state" role="status">{t('loading')}</p>
  if (query.isError && !query.data) return <div className="panel"><Toast message={t('connectionError')} />
    <button className="primary" onClick={() => void query.refetch()}>{t('retry')}</button></div>
  const data = query.data
  if (!data?.profile) return <div className="panel"><p>{t('profileRequired')}</p><Link className="primary" to="/account">{t('settings')}</Link></div>
  const names = new Map(data.names.map(person => [person.id, person]))
  const friends = data.friendships.filter(friend => friend.state === 'accepted').flatMap(friend => {
    const person = names.get(friend.sender === userId ? friend.recipient : friend.sender)
    return person ? [person] : []
  })
  const awaiting = data.friendships.filter(friend => friend.state === 'pending' && friend.recipient === userId).length
    + data.requests.filter(request => request.state === 'pending' && request.recipient === userId).length

  return <>
    <dl className="connection-summary">
      {([
        ['friends', friends.length, UsersRound, 'mint'],
        ['request', data.requests.filter(request => request.state === 'pending' || request.state === 'accepted').length, HandCoins, 'lavender'],
        ['needsResponse', awaiting, Bell, 'amber'],
      ] as const).map(([label, count, Icon, accent]) => <div key={label} className="panel" data-accent={accent}>
        <dt><Icon size={18} aria-hidden="true" />{t(label === 'request' ? 'activeMoneyRequests' : label)}</dt>
        <dd>{count.toLocaleString(i18n.language === 'ar' ? 'ar-EG' : 'en-EG')}</dd>
      </div>)}
    </dl>
    {feedback && <Toast kind={feedback === 'connectionSaved' ? 'success' : 'error'} message={t(feedback)} />}
    <div className="connections-grid">
      <FriendPanel client={client} userId={userId} friends={data.friendships} names={names} busy={busy} run={run} />
      <RequestPanel client={client} userId={userId} friends={friends} names={names} requests={data.requests}
        payments={data.payments} corrections={data.corrections}
        activeId={params.get('request')} busy={busy} run={run} />
    </div>
  </>
}

