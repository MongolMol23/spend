import { useState } from 'react'
import type { RunAction } from './api'

export function useConnectionAction(refresh: () => Promise<unknown>) {
  const [pending, setPending] = useState<string>()
  const [feedback, setFeedback] = useState<'connectionSaved' | 'requestSent' | 'connectionError' | 'friendExists' | 'correctionStale' | 'invalidCorrection'>()
  const run: RunAction = async (action, operation, done) => {
    if (pending) return
    setPending(action)
    setFeedback(undefined)
    try {
      const { error } = await operation()
      if (error) throw error
      done?.()
      setFeedback(action === 'send-request' ? 'requestSent' : 'connectionSaved')
      await refresh()
    } catch (error) {
      const message = typeof error === 'object' && error !== null && 'message' in error ? error.message : ''
      setFeedback(message === 'friend_exists' ? 'friendExists' : message === 'stale_correction'
        ? 'correctionStale' : message === 'invalid_correction' ? 'invalidCorrection' : 'connectionError')
      await refresh()
    } finally {
      setPending(undefined)
    }
  }
  return { pending, busy: pending !== undefined, feedback, run }
}
