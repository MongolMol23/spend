import { Toast } from '../../ui/Toast'
import { ActiveLinkIndicator } from '../../ui/ActiveLinkIndicator'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { loadConnections, type Client, type RunAction } from './api'
import { FriendPanel, FriendSearch } from './FriendPanel'
import { HandCoins, UserPlus, UsersRound } from 'lucide-react'
import { RequestPanel } from './RequestPanel'
import { inviteUsername } from './friendInvite'

export function ConnectionsWorkspace({ client, userId }: { client: Client; userId: string }) {
  const { t, i18n } = useTranslation()
  const [params] = useSearchParams()
  const [pending, setPending] = useState<string>()
  const busy = pending !== undefined
  const [feedback, setFeedback] = useState<'connectionSaved' | 'requestSent' | 'connectionError' | 'friendExists' | 'correctionStale' | 'invalidCorrection'>()
  const query = useQuery({
    queryKey: ['connections', userId],
    queryFn: ({ signal }) => loadConnections(client, signal),
    // Keep the mounted workspace current, including while another app window is active.
    refetchInterval: 3000,
    refetchIntervalInBackground: true,
  })
  const run: RunAction = async (action, operation, done) => {
    if (busy) return
    setPending(action)
    setFeedback(undefined)
    try {
      const { error } = await operation()
      if (error) throw error
      done?.()
      setFeedback(action === 'send-request' ? 'requestSent' : 'connectionSaved')
      await query.refetch()
    } catch (error) {
      const message = typeof error === 'object' && error !== null && 'message' in error ? error.message : ''
      setFeedback(message === 'friend_exists' ? 'friendExists' : message === 'stale_correction'
        ? 'correctionStale' : message === 'invalid_correction' ? 'invalidCorrection' : 'connectionError')
      await query.refetch()
    } finally {
      setPending(undefined)
    }
  }

  if (query.isPending) return <p className="loading-state" role="status">{t('loading')}</p>
  if (query.isError && !query.data) return <div className="panel"><Toast message={t('connectionError')} />
    <button className="primary" disabled={query.isFetching} aria-busy={query.isFetching} onClick={() => void query.refetch()}>{t('retry')}</button></div>
  const data = query.data
  if (!data?.profile) return <div className="panel"><p>{t('profileRequired')}</p><Link className="primary" to="/account">{t('settings')}</Link></div>
  const names = new Map(data.names.map(person => [person.id, person]))
  const friends = data.friendships.filter(friend => friend.state === 'accepted').flatMap(friend => {
    const person = names.get(friend.sender === userId ? friend.recipient : friend.sender)
    return person ? [person] : []
  })
  const requestId = params.get('request')
  const view = params.get('view')
  const section = !requestId && (view === 'friends' || view === 'add') ? view : 'requests'
  const invitedBy = section === 'add' ? inviteUsername(params.get('friend')) : undefined
  const incomingFriends = data.friendships.filter(friend => friend.state === 'pending' && friend.recipient === userId).length
  const incomingMoney = data.requests.filter(request => request.state === 'pending' && request.recipient === userId).length

  return <>
    <nav className="connection-sections" data-page-swipe-nav="connections" data-compact-swipe aria-label={t('connections')}>
      <ActiveLinkIndicator selection={section} />
      {([
        ['requests', 'moneyRequestList', HandCoins, incomingMoney],
        ['friends', 'friends', UsersRound, incomingFriends],
        ['add', 'addFriend', UserPlus, 0],
      ] as const).map(([key, label, Icon, count]) => <Link key={key}
        to={key === 'requests' ? '/connections' : '/connections?view=' + key}
        aria-current={section === key ? 'page' : undefined}>
        <Icon size={18} aria-hidden="true" /><span>{t(label)}</span>
        {count > 0 && <bdi className="connection-section-count">{count.toLocaleString(i18n.language === 'ar' ? 'ar-EG' : 'en-EG')}</bdi>}
      </Link>)}
    </nav>
    {feedback && <Toast kind={feedback === 'connectionSaved' || feedback === 'requestSent' ? 'success' : 'error'} message={t(feedback)} />}
    <div data-page-swipe-panel="connections">
      {section === 'friends' && <FriendPanel client={client} userId={userId} friends={data.friendships} names={names} busy={busy} pending={pending} run={run} />}
      {section === 'add' && <FriendSearch key={invitedBy} initialUsername={invitedBy}
        client={client} userId={userId} names={names} friends={data.friendships} busy={busy} pending={pending} run={run} />}
      {section === 'requests' && <RequestPanel client={client} userId={userId} friends={friends} names={names} requests={data.requests}
          payments={data.payments} corrections={data.corrections}
          activeId={requestId} busy={busy} pending={pending} run={run} />}
    </div>
  </>
}

