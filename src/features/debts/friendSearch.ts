import type { Person } from '../connections/api'

const maxSuggestions = 5

function normalize(value: string) {
  return value.normalize('NFKD').replace(/\p{M}|ـ/gu, '').replace(/ٱ/g, 'ا').replace(/ى/g, 'ي')
    .toLowerCase().trim().replace(/\s+/g, ' ')
}

export function indexDebtFriends(friends: readonly Person[]) {
  return friends.map(person => {
    const name = normalize(person.display_name)
    const username = normalize(person.username)
    return { person, name, username, words: (name + ' ' + username).split(/[\s_]+/) }
  })
}

export function searchDebtFriends(index: ReturnType<typeof indexDebtFriends>, value: string) {
  const usernameOnly = value.trimStart().startsWith('@')
  const query = normalize(value.trimStart().replace(/^@/, ''))
  if (!query) return []

  const words = query.split(' ')
  const results: Person[][] = [[], [], [], []]
  for (const { person, name, username, words: candidateWords } of index) {
    const rank = username === query || (!usernameOnly && name === query) ? 0
      : username.startsWith(query) || (!usernameOnly && name.startsWith(query)) ? 1
      : !usernameOnly && words.every(word => candidateWords.some(candidate => candidate.startsWith(word))) ? 2
      : username.includes(query) || (!usernameOnly && words.every(word => name.includes(word))) ? 3
      : -1
    if (rank >= 0 && results[rank].length < maxSuggestions) results[rank].push(person)
  }
  return results.flat().slice(0, maxSuggestions)
}
