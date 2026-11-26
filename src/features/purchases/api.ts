import type { SupabaseClient } from '@supabase/supabase-js'
import { z } from 'zod'
import type { Database, Tables } from '../../data/database.types'
import { toMinorUnits } from '../../data/money'

export type PurchaseClient = SupabaseClient<Database>
export type Expense = Tables<'expenses'>
export const expenseCategories = ['groceries', 'transport', 'dining', 'bills', 'health', 'shopping', 'entertainment', 'other'] as const
export type ExpenseCategory = typeof expenseCategories[number]
export const purchasesKey = ['purchases'] as const
export const purchasePageSize = 15

export const purchaseInput = z.object({
  item: z.string().trim().min(1).max(120),
  amount: z.string().transform(toMinorUnits).pipe(z.number()),
  category: z.enum(expenseCategories),
  spentOn: z.iso.date().refine(date => !date.startsWith('0000')),
  note: z.string().max(500),
})
export type PurchaseInput = z.output<typeof purchaseInput>

export { ledgerToday as purchaseToday } from '../../data/calendar'

function monthRange(month: string) {
  const [year, number] = month.split('-').map(Number)
  const nextYear = number === 12 ? year + 1 : year
  const nextMonth = number === 12 ? 1 : number + 1
  return { start: month + '-01', end: String(nextYear).padStart(4, '0') + '-' + String(nextMonth).padStart(2, '0') + '-01' }
}

export function categoryLabel(category: string): ExpenseCategory {
  return expenseCategories.find(value => value === category) ?? 'other'
}

export async function monthlyPurchases(client: PurchaseClient, month: string, signal: AbortSignal) {
  const { data, error } = await client.rpc('expense_month_summary', { p_month: month + '-01' }).abortSignal(signal)
  if (error) throw error
  return data
}

export async function recentPurchases(client: PurchaseClient, signal: AbortSignal) {
  const { data, error } = await client.from('expenses').select('id,item,amount_minor,spent_on').is('archived_at', null)
    .order('spent_on', { ascending: false }).order('id', { ascending: false }).limit(5).abortSignal(signal)
  if (error) throw error
  return data
}

export async function listPurchases(
  client: PurchaseClient, month: string, category: string, page: number, signal: AbortSignal,
) {
  const { start, end } = monthRange(month)
  const first = page * purchasePageSize
  const query = client.from('expenses').select('*')
    .is('archived_at', null).gte('spent_on', start).lt('spent_on', end)
    .order('spent_on', { ascending: false }).order('id', { ascending: false })
  if (category) query.eq('category', category)
  const { data, error } = await query.range(first, first + purchasePageSize).abortSignal(signal)
  if (error) throw error
  return data
}

export async function listPurchaseGroups(
  client: PurchaseClient, month: string, page: number, signal: AbortSignal,
) {
  const { data, error } = await client.rpc('purchase_list_groups', {
    p_month: month + '-01', p_category: null, p_offset: page * purchasePageSize,
  }).abortSignal(signal)
  if (error) throw error
  return data
}

export async function purchaseHistory(client: PurchaseClient, page: number, signal: AbortSignal, from: string, until: string) {
  const first = page * purchasePageSize
  const { data, error } = await client.from('personal_activity').select('*').eq('entity_type', 'purchase')
    .order('id', { ascending: false }).gte('created_at', from).lt('created_at', until).range(first, first + purchasePageSize).abortSignal(signal)
  if (error) throw error
  return data
}
