import { Toast } from '../../ui/Toast'
import { ActiveLinkIndicator } from '../../ui/ActiveLinkIndicator'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, Navigate, useSearchParams } from 'react-router'
import { connectionPeople, isSharedDebt, loadConnections, requestTarget, sharedDebtPath, type Client } from './api'
import { FriendPanel, FriendSearch } from './FriendPanel'
import { HandCoins, UserPlus, UsersRound } from 'lucide-react'
import { RequestPanel } from './RequestPanel'
import { inviteUsername } from './friendInvite'
import { useConnectionAction } from './useConnectionAction'

export function ConnectionsWorkspace({ client, userId }: { client: Client; userId: string }) {
  const { t, i18n } = useTranslation()
  const [params] = useSearchParams()
  const query = useQuery({
    queryKey: ['connections', userId],
    queryFn: ({ signal }) => loadConnections(client, signal),
    // Keep the mounted workspace current, including while another app window is active.
    refetchInterval: 3000,
    refetchIntervalInBackground: true,
  })
  const { pending, busy, feedback, run } = useConnectionAction(query.refetch)

  if (query.isPending) return <p className="loading-state" role="status">{t('loading')}</p>
  if (query.isError && !query.data) return <div className="panel"><Toast message={t('connectionError')} />
    <button className="primary" disabled={query.isFetching} aria-busy={query.isFetching} onClick={() => void query.refetch()}>{t('retry')}</button></div>
  const data = query.data
  if (!data?.profile) return <div className="panel"><p>{t('profileRequired')}</p><Link className="primary" to="/account">{t('settings')}</Link></div>
  const { names, friends } = connectionPeople(data, userId)
  const requestId = params.get('request')
  const view = params.get('view')
  const section = !requestId && (view === 'friends' || view === 'add') ? view : 'requests'
  const invitedBy = section === 'add' ? inviteUsername(params.get('friend')) : undefined
  const incomingFriends = data.friendships.filter(friend => friend.state === 'pending' && friend.recipient === userId).length
  const incomingMoney = data.requests.filter(request => request.state === 'pending' && requestTarget(request) === userId).length
  const request = data.requests.find(item => item.id === requestId)
  if (request && isSharedDebt(request)) return <Navigate replace to={sharedDebtPath(request, userId)} />

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

