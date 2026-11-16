import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { Database, Tables } from '../../data/database.types'
import { toMinorUnits } from '../../data/money'
import { clearRetryKey, retryKey } from '../../data/retryKey'

export type DebtClient = SupabaseClient<Database>
export type PrivateDebt = Tables<'private_debts'>
export type DebtOverview = Database['public']['Functions']['debt_overview']['Returns'][number]
export const debtKey = ['private-debts'] as const
export const debtPageSize = 20
const date = z.iso.date().refine(value => !value.startsWith('0000'))
const amount = z.string().transform(toMinorUnits).pipe(z.number())
export const debtInput = z.object({
  contact: z.string().trim().min(1).max(120),
  direction: z.enum(['owed', 'owe']),
  amount,
  dueOn: z.union([date, z.literal('')]),
})
export const paymentInput = z.object({ amount, paidOn: date })

export type DebtChange =
  | { kind: 'save'; debt?: PrivateDebt; input: z.output<typeof debtInput> }
  | { kind: 'pay'; debt: PrivateDebt; input: z.output<typeof paymentInput> }
  | { kind: 'archive'; debt: PrivateDebt }

export async function changeDebt(client: DebtClient, owner: string, change: DebtChange) {
  if (change.kind === 'archive') {
    const { error } = await client.rpc('archive_private_debt', { p_id: change.debt.id, p_version: change.debt.version })
    if (error) throw error
    return change.debt.id
  }
  if (change.kind === 'pay') {
    const scope = owner + ':debt:pay:' + change.debt.id
    const { error } = await client.rpc('record_private_debt_payment', {
      p_id: await retryKey(scope, change.input),
      p_debt: change.debt.id,
      p_amount: change.input.amount,
      p_paid_on: change.input.paidOn,
    })
    if (error) throw error
    clearRetryKey(scope)
    return change.debt.id
  }
  const { input, debt } = change
  const scope = owner + ':debt:create'
  const id = debt?.id ?? await retryKey(scope, input)
  const { error } = await client.rpc('save_private_debt', {
    p_id: id, p_contact: input.contact, p_direction: input.direction, p_amount: input.amount,
    ...(input.dueOn ? { p_due_on: input.dueOn } : {}),
    ...(debt ? { p_version: debt.version } : {}),
  })
  if (error) throw error
  if (!debt) clearRetryKey(scope)
  return id
}

export async function debtOverview(client: DebtClient, signal: AbortSignal) {
  const { data, error } = await client.rpc('debt_overview').abortSignal(signal).single()
  if (error) throw error
  return data
}

export async function listDebts(client: DebtClient, page: number, signal: AbortSignal) {
  const first = page * debtPageSize
  const { data, error } = await client.from('private_debts').select('*').is('archived_at', null)
    .order('contact').order('id').range(first, first + debtPageSize).abortSignal(signal)
  if (error) throw error
  return data
}

export async function readDebt(client: DebtClient, id: string, signal: AbortSignal) {
  if (!z.uuid().safeParse(id).success) return null
  const { data, error } = await client.from('private_debts').select('*').eq('id', id)
    .is('archived_at', null).abortSignal(signal).maybeSingle()
  if (error) throw error
  return data
}

export async function listDebtPayments(client: DebtClient, id: string, page: number, signal: AbortSignal, from: string, until: string) {
  const first = page * debtPageSize
  const { data, error } = await client.from('private_debt_payments').select('*').eq('debt_id', id)
    .order('paid_on', { ascending: false }).order('id', { ascending: false })
    .gte('paid_on', from).lt('paid_on', until).range(first, first + debtPageSize).abortSignal(signal)
  if (error) throw error
  return data
}

export async function listDebtHistory(client: DebtClient, page: number, signal: AbortSignal, from: string, until: string) {
  const first = page * debtPageSize
  const { data, error } = await client.from('personal_activity').select('*')
    .in('entity_type', ['private_debt', 'private_debt_payment']).order('id', { ascending: false })
    .gte('created_at', from).lt('created_at', until).range(first, first + debtPageSize).abortSignal(signal)
  if (error) throw error
  return data
}
