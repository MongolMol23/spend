import { Toast } from '../../ui/Toast'
import { useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { Search, UserPlus, UsersRound } from 'lucide-react'
import type { Database } from '../../data/database.types'
import type { Client, RunAction } from './api'

type Friendship = Database['public']['Tables']['friendships']['Row']
type Person = Database['public']['Functions']['connection_names']['Returns'][number]

export function FriendPanel({ client, userId, friends, names, busy, run }: {
  client: Client; userId: string; friends: Friendship[]; names: Map<string, Person>; busy: boolean; run: RunAction
}) {
  const { t } = useTranslation()
  const [match, setMatch] = useState<{ username: string; display_name: string } | null>()
  const [searching, setSearching] = useState(false)
  const [searchFailed, setSearchFailed] = useState(false)
  const active = friends.filter(friend => friend.state === 'pending' || friend.state === 'accepted')

  async function search(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const username = String(new FormData(event.currentTarget).get('username') ?? '').trim()
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
    <h2 className="section-heading"><span className="icon-tile" aria-hidden="true"><UsersRound size={18} /></span>{t('friends')}</h2>
    <form className="connection-form friend-search" onSubmit={search}>
      <label>{t('username')}<input name="username" dir="ltr" autoCapitalize="none" spellCheck={false} required /></label>
      <button className="primary" disabled={searching}><Search size={17} aria-hidden="true" />{t('findFriend')}</button>
    </form>
    {searchFailed && <Toast message={t('connectionError')} />}
    {match === null && <p className="empty-state" role="status">{t('noFriendFound')}</p>}
    {match && <div className="row connection-item">
      <span className="friend-identity"><span className="icon-tile" aria-hidden="true"><UserPlus size={17} /></span>
        <span><strong><bdi>{match.display_name}</bdi></strong><small><bdi>@{match.username}</bdi></small></span>
      </span>
      <button type="button" className="primary" disabled={busy}
        onClick={() => void run(() => client.rpc('send_friend_request', { target_username: match.username }), () => setMatch(undefined))}>{t('addFriend')}</button>
    </div>}
    {active.length === 0 && match === undefined && <p className="connections-empty">{t('noFriends')}</p>}
    {active.length > 0 && <ul className="ledger friend-list">
      {active.map(friend => {
        const incoming = friend.recipient === userId
        const name = names.get(incoming ? friend.sender : friend.recipient)
        return <li key={friend.id} className="connection-item">
          <div className="row"><span className="friend-identity">
            <span className="icon-tile" aria-hidden="true">{Array.from(name?.display_name || name?.username || '?')[0]?.toLocaleUpperCase()}</span>
            <span><strong><bdi>{name?.display_name ?? name?.username}</bdi></strong>
              {name?.username && <small><bdi>@{name.username}</bdi></small>}</span></span>
            <span className="status" data-state={friend.state}>{t(friend.state === 'accepted' ? 'friends' : incoming ? 'received' : 'sentRequests')}</span></div>
          <div className="connection-actions">
            {(friend.state === 'accepted' ? ['removed'] : incoming ? ['accepted', 'declined'] : []).map(decision =>
              <button type="button" className="secondary" key={decision} disabled={busy} onClick={() => void run(() =>
                client.rpc('respond_friendship', { friendship_id: friend.id, decision }))}>
                {t(decision === 'removed' ? 'removeFriend' : decision === 'accepted' ? 'acceptRequest' : 'declineRequest')}
              </button>)}
          </div>
        </li>
      })}
    </ul>}
  </section>
}

