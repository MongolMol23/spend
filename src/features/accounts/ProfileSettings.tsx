import { Toast } from '../../ui/Toast'
import { useState, type FormEvent } from 'react'
import { useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { CalendarDays, Copy, LogOut, Mail, Shield, UserRound, UserRoundPen, UsersRound } from 'lucide-react'
import { Link } from 'react-router'
import type { Label } from '../../i18n/locales'
import { supabase } from '../../data/supabase'
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
  const [busy, setBusy] = useState(false)
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
    setBusy(true)
    try {
      const { language, name_ar, name_en } = result.data
      // Connections still use the single display_name returned by their database functions.
      const updated = { id: userId, ...result.data, display_name: language === 'ar' ? name_ar : name_en }
      const { error: failure } = await client.from('profiles').upsert(updated)
      if (failure?.code === '23505') return setError('usernameTaken')
      if (failure) throw failure
      queryClient.setQueryData(queryKey, updated)
      setNotice('profileSaved')
    } catch {
      setError('accountError')
    } finally {
      setBusy(false)
    }
  }

  async function signOut() {
    setBusy(true)
    try {
      const { error: failure } = await client.auth.signOut()
      if (failure) throw failure
    } catch {
      setError('accountError')
    } finally {
      setBusy(false)
    }
  }

  return <>
    <header className="panel profile-header">
      <div className="profile-intro">
        <div className="profile-avatar" aria-hidden="true">{initial || <UserRound size={24} />}</div>
        <div className="profile-identity">
        <h1><bdi>{name || t('account')}</bdi></h1>
        {details?.username && <div className="profile-handle">
          <bdi>@{details.username}</bdi>
          <button type="button" className="secondary profile-copy" title={t('copyUsername')} aria-label={t('copyUsername')}
            onClick={() => void copyUsername(details.username)}>
            <Copy size={15} aria-hidden="true" />
          </button>
        </div>}
        </div>
      </div>
      {(email || joinedLabel) && <div className="profile-meta">
        {email && <p className="profile-email"><Mail size={16} aria-hidden="true" /><bdi>{email}</bdi>
          <span className="status" data-state={emailVerified ? 'accepted' : 'pending'}>{t(emailVerified ? 'emailVerified' : 'emailUnverified')}</span>
        </p>}
        {joinedLabel && <p className="profile-member">
          <CalendarDays size={16} aria-hidden="true" />
          <span>{t('memberSince')} <time dateTime={createdAt}>{joinedLabel}</time></span>
        </p>}
      </div>}
    </header>
    <section className="panel profile-details" aria-labelledby="profile-details-title">
    <h2 id="profile-details-title" className="section-heading">
      <span className="icon-tile" aria-hidden="true"><UserRoundPen size={18} /></span>{t('profileDetails')}
    </h2>
    {profile.isPending && <p className="loading-state" role="status">{t('loading')}</p>}
    {profile.isError && <Toast message={t('accountError')} />}
    {profile.isSuccess && <form className="account-form" onSubmit={save} noValidate>
      <label>{t('username')}<input name="username" defaultValue={profile.data?.username} autoComplete="username" required dir="ltr" /></label>
      <label>{t('nameArabic')}<input name="name_ar" defaultValue={arabicName} maxLength={80} required dir="rtl" /></label>
      <label>{t('nameEnglish')}<input name="name_en" defaultValue={englishName} maxLength={80} required dir="ltr" /></label>
      <button className="primary" disabled={busy}>{t('saveProfile')}</button>
    </form>}
    {error && <Toast message={t(error)} />}
    {notice && <Toast kind="success" message={t(notice)} />}
    </section>
    {email && <section className="panel profile-security" aria-labelledby="profile-security-title">
      <span className="icon-tile" aria-hidden="true"><Shield size={23} /></span>
      <div className="profile-security-copy">
        <h2 id="profile-security-title">{t('accountSecurity')}</h2>
        <p>{t('manualRecoveryHint')}</p>
      </div>
      <button type="button" className="primary" disabled={sendingReset} onClick={() => void sendPasswordLink()}>
        {t('changePassword')}
      </button>
    </section>}
    <footer className="profile-actions">
      {admin.data && <Link className="secondary profile-shortcut" to="/admin">{t('adminAccounts')}</Link>}
      <Link className="secondary profile-shortcut" to="/connections">
        <UsersRound size={17} aria-hidden="true" />{t('connections')}
      </Link>
      <button className="secondary" disabled={busy} onClick={() => void signOut()}>
        <LogOut size={17} aria-hidden="true" />{t('signout')}
      </button>
    </footer>
  </>
}

