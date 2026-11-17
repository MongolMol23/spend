import type { SupabaseClient } from '@supabase/supabase-js'
import type { Database } from '../../data/database.types'

type Client = SupabaseClient<Database>
export type Budget = Database['public']['Functions']['spend_budget_overview']['Returns'][number]
export const budgetKey = ['spending-budget'] as const

export async function readBudget(client: Client, signal?: AbortSignal) {
  const query = client.rpc('spend_budget_overview')
  if (signal) query.abortSignal(signal)
  const { data, error } = await query
  if (error) throw error
  return data[0] ?? null
}

export function budgetProgress(budget: Budget) {
  // Date-only arithmetic counts Cairo calendar days without daylight saving offsets.
  const days = Math.max(0, 1 + (Date.parse(budget.ends_on) - Date.parse(budget.today)) / 86_400_000)
  const balance = budget.amount_minor - budget.spent_minor
  const allowance = days ? Math.max(0, Math.floor((balance + budget.today_minor) / days)) : 0
  return { days, balance, allowance, available: Math.max(0, allowance - budget.today_minor) }
}

export async function budgetWarning(client: Client) {
  try {
    const budget = await readBudget(client)
    if (!budget) return
    const { balance, days, allowance } = budgetProgress(budget)
    if (!days) return
    if (balance < 0) return 'budgetOverTotal' as const
    if (balance === 0) return 'budgetUsedUp' as const
    if (budget.today_minor > allowance) return 'budgetOverToday' as const
  } catch {
    // Failure to refresh the budget must not turn a successful payment into an error.
  }
}
