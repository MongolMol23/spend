import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../data/supabase'
import type { Database } from '../../data/database.types'
import { Toast } from '../../ui/Toast'
import type { Label } from '../../i18n/locales'
import { Check, Clock3, Search, ShieldCheck, UsersRound, X } from 'lucide-react'
import { FeatureHeading } from '../../ui/FeatureHeading'
import './admin.css'

type AccountRow = Database['public']['Functions']['spend_admin_users']['Returns'][number]
const filters = [
  { value: '', label: 'adminAllAccounts', icon: UsersRound, accent: 'lavender' },
  { value: 'pending', label: 'adminPendingBadge', icon: Clock3, accent: 'amber' },
  { value: 'approved', label: 'adminApproved', icon: Check, accent: 'mint' },
  { value: 'rejected', label: 'adminRejected', icon: X, accent: 'peach' },
] as const
const pageSize = 12

export function AdminAccounts() {
  const { t } = useTranslation()
  const [userId, setUserId] = useState<string | null | undefined>(supabase ? undefined : null)
  useEffect(() => {
    const listener = supabase?.auth.onAuthStateChange((_, session) => setUserId(session?.user.id ?? null))
    return () => listener?.data.subscription.unsubscribe()
  }, [])

  return <main className="shell admin-page" id="main" tabIndex={-1}>
    <FeatureHeading title={t('adminAccounts')} icon={ShieldCheck} accent="lavender" />
    {userId === undefined ? <p role="status">{t('loading')}</p>
      : userId ? <AccountQueue key={userId} /> : <p>{t('adminAccessRequired')}</p>}
  </main>
}

