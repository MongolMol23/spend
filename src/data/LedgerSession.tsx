import { useEffect, useState, type ReactNode } from 'react'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { supabase } from './supabase'

export function useLedgerOwner() {
  const [owner, setOwner] = useState<string | null | undefined>(supabase ? undefined : null)
  useEffect(() => {
    const subscription = supabase?.auth.onAuthStateChange((_event, session) => {
      setOwner(session?.user.email_confirmed_at ? session.user.id : null)
    })
    return () => subscription?.data.subscription.unsubscribe()
  }, [])
  return owner
}

export function LedgerQueries({ children }: { children: ReactNode }) {
  // Mount this provider with the owner as its key to discard private cache on account changes.
  const [queries] = useState(() => new QueryClient())
  return <QueryClientProvider client={queries}>{children}</QueryClientProvider>
}
