import { useState } from 'react'
import { useTranslation } from 'react-i18next'
import { ledgerToday, shiftLedgerDay } from '../data/calendar'
import { HistoryCalendar } from './HistoryCalendar'

export function useHistoryDates() {
  const today = ledgerToday()
  const [day, setDay] = useState('')
  const from = day || shiftLedgerDay(today, -4)
  const until = shiftLedgerDay(day || today, 1)

  return { today, day, from, until, selectDay: setDay }
}

export function HistoryDates({ today, day, selectDay }: ReturnType<typeof useHistoryDates>) {
  const { t } = useTranslation()

  return <div className="history-dates">
    <div className="history-day-strip" role="group" aria-label={t('historyQuickFilters')}>
      <button type="button" className={day === today ? 'primary' : 'secondary'}
        aria-pressed={day === today} onClick={() => selectDay(today)}>{t('historyToday')}</button>
      <button type="button" className={day ? 'secondary' : 'primary'} aria-pressed={!day}
        onClick={() => selectDay('')}>{t('historyRecentDays')}</button>
    </div>
    <HistoryCalendar day={day} today={today} selectDay={selectDay} />
  </div>
}
