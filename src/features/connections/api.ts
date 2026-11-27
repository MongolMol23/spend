import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../data/database.types'

export type Client = SupabaseClient<Database>
export type MoneyRequest = Database['public']['Tables']['money_requests']['Row']
export type Person = Database['public']['Functions']['connection_names']['Returns'][number]
export type RequestPayment = Database['public']['Tables']['request_payments']['Row']
export type RequestCorrection = Database['public']['Tables']['request_corrections']['Row']
export type RunAction = (action: string, operation: () => PromiseLike<{ error: unknown }>, done?: () => void) => Promise<void>

export const requestAuthor = (request: MoneyRequest) => request.is_offer ? request.recipient : request.sender
export const requestTarget = (request: MoneyRequest) => request.is_offer ? request.sender : request.recipient
export const isSharedDebt = (request: MoneyRequest) => request.state === 'accepted' || request.state === 'settled'
export const sharedDebtPath = (request: MoneyRequest, userId: string) =>
  '/debts?' + new URLSearchParams({ ...(request.sender === userId ? { direction: 'owed' } : {}), request: request.id })

export function connectionPeople(data: { names: Person[]; friendships: Database['public']['Tables']['friendships']['Row'][] }, userId: string) {
  const names = new Map(data.names.map(person => [person.id, person]))
  const friends = data.friendships.filter(friend => friend.state === 'accepted').flatMap(friend => {
    const person = names.get(friend.sender === userId ? friend.recipient : friend.sender)
    return person ? [person] : []
  })
  return { names, friends }
}

export async function loadRequest(client: Client, id: string, signal: AbortSignal) {
  const [request, names, payments, corrections] = await Promise.all([
    client.from('money_requests').select('*').eq('id', id).abortSignal(signal).maybeSingle(),
    client.rpc('connection_names').abortSignal(signal),
    client.from('request_payments').select('*').eq('request_id', id).order('created_at', { ascending: false }).abortSignal(signal),
    client.from('request_corrections').select('*').eq('request_id', id).order('created_at', { ascending: false }).abortSignal(signal),
  ])
  if (request.error || names.error || payments.error || corrections.error) throw new Error('request_load')
  return { request: request.data, names: new Map(names.data.map(person => [person.id, person])), payments: payments.data, corrections: corrections.data }
}

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

