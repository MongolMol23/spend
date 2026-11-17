import type { Database } from '../../data/database.types'
import type { PurchaseClient } from '../purchases/api'

export type MonthlyDue = Database['public']['Functions']['monthly_expense_list']['Returns'][number]
export const monthlyKey = ['monthly-expenses'] as const
export type MonthlyChange =
  | { kind: 'add'; id: string; name: string; amount: number; day: number; category: string }
  | { kind: 'pay'; due: MonthlyDue; expenseId: string; amount: number; date: string }
  | { kind: 'unpay'; due: MonthlyDue; expenseId: string }
  | { kind: 'stop'; due: MonthlyDue }

export async function readMonthly(client: PurchaseClient, month: string, signal: AbortSignal) {
  const { data, error } = await client.rpc('monthly_expense_list', { p_month: month + '-01' }).abortSignal(signal)
  if (error) throw error
  return data
}

export async function changeMonthly(client: PurchaseClient, change: MonthlyChange) {
  const operation = change.kind === 'add'
    ? client.rpc('monthly_expense_add', { p_id: change.id, p_name: change.name, p_amount: change.amount, p_day: change.day, p_category: change.category })
    : change.kind === 'pay'
    ? client.rpc('monthly_expense_pay', { p_due: change.due.id, p_expense: change.expenseId, p_amount: change.amount, p_paid_on: change.date })
    : change.kind === 'unpay'
    ? client.rpc('monthly_expense_unpay', { p_due: change.due.id, p_expense: change.expenseId })
    : client.rpc('monthly_expense_stop', { p_item: change.due.item_id })
  const { error } = await operation
  if (error) throw error
}
