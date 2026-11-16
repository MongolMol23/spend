import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../data/database.types'

export type Client = SupabaseClient<Database>
export type MoneyRequest = Database['public']['Tables']['money_requests']['Row']
export type RunAction = (operation: () => PromiseLike<{ error: unknown }>, done?: () => void) => Promise<void>

export async function loadConnections(client: Client, signal: AbortSignal) {
  const [profile, names, friendships, requests, payments, corrections] = await Promise.all([
    client.from('profiles').select('id').abortSignal(signal).maybeSingle(),
    client.rpc('connection_names').abortSignal(signal),
    client.from('friendships').select('*').abortSignal(signal),
    client.from('money_requests').select('*').order('created_at', { ascending: false }).abortSignal(signal),
    client.from('request_payments').select('*').order('created_at').abortSignal(signal),
    client.from('request_corrections').select('*').order('created_at').abortSignal(signal),
  ])
  if (profile.error || names.error || friendships.error || requests.error || payments.error || corrections.error) throw new Error('connections_load')
  return { profile: profile.data, names: names.data, friendships: friendships.data, requests: requests.data, payments: payments.data, corrections: corrections.data }
}

export const requestHistoryPageSize = 20

export async function listRequestHistory(client: Client, id: string, page: number, from: string, until: string, signal: AbortSignal) {
  const first = page * requestHistoryPageSize
  const { data, error } = await client.from('request_events').select('*').eq('request_id', id)
    .gte('created_at', from).lt('created_at', until).order('id', { ascending: false })
    .range(first, first + requestHistoryPageSize).abortSignal(signal)
  if (error) throw error
  return data
}

export { toMinorUnits } from '../../data/money'

