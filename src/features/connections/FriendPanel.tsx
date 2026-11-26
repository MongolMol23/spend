import { Toast } from '../../ui/Toast'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Check, Clock, ScanLine, Search, UserPlus, UsersRound } from 'lucide-react'
import { Link } from 'react-router'
import type { Database } from '../../data/database.types'
import type { Client, RunAction } from './api'
import { FriendQrScanner, requestQrCamera } from './FriendQrScanner'

type Friendship = Database['public']['Tables']['friendships']['Row']
type Person = Database['public']['Functions']['connection_names']['Returns'][number]

type FriendActions = {
  client: Client; userId: string; names: Map<string, Person>; friends: Friendship[]; busy: boolean; pending?: string; run: RunAction
}

export function FriendSearch({ client, userId, names, friends, busy, pending, run, initialUsername }: FriendActions & { initialUsername?: string }) {
  const { t } = useTranslation()
  const usernameInput = useRef<HTMLInputElement>(null)
  const [camera, setCamera] = useState<ReturnType<typeof requestQrCamera>>()
  const [match, setMatch] = useState<{ username: string; display_name: string } | null>()
  const [searching, setSearching] = useState(false)
  const [searchFailed, setSearchFailed] = useState(false)
  const friendship = match && friends.find(friend =>
    (friend.state === 'accepted' || friend.state === 'pending')
    && names.get(friend.sender === userId ? friend.recipient : friend.sender)?.username === match.username)
  const incoming = friendship?.state === 'pending' && friendship.recipient === userId

  useEffect(() => () => camera?.stop(), [camera])

  function requestCamera() {
    setCamera(requestQrCamera())
  }

  function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    void findFriend(usernameInput.current?.value.trim() ?? '')
  }

  async function findFriend(username: string) {
    if (!username || searching) return
    setSearching(true)
    setSearchFailed(false)
    setMatch(undefined)
    try {
      const { data, error } = await client.rpc('find_profile', { requested_username: username })
      if (error) throw error
      const found = data[0]
      setMatch(found && found.username !== names.get(userId)?.username ? found : null)
    } catch {
      setSearchFailed(true)
    } finally {
      setSearching(false)
    }
  }

  return <section className="panel friend-panel">
    <h2 className="section-heading"><span className="icon-tile" aria-hidden="true"><UserPlus size={18} /></span>{t('addFriend')}</h2>
    <form className="connection-form friend-search" onSubmit={search}>
      <label>{t('username')}<input ref={usernameInput} name="username" dir="ltr" defaultValue={initialUsername}
        autoCapitalize="none" spellCheck={false} required /></label>
      <button className="primary" disabled={searching} aria-busy={searching} aria-label={t('findFriend')} title={t('findFriend')}>
        <Search size={18} aria-hidden="true" /><span>{t('findFriend')}</span>
      </button>
    </form>
    <button type="button" className="secondary friend-qr-launch" aria-haspopup="dialog" disabled={searching || busy}
      onClick={requestCamera}>
      <ScanLine size={20} aria-hidden="true" />{t('friendQrTitle')}
    </button>
    {camera && <FriendQrScanner camera={camera} onRetry={requestCamera} onClose={() => setCamera(undefined)} onScan={username => {
      setCamera(undefined)
      if (usernameInput.current) usernameInput.current.value = username
      void findFriend(username)
    }} />}
    {searchFailed && <Toast message={t('connectionError')} />}
    {match === null && <p className="empty-state" role="status">{t('noFriendFound')}</p>}
    {match && <div className="friend-search-result" data-friendship={friendship?.state}>
      <div className="friend-result-identity">
        <span className="friend-result-avatar" aria-hidden="true">
          {Array.from(match.display_name || match.username)[0]?.toLocaleUpperCase()}
        </span>
        <div className="friend-result-name">
          <strong><bdi>{match.display_name}</bdi></strong>
          <div className="friend-result-meta">
            <bdi dir="ltr">@{match.username}</bdi>
            {friendship?.state === 'pending' && !incoming && <span className="status friend-result-status" role="status">
              <Clock size={13} aria-hidden="true" />{t('friendRequestPending')}
            </span>}
          </div>
        </div>
      </div>
      {friendship?.state === 'accepted' && <span className="friend-result-confirmed" role="status">
        <Check size={15} aria-hidden="true" />
        <span>{t('alreadyFriends')}</span>
      </span>}
      {incoming && <Link className="secondary" to="/connections?view=friends">{t('viewIncomingFriendRequest')}</Link>}
      {!friendship && <button type="button" className="primary" disabled={busy} aria-busy={pending === 'add-friend'}
          onClick={() => void run('add-friend', () => client.rpc('send_friend_request', { target_username: match.username }))}>
          <UserPlus size={18} aria-hidden="true" />{t('addFriend')}
        </button>}
    </div>}
  </section>
}

export function FriendPanel({ client, userId, friends, names, busy, pending, run }: FriendActions) {
  const { t } = useTranslation()
  const active = friends.filter(friend => friend.state === 'pending' || friend.state === 'accepted')
    .sort((first, second) => Number(second.state === 'pending' && second.recipient === userId)
      - Number(first.state === 'pending' && first.recipient === userId))

  return <section className="panel friend-panel">
    <h2 className="section-heading"><span className="icon-tile" aria-hidden="true"><UsersRound size={18} /></span>{t('friends')}</h2>
    {active.length === 0 && <p className="connections-empty">{t('noFriends')}</p>}
    {active.length > 0 && <ul className="ledger friend-list">
      {active.map(friend => {
        const incoming = friend.recipient === userId
        const name = names.get(incoming ? friend.sender : friend.recipient)
        return <li key={friend.id} className="connection-item" data-state={friend.state}>
          <div className="row"><span className="friend-identity">
            <span className="icon-tile" aria-hidden="true">{Array.from(name?.display_name || name?.username || '?')[0]?.toLocaleUpperCase()}</span>
            <span><strong><bdi>{name?.display_name ?? name?.username}</bdi></strong>
              {name?.username && <small><bdi>@{name.username}</bdi></small>}</span></span>
            {friend.state !== 'accepted' && <span className="status" data-state={friend.state}>{t(incoming ? 'received' : 'sentRequests')}</span>}</div>
          <div className="connection-actions">
            {(friend.state === 'accepted' ? ['removed'] : incoming ? ['accepted', 'declined'] : []).map(decision =>
              <button type="button" className="secondary" key={decision} disabled={busy}
                aria-busy={pending === 'friend:' + friend.id + ':' + decision}
                onClick={() => void run('friend:' + friend.id + ':' + decision, () =>
                client.rpc('respond_friendship', { friendship_id: friend.id, decision }))}>
                {t(decision === 'removed' ? 'removeFriend' : decision === 'accepted' ? 'acceptRequest' : 'declineRequest')}
              </button>)}
          </div>
        </li>
      })}
    </ul>}
  </section>
}

