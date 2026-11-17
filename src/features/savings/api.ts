import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { Database, Tables } from '../../data/database.types'
import { toMinorUnits } from '../../data/money'
import { clearRetryKey, retryKey } from '../../data/retryKey'

export type SavingsClient = SupabaseClient<Database>
export type SavingsGoal = Tables<'savings_goals'>
export const savingsKey = ['savings'] as const
export const savingsPageSize = 20
const amount = z.string().transform(toMinorUnits).pipe(z.number())
const date = z.iso.date().refine(value => !value.startsWith('0000'))
export const goalInput = z.object({
  name: z.string().trim().min(1).max(120),
  target: amount,
  targetOn: z.union([date, z.literal('')]),
})
export const movementInput = z.object({ direction: z.enum(['deposit', 'withdraw']), amount, movedOn: date })
export type SavingsChange =
  | { kind: 'save'; goal?: SavingsGoal; input: z.output<typeof goalInput> }
  | { kind: 'move'; goal: SavingsGoal; input: z.output<typeof movementInput> }
  | { kind: 'archive'; goal: SavingsGoal }

export async function changeSavings(client: SavingsClient, owner: string, change: SavingsChange) {
  if (change.kind === 'archive') {
    const { error } = await client.rpc('archive_savings_goal', { p_id: change.goal.id, p_version: change.goal.version })
    if (error) throw error
    return change.goal.id
  }
  if (change.kind === 'move') {
    const { goal, input } = change
    const scope = owner + ':savings:move:' + goal.id
    const { error } = await client.rpc('record_savings_movement', {
      p_id: await retryKey(scope, input), p_goal: goal.id, p_direction: input.direction,
      p_amount: input.amount, p_moved_on: input.movedOn,
    })
    if (error) throw error
    clearRetryKey(scope)
    return goal.id
  }
  const { goal, input } = change
  const scope = owner + ':savings:create'
  const id = goal?.id ?? await retryKey(scope, input)
  const { error } = await client.rpc('save_savings_goal', {
    p_id: id, p_name: input.name, p_target: input.target,
    ...(input.targetOn ? { p_target_on: input.targetOn } : {}),
    ...(goal ? { p_version: goal.version } : {}),
  })
  if (error) throw error
  if (!goal) clearRetryKey(scope)
  return id
}

export async function readSavingsOverview(client: SavingsClient, month: string, signal: AbortSignal) {
  const { data, error } = await client.rpc('savings_overview', { p_month: month + '-01' }).abortSignal(signal).single()
  if (error) throw error
  return data
}

export async function listSavingsGoals(client: SavingsClient, page: number, signal: AbortSignal) {
  const first = page * savingsPageSize
  const { data, error } = await client.from('savings_goals').select('*').is('archived_at', null)
    .order('name').order('id').range(first, first + savingsPageSize).abortSignal(signal)
  if (error) throw error
  return data
}

export async function readSavingsGoal(client: SavingsClient, id: string, signal: AbortSignal) {
  if (!z.uuid().safeParse(id).success) return null
  const { data, error } = await client.from('savings_goals').select('*').eq('id', id).abortSignal(signal).maybeSingle()
  if (error) throw error
  return data
}

export async function listSavingsMovements(client: SavingsClient, id: string, page: number, signal: AbortSignal) {
  const first = page * savingsPageSize
  const { data, error } = await client.from('savings_movements').select('*').eq('goal_id', id)
    .order('moved_on', { ascending: false }).order('id', { ascending: false })
    .range(first, first + savingsPageSize).abortSignal(signal)
  if (error) throw error
  return data
}

export async function listSavingsHistory(client: SavingsClient, page: number, signal: AbortSignal, from: string, until: string) {
  const first = page * savingsPageSize
  const { data, error } = await client.from('personal_activity').select('*')
    .in('entity_type', ['savings_goal', 'savings_movement']).order('id', { ascending: false })
    .gte('created_at', from).lt('created_at', until).range(first, first + savingsPageSize).abortSignal(signal)
  if (error) throw error
  return data
}
