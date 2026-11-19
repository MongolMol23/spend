import type { Database } from '../../data/database.types'
import { clearRetryKey, retryKey } from '../../data/retryKey'
import type { PurchaseClient } from '../purchases/api'

export type MonthlyDue = Database['public']['Functions']['monthly_expense_list']['Returns'][number]
export const monthlyKey = ['monthly-expenses'] as const
export type MonthlyChange =
  | { kind: 'add'; id: string; name: string; amount: number; day: number; category: string }
  | { kind: 'pay'; due: MonthlyDue; amount: number; date: string }
  | { kind: 'unpay'; due: MonthlyDue; expenseId: string }
  | { kind: 'stop' | 'remove'; due: MonthlyDue }

export async function readMonthly(client: PurchaseClient, month: string, signal: AbortSignal) {
  const { data, error } = await client.rpc('monthly_expense_list', { p_month: month + '-01' }).abortSignal(signal)
  if (error) throw error
  return data
}

export async function changeMonthly(client: PurchaseClient, owner: string, change: MonthlyChange) {
  if (change.kind === 'pay') {
    const scope = owner + ':monthly:pay:' + change.due.id
    const expenseId = await retryKey(scope, { amount: change.amount, date: change.date })
    const { error } = await client.rpc('monthly_expense_pay', {
      p_due: change.due.id, p_expense: expenseId, p_amount: change.amount, p_paid_on: change.date,
    })
    if (error) throw error
    clearRetryKey(scope)
    return
  }
  const operation = change.kind === 'add'
    ? client.rpc('monthly_expense_add', { p_id: change.id, p_name: change.name, p_amount: change.amount, p_day: change.day, p_category: change.category })
    : change.kind === 'unpay'
    ? client.rpc('monthly_expense_unpay', { p_due: change.due.id, p_expense: change.expenseId })
    : client.rpc(change.kind === 'stop' ? 'monthly_expense_stop' : 'monthly_expense_remove', { p_item: change.due.item_id })
  const { error } = await operation
  if (error) throw error
}
