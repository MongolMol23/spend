// Preserve the same operation key after a lost response or reload in this tab.
// Only a digest of the form payload is stored, never the reason text.
export async function retryKey(scope: string, payload: unknown) {
  const digest = await crypto.subtle.digest('SHA-256', new TextEncoder().encode(JSON.stringify(payload)))
  const fingerprint = Array.from(new Uint8Array(digest), byte => byte.toString(16).padStart(2, '0')).join('')
  const storageKey = 'spend-operation:' + scope
  try {
    const raw = sessionStorage.getItem(storageKey)
    const previous = raw ? JSON.parse(raw) as { fingerprint: string; key: string } : null
    if (previous?.fingerprint === fingerprint && previous.key) return previous.key
    const key = crypto.randomUUID()
    sessionStorage.setItem(storageKey, JSON.stringify({ fingerprint, key }))
    return key
  } catch {
    // Refuse a submission when retry safety cannot survive a reload.
    throw new Error('retry_storage_unavailable')
  }
}

export function clearRetryKey(scope: string) {
  try { sessionStorage.removeItem('spend-operation:' + scope) } catch { /* The operation was already saved. */ }
}

