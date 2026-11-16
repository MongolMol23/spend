// Use Cairo calendar dates consistently in entry forms, due dates and monthly totals.
export function ledgerToday(date = new Date()) {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: 'Africa/Cairo', year: 'numeric', month: '2-digit', day: '2-digit',
  }).formatToParts(date)
  return ['year', 'month', 'day'].map(type => parts.find(part => part.type === type)?.value).join('-')
}

export function shiftLedgerDay(day: string, days: number) {
  const date = new Date(day + 'T00:00:00Z')
  date.setUTCDate(date.getUTCDate() + days)
  return date.toISOString().split('T')[0]
}

const cairoClock = new Intl.DateTimeFormat('en', {
  timeZone: 'Africa/Cairo', timeZoneName: 'longOffset',
})

export function cairoDayStart(day: string) {
  const midnight = Date.parse(day + 'T00:00:00Z')
  // Compare offsets on both sides of Cairo's midnight clock changes.
  const candidates = [-4, 0].map(hour => {
    const probe = new Date(midnight + hour * 3_600_000)
    const offset = cairoClock.formatToParts(probe).find(part => part.type === 'timeZoneName')?.value ?? 'GMT'
    const [hours = 0, minutes = 0, seconds = 0] = offset.slice(4).split(':').map(Number)
    const sign = offset[3] === '-' ? -1 : 1
    return midnight - sign * (hours * 3600 + minutes * 60 + seconds) * 1000
  })
  return new Date(Math.max(...candidates)).toISOString()
}
