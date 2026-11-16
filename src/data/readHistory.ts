export async function readHistory<T>(size: number, readPage: (page: number) => Promise<T[]>) {
  const entries: T[] = []
  for (let page = 0; ; page += 1) {
    const batch = await readPage(page)
    // Each query requests one extra row to check whether another batch exists.
    entries.push(...batch.slice(0, size))
    if (batch.length <= size) return entries
  }
}