function AccountQueue() {
  const { t, i18n } = useTranslation()
  const [rows, setRows] = useState<AccountRow[]>()
  const [failure, setFailure] = useState(false)
  const [search, setSearch] = useState('')
  const [status, setStatus] = useState('pending')
  const [managedId, setManagedId] = useState<string>()
  const [page, setPage] = useState(0)
  const [busy, setBusy] = useState(false)
  const [notice, setNotice] = useState<Label>()
  const [requests, setRequests] = useState<string[]>([])
  const [resetLink, setResetLink] = useState<{ id: string; url: string }>()

  useEffect(() => {
    const controller = new AbortController()
    void supabase!.rpc('spend_admin_users').abortSignal(controller.signal).then(({ data, error }) => {
      if (controller.signal.aborted) return
      if (error) setFailure(true)
      else setRows(data)
    })
    return () => controller.abort()
  }, [])

  useEffect(() => {
    if (!rows) return
    const controller = new AbortController()
    async function refresh() {
      const { data } = await supabase!.rpc('spend_recovery_queue').abortSignal(controller.signal)
      if (data && !controller.signal.aborted) setRequests(data)
    }
    void refresh()
    const timer = window.setInterval(() => void refresh(), 5000)
    return () => { controller.abort(); window.clearInterval(timer) }
  }, [rows])

  async function act(row: AccountRow, action: 'approved' | 'rejected' | 'reset' | 'shared') {
    if (busy) return
    setBusy(true)
    setNotice(undefined)
    try {
      if (action === 'reset') {
        setResetLink(undefined)
        const { data, error } = await supabase!.functions.invoke<{ token: string }>('manual-recovery', { body: { targetId: row.id } })
        if (error || !data?.token) throw error ?? new Error('Missing recovery token')
        const url = new URL('/account/reset', location.origin)
        url.searchParams.set('token_hash', data.token)
        setResetLink({ id: row.id, url: url.href })
      } else if (action === 'shared') {
        const { error } = await supabase!.rpc('spend_finish_recovery', { target_id: row.id })
        if (error) throw error
        setRequests(current => current.filter(id => id !== row.id))
        setResetLink(undefined)
        setManagedId(undefined)
      } else {
        const { error } = await supabase!.rpc('spend_review_account', { target_id: row.id, decision: action })
        if (error) throw error
        const refreshed = await supabase!.rpc('spend_admin_users')
        if (refreshed.error) throw refreshed.error
        setRows(refreshed.data)
        setNotice('adminReviewSaved')
      }
    } catch {
      setNotice('accountError')
    } finally {
      setBusy(false)
    }
  }

  if (failure) return <p>{t('adminAccessRequired')}</p>
  if (!rows) return <p role="status">{t('loading')}</p>
  const query = search.trim().toLowerCase()
  const filtered = rows.filter(row => (!status || (status === 'recovery' ? requests.includes(row.id) : row.status === status))
    && [row.email, row.username, row.display_name].some(value => (value ?? '').toLowerCase().includes(query)))
  const date = new Intl.DateTimeFormat(i18n.language, { dateStyle: 'medium', timeZone: 'Africa/Cairo' })
  const number = new Intl.NumberFormat(i18n.language === 'ar' ? 'ar-EG' : 'en-EG')
  const currentPage = Math.min(page, Math.max(0, Math.ceil(filtered.length / pageSize) - 1))
  const start = currentPage * pageSize
  const visible = filtered.slice(start, start + pageSize)

  async function copyResetLink(url: string) {
    setNotice(undefined)
    try {
      await navigator.clipboard.writeText(url)
      setNotice('manualRecoveryCopied')
    } catch {
      setNotice('accountError')
    }
  }

  return <>
    <div className="admin-filters" role="group" aria-label={t('adminStatus')}>
      {filters.map(({ value, label, icon: Icon, accent }) => <button key={value} type="button"
        className="secondary admin-filter" data-accent={accent} aria-pressed={status === value}
        onClick={() => { setStatus(value); setPage(0) }}>
        <Icon size={18} aria-hidden="true" /><span>{t(label)}</span>
        <strong>{number.format(value ? rows.filter(row => row.status === value).length : rows.length)}</strong>
      </button>)}
      <button type="button" className="secondary admin-filter" data-accent="amber" aria-pressed={status === 'recovery'}
        onClick={() => { setStatus('recovery'); setPage(0) }}>
        <Clock3 size={18} aria-hidden="true" /><span>{t('manualRecoveryQueue')}</span>
        <strong>{number.format(requests.length)}</strong>
      </button>
    </div>
    <section className="panel admin-directory">
      <div className="admin-directory-header">
        <h2>{t('adminDirectory')}</h2>
        <div className="admin-search">
          <Search size={17} aria-hidden="true" />
          <input type="search" aria-label={t('adminSearch')} placeholder={t('adminSearch')} value={search}
            onChange={event => {
              if (event.target.value.trim() && !search.trim()) setStatus('')
              setSearch(event.target.value)
              setPage(0)
            }} />
        </div>
      </div>
    {visible.length === 0 && <p className="empty-state">{t(status === 'pending' && !query ? 'adminQueueEmpty' : 'noItems')}</p>}
    <ul className="ledger admin-list">
      {visible.map(row => {
        const name = row.display_name ?? row.username ?? row.email
        return <li className="admin-user" data-status={row.status} key={row.id}>
          <div className="admin-user-identity">
            <span className="admin-avatar" aria-hidden="true">{name ? Array.from(name)[0].toLocaleUpperCase() : '?'}</span>
            <div>
            <strong><bdi>{name}</bdi></strong>
            {row.username && <div><bdi>@{row.username}</bdi></div>}
            <div><bdi>{row.email}</bdi></div>
            <small>{t('memberSince')} {date.format(new Date(row.created_at))}</small>
            </div>
          </div>
          <div className="admin-user-state">
            <span className="status" data-state={row.status === 'approved' ? 'accepted' : row.status === 'rejected' ? 'declined' : 'pending'}>
              {row.status === 'pending' && <Clock3 size={13} aria-hidden="true" />}
              {t(row.status === 'approved' ? 'adminApproved' : row.status === 'rejected' ? 'adminRejected' : 'adminPendingBadge')}
            </span>
            {row.reviewed_at && <small>{t('adminReviewed')} {date.format(new Date(row.reviewed_at))}</small>}
          </div>
          {row.status === 'pending' && <div className="admin-user-actions">
            <button className="primary" disabled={busy} onClick={() => void act(row, 'approved')}>{t('adminApprove')}</button>
            <button className="secondary admin-reject" disabled={busy} onClick={() => void act(row, 'rejected')}>{t('adminReject')}</button>
          </div>}
          {row.status === 'approved' && requests.includes(row.id) && <div className="admin-user-actions">
            <button type="button" className="secondary" aria-expanded={managedId === row.id}
              onClick={() => { setResetLink(undefined); setManagedId(managedId === row.id ? undefined : row.id) }}>{t('adminManage')}</button>
          </div>}
          {row.status === 'approved' && requests.includes(row.id) && managedId === row.id && <div className="admin-reset">
            <p>{t('manualRecoveryShareHint')}</p>
            {resetLink?.id === row.id ? <>
              <input aria-label={t('manualRecoveryLink')} dir="ltr" readOnly value={resetLink.url} onFocus={event => event.currentTarget.select()} />
              <button type="button" className="secondary" onClick={() => void copyResetLink(resetLink.url)}>{t('manualRecoveryCopy')}</button>
              <button type="button" className="secondary" disabled={busy} onClick={() => void act(row, 'shared')}>{t('manualRecoveryShared')}</button>
            </> : <button type="button" className="secondary" disabled={busy} onClick={() => void act(row, 'reset')}>
              {t('manualRecoveryGenerate')}
            </button>}
          </div>}
      </li>})}
    </ul>
    {filtered.length > pageSize && <div className="admin-pages">
      <button type="button" className="secondary" disabled={currentPage === 0} onClick={() => setPage(currentPage - 1)}>{t('adminPrevious')}</button>
      <bdi>{number.format(start + 1)}–{number.format(start + visible.length)} / {number.format(filtered.length)}</bdi>
      <button type="button" className="secondary" disabled={start + visible.length >= filtered.length} onClick={() => setPage(currentPage + 1)}>{t('adminNext')}</button>
    </div>}
    {notice && <Toast kind={notice === 'accountError' ? 'error' : 'success'}
      message={t(notice)} />}
    </section>
  </>
}
