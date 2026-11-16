import { Toast } from '../../ui/Toast'
import { AppHeader } from '../../app/AppHeader'
import { useEffect, useState } from 'react'
import type { Session } from '@supabase/supabase-js'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { useParams } from 'react-router'
import { ReceiptText } from 'lucide-react'
import { supabase } from '../../data/supabase'
import { AccountForm } from './AccountForm'
import { AuthSwitch } from './AuthSwitch'
import { ProfileSettings } from './ProfileSettings'
import './account.css'

export function Account() {
  const { t } = useTranslation()
  const { mode } = useParams()
  const [session, setSession] = useState<Session | null>()
  const [queryClient] = useState(() => new QueryClient())
  const showProfile = !!session && mode !== 'confirm' && mode !== 'reset'

  useEffect(() => {
    if (!supabase) return
    let userId: string | undefined
    const { data } = supabase.auth.onAuthStateChange((_event, next) => {
      // A refreshed token belongs to the same user. Clear private data only when identity changes.
      if (userId !== next?.user.id) {
        queryClient.clear()
        userId = next?.user.id
      }
      setSession(next)
    })
    return () => data.subscription.unsubscribe()
  }, [queryClient])

  return <>
    <AppHeader authPage={!showProfile} />
    <main className="account-shell" id="main" tabIndex={-1}>
    <div className={showProfile ? 'profile-layout' : 'account-layout'}>
    <QueryClientProvider client={queryClient}>
      {!supabase ? <section className="panel"><h1>{t('account')}</h1><Toast message={t('accountUnavailable')} /></section>
        : mode === 'confirm' || mode === 'reset' ? <AccountForm key={mode} mode={mode} />
        : session === undefined ? <section className="panel"><p className="loading-state" role="status">{t('loading')}</p></section>
        : session ? <ProfileSettings key={session.user.id} userId={session.user.id} email={session.user.email}
          emailVerified={Boolean(session.user.email_confirmed_at)} createdAt={session.user.created_at} />
        : mode === 'forgot' ? <AccountForm key={mode} mode={mode} />
        : <AuthSwitch mode={mode === 'signup' ? 'signup' : 'signin'} />}
    </QueryClientProvider>
    {!showProfile && <aside className="account-story panel">
      <p className="account-story-brand"><bdi>Spend</bdi></p>
      <h2>{t('accountTagline')}</h2>
      <p>{t('accountStory')}</p>
      <div className="account-art" aria-hidden="true">
        <div className="account-ticket">
          <ReceiptText size={27} />
          <i /><i /><i />
        </div>
      </div>
    </aside>}
    </div>
    </main>
  </>
}

