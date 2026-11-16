import { useEffect, useState } from 'react'
import { supabase } from '../../data/supabase'

export async function checkUsernameAvailability(username: string, signal?: AbortSignal) {
  if (!supabase) return undefined
  const request = supabase.rpc('signup_username_available', { requested_username: username })
  const { data, error } = await (signal ? request.abortSignal(signal) : request)
  return error ? undefined : data ?? undefined
}

export function useUsernameAvailability(username: string | undefined) {
  const [result, setResult] = useState<{ username: string; available: boolean }>()

  useEffect(() => {
    if (!username) return
    const controller = new AbortController()
    const timer = window.setTimeout(async () => {
      const available = await checkUsernameAvailability(username, controller.signal)
      if (!controller.signal.aborted && available !== undefined) setResult({ username, available })
    }, 350)
    return () => {
      window.clearTimeout(timer)
      controller.abort()
    }
  }, [username])

  return result && result.username === username ? result.available : undefined
}
