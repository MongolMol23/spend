import { Modal } from './Modal'
import { useId, useRef, useState } from 'react'
import { CalendarDays, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { shiftLedgerDay } from '../data/calendar'
import { Select } from './Select'

export function HistoryCalendar({ day, today, selectDay }: {
  day: string
  today: string
  selectDay: (day: string) => void
}) {
  const { t, i18n } = useTranslation()
  const dialog = useRef<HTMLDialogElement>(null)
  const title = useId()
  const [month, setMonth] = useState(today.slice(0, 7))
  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-EG'
  const fullDate = new Intl.DateTimeFormat(locale, { dateStyle: 'long', timeZone: 'UTC' })
  const monthName = new Intl.DateTimeFormat(locale, { month: 'long', timeZone: 'UTC' })
  const weekday = new Intl.DateTimeFormat(locale, { weekday: 'short', timeZone: 'UTC' })
  const number = new Intl.NumberFormat(locale, { useGrouping: false })
  const first = month + '-01'
  const offset = new Date(first).getUTCDay()
  const year = month.slice(0, 4)
  const currentYear = Number(today.slice(0, 4))
  const monthCount = Number(year) === currentYear ? Number(today.slice(5, 7)) : 12

  return <>
    <button type="button" className="secondary" aria-haspopup="dialog" onClick={() => {
      setMonth((day || today).slice(0, 7))
      dialog.current?.showModal()
    }}>
      <CalendarDays size={17} aria-hidden="true" />{day ? fullDate.format(new Date(day)) : t('historyChooseDay')}
    </button>
    <Modal ref={dialog} className="panel history-calendar-dialog" aria-labelledby={title}>
      <header>
        <strong id={title}>{t('historyChooseDay')}</strong>
        <button type="button" className="sidebar-close" aria-label={t('cancelPurchase')} onClick={() => dialog.current?.close()}>
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      <div className="history-calendar-controls">
        <Select aria-label={t('purchaseMonth')} value={month.slice(5)} onChange={event => setMonth(year + '-' + event.target.value)}>
          {Array.from({ length: monthCount }, (_, index) => {
            const value = String(index + 1).padStart(2, '0')
            return <option key={value} value={value}>{monthName.format(new Date(year + '-' + value + '-01'))}</option>
          })}
        </Select>
        <Select aria-label={t('historyYear')} value={year} onChange={event => {
          const nextYear = event.target.value
          const nextMonth = nextYear === today.slice(0, 4) && month.slice(5) > today.slice(5) ? today.slice(5) : month.slice(5)
          setMonth(nextYear + '-' + nextMonth)
        }}>
          {Array.from({ length: currentYear }, (_, index) => {
            const value = currentYear - index
            return <option key={value} value={String(value).padStart(4, '0')}>{number.format(value)}</option>
          })}
        </Select>
      </div>
      <div className="history-calendar-grid">
        {Array.from({ length: 7 }, (_, index) =>
          <span key={index}>{weekday.format(new Date(Date.UTC(2024, 0, 7 + index)))}</span>)}
        {Array.from({ length: offset }, (_, index) => <span key={'blank-' + index} aria-hidden="true" />)}
        {Array.from({ length: 31 }, (_, index) => shiftLedgerDay(first, index))
          .filter(value => value.startsWith(month)).map(value =>
            <button key={value} type="button" disabled={value > today} aria-label={fullDate.format(new Date(value))}
              aria-current={value === today ? 'date' : undefined} aria-pressed={value === day}
              onClick={() => { selectDay(value); dialog.current?.close() }}>
              {number.format(Number(value.slice(8)))}
            </button>)}
      </div>
    </Modal>
  </>
}
