import { expect, test } from 'vitest'
import { indexDebtFriends, searchDebtFriends } from './friendSearch'

const index = indexDebtFriends([
  { id: 'substring', username: 'khalil', display_name: 'Khalil' },
  { id: 'part', username: 'sara_ali', display_name: 'Sara Ali' },
  { id: 'prefix', username: 'alina', display_name: 'Alina' },
  { id: 'exact', username: 'ali', display_name: 'Ali' },
  { id: 'arabic', username: 'ahmed22', display_name: 'أَحْمَد عَلِيّ' },
])

test('puts exact matches before prefixes, word matches, and substrings', () => {
  expect(searchDebtFriends(index, 'ali').map(person => person.id)).toEqual(['exact', 'prefix', 'part', 'substring'])
  expect(searchDebtFriends(index, '@SARA').map(person => person.id)).toEqual(['part'])
})

test('matches Arabic names without spelling marks and clears empty suggestions', () => {
  expect(searchDebtFriends(index, 'علي احمد').map(person => person.id)).toEqual(['arabic'])
  for (const value of ['', '   ', '@']) expect(searchDebtFriends(index, value)).toEqual([])
})
