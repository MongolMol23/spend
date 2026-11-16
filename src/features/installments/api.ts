import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { Database, Tables } from '../../data/database.types'
import { toMinorUnits } from '../../data/money'
import { clearRetryKey, retryKey } from '../../data/retryKey'

export type InstallmentClient = SupabaseClient<Database>
export type Plan = Tables<'installment_plans'>
export type Due = Tables<'installment_dues'>
export const installmentKey = ['installments'] as const
export const installmentPageSize = 20
export const scheduleLimit = 120
const amount = z.string().transform(toMinorUnits).pipe(z.number())
const date = z.iso.date().refine(value => !value.startsWith('0000'))
export const scheduleEntry = z.object({ due_on: date, amount_minor: z.number().int().positive() })
export const planInput = z.object({
  name: z.string().trim().min(1).max(120),
  total: amount,
  schedule: z.array(scheduleEntry).min(1).max(scheduleLimit),
}).refine(input => input.schedule.reduce((sum, due) => sum + due.amount_minor, 0) === input.total)
export const paymentInput = z.object({ amount, paidOn: date })

export type InstallmentChange =
  | { kind: 'save'; plan?: Plan; input: z.output<typeof planInput> }
  | { kind: 'pay'; plan: Plan; due: Due; input: z.output<typeof paymentInput> }
  | { kind: 'archive'; plan: Plan }

export async function changeInstallment(client: InstallmentClient, owner: string, change: InstallmentChange) {
  if (change.kind === 'archive') {
    const { error } = await client.rpc('archive_installment_plan', { p_id: change.plan.id, p_version: change.plan.version })
    if (error) throw error
    return change.plan.id
  }
  if (change.kind === 'pay') {
    const { due, input } = change
    const scope = owner + ':installments:pay:' + due.id
    const { error } = await client.rpc('record_installment_payment', {
      p_id: await retryKey(scope, input), p_due: due.id, p_amount: input.amount, p_paid_on: input.paidOn,
    })
    if (error) throw error
    clearRetryKey(scope)
    return change.plan.id
  }
  const { plan, input } = change
  const scope = owner + ':installments:create'
  const id = plan?.id ?? await retryKey(scope, input)
  const { error } = await client.rpc('save_installment_plan', {
    p_id: id, p_name: input.name, p_total: input.total, p_schedule: input.schedule,
    ...(plan ? { p_version: plan.version } : {}),
  })
  if (error) throw error
  if (!plan) clearRetryKey(scope)
  return id
}

export async function readInstallmentOverview(client: InstallmentClient, month: string, signal: AbortSignal) {
  const { data, error } = await client.rpc('installment_overview', { p_month: month + '-01' }).abortSignal(signal).single()
  if (error) throw error
  return data
}

export async function listInstallmentPlans(client: InstallmentClient, page: number, signal: AbortSignal) {
  const first = page * installmentPageSize
  const { data, error } = await client.from('installment_plans').select('id,name,total_minor').is('archived_at', null)
    .order('name').order('id').range(first, first + installmentPageSize).abortSignal(signal)
  if (error) throw error
  return data
}

export async function readInstallmentPlan(client: InstallmentClient, id: string, signal: AbortSignal) {
  if (!z.uuid().safeParse(id).success) return null
  const { data, error } = await client.from('installment_plans').select('*, installment_dues(*)')
    .eq('id', id).order('due_on', { referencedTable: 'installment_dues' })
    .order('id', { referencedTable: 'installment_dues' }).abortSignal(signal).maybeSingle()
  if (error) throw error
  return data
}

export async function listInstallmentHistory(client: InstallmentClient, page: number, signal: AbortSignal, from: string, until: string) {
  const first = page * installmentPageSize
  const { data, error } = await client.from('personal_activity').select('*')
    .in('entity_type', ['installment_plan', 'installment_payment']).order('id', { ascending: false })
    .gte('created_at', from).lt('created_at', until).range(first, first + installmentPageSize).abortSignal(signal)
  if (error) throw error
  return data
}
