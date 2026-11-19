import { Toast } from '../../ui/Toast'
import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { BadgeAlert, BadgeCheck, Copy, LogOut, Mail, Pencil, Shield, ShieldCheck, UserRound, UsersRound } from 'lucide-react'
import { Link } from 'react-router'
import type { Label } from '../../i18n/locales'
import { supabase } from '../../data/supabase'
import { LedgerEditor } from '../../ui/LedgerEditor'
import { signupProfileSchema } from './validation'

export function ProfileSettings({ userId, email, emailVerified, createdAt }: {
  userId: string; email?: string; emailVerified: boolean; createdAt: string
}) {
  const { t, i18n } = useTranslation()
  const client = supabase!
  const queryClient = useQueryClient()
  const queryKey = ['profile', userId]
  const admin = useQuery({
    queryKey: ['admin-role', userId],
    queryFn: async ({ signal }) => {
      const { data, error } = await client.rpc('spend_is_admin').abortSignal(signal)
      if (error) throw error
      return data
    },
  })
  const [notice, setNotice] = useState<Label>()
  const [error, setError] = useState<Label>()
  const [editing, setEditing] = useState(false)
  const [pending, setPending] = useState<'save' | 'signout'>()
  const busy = pending !== undefined
  const [sendingReset, setSendingReset] = useState(false)
  const profile = useQuery({
    queryKey,
    queryFn: async ({ signal }) => {
      const { data, error } = await client.from('profiles').select('*').eq('id', userId).abortSignal(signal).maybeSingle()
      if (error) throw error
      return data
    },
  })
  const details = profile.data
  const localizedName = i18n.language === 'ar' ? details?.name_ar : details?.name_en
  const name = localizedName || details?.display_name || details?.username
  const initial = name ? Array.from(name)[0]?.toLocaleUpperCase() : undefined
  const arabicName = details?.name_ar ?? signupProfileSchema.shape.name_ar.safeParse(details?.display_name).data
  const englishName = details?.name_en ?? signupProfileSchema.shape.name_en.safeParse(details?.display_name).data
  const joined = new Date(createdAt)
  const joinedLabel = Number.isFinite(joined.getTime()) ? new Intl.DateTimeFormat(
    i18n.language === 'ar' ? 'ar-EG' : 'en-EG',
    { month: 'long', year: 'numeric', timeZone: 'Africa/Cairo' },
  ).format(joined) : undefined
  const emailStatus = t(emailVerified ? 'emailVerified' : 'emailUnverified')

  async function sendPasswordLink() {
    if (!email || sendingReset) return
    setSendingReset(true)
    setError(undefined)
    setNotice(undefined)
    try {
      const { error: failure } = await client.rpc('spend_request_recovery', { requested_email: email })
      if (failure) throw failure
      setNotice('manualRecoveryRequested')
    } catch {
      setError('accountError')
    } finally {
      setSendingReset(false)
    }
  }

  async function copyUsername(username: string) {
    setNotice(undefined)
    setError(undefined)
    try {
      await navigator.clipboard.writeText(username)
      setNotice('usernameCopied')
    } catch {
      setError('usernameCopyFailed')
    }
  }

  async function save(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (busy) return
    const values = new FormData(event.currentTarget)
    const result = signupProfileSchema.safeParse({
      ...Object.fromEntries(values),
      language: profile.data?.language ?? i18n.language,
    })
    setNotice(undefined)
    setError(undefined)
    if (!result.success) {
      const field = result.error.issues[0]?.path[0]
      return setError(field === 'name_ar' ? 'invalidArabicName' : field === 'name_en' ? 'invalidEnglishName' : 'invalidProfile')
    }
    setPending('save')
    try {
      const { language, name_ar, name_en } = result.data
      // Connections still use the single display_name returned by their database functions.
      const updated = { id: userId, ...result.data, display_name: language === 'ar' ? name_ar : name_en }
      const { error: failure } = await client.from('profiles').upsert(updated)
      if (failure?.code === '23505') return setError('usernameTaken')
      if (failure) throw failure
      queryClient.setQueryData(queryKey, updated)
      setEditing(false)
      setNotice('profileSaved')
    } catch {
      setError('accountError')
    } finally {
      setPending(undefined)
    }
  }

  async function signOut() {
    if (busy) return
    setPending('signout')
    try {
      const { error: failure } = await client.auth.signOut()
      if (failure) throw failure
    } catch {
      setError('accountError')
    } finally {
      setPending(undefined)
    }
  }

  function openEditor() {
    setError(undefined)
    setNotice(undefined)
    setEditing(true)
  }

  function closeEditor() {
    setError(undefined)
    setEditing(false)
  }

  return <>
    <header className="panel profile-header">
      <div className="profile-intro">
        <div className="profile-avatar" aria-hidden="true">{initial || <UserRound size={24} />}</div>
        <div className="profile-identity">
          <h1><bdi>{name || t('account')}</bdi></h1>
          {details?.username && <div className="profile-handle">
            <bdi>@{details.username}</bdi>
            <button type="button" className="profile-copy" title={t('copyUsername')} aria-label={t('copyUsername')}
              onClick={() => void copyUsername(details.username)}>
              <Copy size={16} aria-hidden="true" />
            </button>
          </div>}
        </div>
        {profile.isSuccess && <button type="button" className="secondary profile-edit" disabled={busy || sendingReset}
          aria-label={t('editProfile')} title={t('editProfile')} onClick={openEditor}>
          <Pencil size={17} aria-hidden="true" />
        </button>}
      </div>
      {profile.isPending && <p className="loading-state" role="status">{t('loading')}</p>}
      {profile.isError && <><Toast message={t('accountError')} />
        <button type="button" className="secondary profile-retry" disabled={profile.isFetching}
          aria-busy={profile.isFetching} onClick={() => void profile.refetch()}>{t('retry')}</button></>}
      {(email || joinedLabel) && <div className="profile-meta">
        {email && <p className="profile-email"><Mail size={16} aria-hidden="true" /><bdi>{email}</bdi>
          <span className="profile-verified" data-verified={emailVerified} role="img" aria-label={emailStatus} title={emailStatus}>
            {emailVerified ? <BadgeCheck size={17} aria-hidden="true" /> : <BadgeAlert size={17} aria-hidden="true" />}
          </span>
        </p>}
        {joinedLabel && <p className="profile-member">
          <span>{t('memberSince')} <time dateTime={createdAt}>{joinedLabel}</time></span>
        </p>}
      </div>}
    </header>
    {editing && <LedgerEditor titleId="profile-details-title" busy={busy} onClose={closeEditor}>
      <section className="panel profile-details">
        <h2 id="profile-details-title">{t('profileDetails')}</h2>
        <form onSubmit={save} noValidate>
          <fieldset className="account-form" disabled={busy} aria-labelledby="profile-details-title">
            <label>{t('username')}<input name="username" defaultValue={details?.username} autoComplete="username" required dir="ltr" /></label>
            <label>{t('nameArabic')}<input name="name_ar" defaultValue={arabicName} maxLength={80} required dir="rtl" /></label>
            <label>{t('nameEnglish')}<input name="name_en" defaultValue={englishName} maxLength={80} required dir="ltr" /></label>
            {error && <Toast message={t(error)} />}
            <button type="submit" className="primary" aria-busy={pending === 'save'}>{t('saveProfile')}</button>
          </fieldset>
        </form>
      </section>
    </LedgerEditor>}
    {!editing && error && <Toast message={t(error)} />}
    {notice && <Toast kind="success" message={t(notice)} />}
    <div className="profile-actions">
      {email && <button type="button" className="secondary profile-option" data-accent="yellow" disabled={busy || sendingReset}
        aria-busy={sendingReset} aria-labelledby="profile-reset-label" aria-describedby="profile-reset-hint"
        onClick={() => void sendPasswordLink()}>
        <Shield size={20} aria-hidden="true" />
        <strong id="profile-reset-label">{t('changePassword')}</strong>
      </button>}
      <Link className="secondary profile-option" data-accent="mint" to="/connections">
        <UsersRound size={20} aria-hidden="true" /><strong>{t('connections')}</strong>
      </Link>
      {admin.data && <Link className="secondary profile-option" data-accent="lavender" to="/admin">
        <ShieldCheck size={20} aria-hidden="true" /><strong>{t('adminAccounts')}</strong>
      </Link>}
    </div>
    {email && <span hidden id="profile-reset-hint">{t('manualRecoveryHint')}</span>}
    <button type="button" className="secondary profile-signout" disabled={busy || sendingReset}
      aria-busy={pending === 'signout'} onClick={() => void signOut()}>
      <LogOut size={17} aria-hidden="true" />{t('signout')}
    </button>
  </>
}

