import { FeatureHeading } from '../../ui/FeatureHeading'
import { UsersRound } from 'lucide-react'
import { Toast } from '../../ui/Toast'
import { SignInLink } from '../accounts/SignInLink'
import { useEffect, useState } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { supabase } from '../../data/supabase'
import { ConnectionsWorkspace } from './ConnectionsWorkspace'
import './connections.css'

export function Connections() {
  const { t } = useTranslation()
  const [userId, setUserId] = useState<string | null>()
  const [queries] = useState(() => new QueryClient())

  useEffect(() => {
    if (!supabase) return
    let owner: string | undefined
    const { data } = supabase.auth.onAuthStateChange((_event, session) => {
      if (owner !== session?.user.id) {
        queries.clear()
        owner = session?.user.id
      }
      setUserId(owner ?? null)
    })
    return () => data.subscription.unsubscribe()
  }, [queries])

  return <main id="main" tabIndex={-1} className="shell connections">
    <FeatureHeading title={t('connections')} icon={UsersRound} accent="mint" />
    <QueryClientProvider client={queries}>
      {!supabase ? <Toast message={t('accountUnavailable')} />
        : userId === undefined ? <p className="loading-state" role="status">{t('loading')}</p>
        : userId === null ? <SignInLink />
        : <ConnectionsWorkspace key={userId} client={supabase} userId={userId} />}
    </QueryClientProvider>
  </main>
}

