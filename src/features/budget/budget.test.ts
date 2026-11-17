import { expect, test } from 'vitest'
import { budgetProgress, type Budget } from './budget'

const budget: Budget = {
  amount_minor: 100_000,
  starts_on: '2026-11-17',
  ends_on: '2026-11-26',
  today: '2026-11-17',
  spent_minor: 0,
  today_minor: 0,
}

test('counts the last day and carries unused money forward', () => {
  expect(budgetProgress(budget)).toMatchObject({ days: 10, available: 10_000 })
  expect(budgetProgress({ ...budget, today: '2026-11-18' }))
    .toMatchObject({ days: 9, available: 11_111 })
})

test('subtracts today’s purchases from today’s share once', () => {
  expect(budgetProgress({ ...budget, spent_minor: 4_000, today_minor: 4_000 }))
    .toMatchObject({ balance: 96_000, allowance: 10_000, available: 6_000 })
})

test('keeps the overspend visible and never suggests spending a negative amount', () => {
  expect(budgetProgress({ ...budget, spent_minor: 105_000, today_minor: 8_000 }))
    .toMatchObject({ balance: -5_000, available: 0 })
})

test('shows the full balance on the last day and stops daily suggestions afterward', () => {
  expect(budgetProgress({ ...budget, today: '2026-11-26', spent_minor: 91_000 }))
    .toMatchObject({ days: 1, available: 9_000 })
  expect(budgetProgress({ ...budget, today: '2026-11-27', spent_minor: 91_000 }))
    .toMatchObject({ days: 0, balance: 9_000, available: 0 })
})
