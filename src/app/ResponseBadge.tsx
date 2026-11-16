import { Bell } from 'lucide-react'
import { useEffect, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { supabase } from '../data/supabase'

export function ResponseBadge({ userId }: { userId?: string }) {
  const { t, i18n } = useTranslation()
  const [result, setResult] = useState<{ userId: string; count: number }>()

  useEffect(() => {
    const client = supabase
    if (!client || !userId) return
    const controller = new AbortController()
    let refreshing = false

    async function refresh() {
      if (!client || !userId || refreshing) return
      refreshing = true
      try {
        const [friends, requests] = await Promise.all([
          client.from('friendships').select('id', { count: 'exact', head: true })
            .eq('recipient', userId).eq('state', 'pending').abortSignal(controller.signal),
          client.from('money_requests').select('id', { count: 'exact', head: true })
            .eq('recipient', userId).eq('state', 'pending').abortSignal(controller.signal),
        ])
        if (!controller.signal.aborted && friends.count !== null && requests.count !== null) {
          setResult({ userId, count: friends.count + requests.count })
        }
      } finally {
        refreshing = false
      }
    }

    void refresh()
    const timer = window.setInterval(() => void refresh(), 3000)
    return () => {
      window.clearInterval(timer)
      controller.abort()
    }
  }, [userId])

  if (!userId) return null
  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-EG'
  const count = result?.userId === userId ? new Intl.NumberFormat(locale).format(result.count) : '…'
  const label = t('needsResponse')
  return <Link className="header-response" to="/connections" aria-label={label + ' · ' + count} title={label}>
    <Bell size={17} aria-hidden="true" />
    <bdi>{count}</bdi>
  </Link>
}
