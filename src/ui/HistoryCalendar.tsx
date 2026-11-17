import { Modal } from './Modal'
import { useId, useRef, useState } from 'react'
import { CalendarDays, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { shiftLedgerDay } from '../data/calendar'
import { Select } from './Select'
import './history.css'

export function HistoryCalendar({ day, today, selectDay, min = '0001-01-01', max = today, label, triggerId }: {
  day: string
  today: string
  selectDay: (day: string) => void
  min?: string
  max?: string
  label?: string
  triggerId?: string
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
  const firstYear = Number(min.slice(0, 4))
  const lastYear = Number(max.slice(0, 4))
  const firstMonth = year === min.slice(0, 4) ? Number(min.slice(5, 7)) : 1
  const lastMonth = year === max.slice(0, 4) ? Number(max.slice(5, 7)) : 12
  const titleText = label ?? t('historyChooseDay')

  return <>
    <button id={triggerId} type="button" className="secondary" aria-haspopup="dialog"
      aria-label={label && day ? label + ' · ' + fullDate.format(new Date(day)) : undefined} onClick={() => {
      const selected = day || today
      setMonth((selected < min ? min : selected > max ? max : selected).slice(0, 7))
      dialog.current?.showModal()
    }}>
      <CalendarDays size={17} aria-hidden="true" />{day ? fullDate.format(new Date(day)) : titleText}
    </button>
    <Modal ref={dialog} className="panel history-calendar-dialog" aria-labelledby={title}>
      <header>
        <strong id={title}>{titleText}</strong>
        <button type="button" className="sidebar-close" aria-label={t('cancelPurchase')} onClick={() => dialog.current?.close()}>
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      <div className="history-calendar-controls">
        <Select aria-label={t('purchaseMonth')} value={month.slice(5)} onChange={event => setMonth(year + '-' + event.target.value)}>
          {Array.from({ length: lastMonth - firstMonth + 1 }, (_, index) => {
            const value = String(firstMonth + index).padStart(2, '0')
            return <option key={value} value={value}>{monthName.format(new Date(year + '-' + value + '-01'))}</option>
          })}
        </Select>
        <Select aria-label={t('historyYear')} value={year} onChange={event => {
          const nextYear = event.target.value
          const nextMonth = nextYear + '-' + month.slice(5)
          const earliest = min.slice(0, 7)
          const latest = max.slice(0, 7)
          setMonth(nextMonth < earliest ? earliest : nextMonth > latest ? latest : nextMonth)
        }}>
          {Array.from({ length: lastYear - firstYear + 1 }, (_, index) => {
            const value = lastYear - index
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
            <button key={value} type="button" disabled={value < min || value > max} aria-label={fullDate.format(new Date(value))}
              aria-current={value === today ? 'date' : undefined} aria-pressed={value === day}
              onClick={() => { selectDay(value); dialog.current?.close() }}>
              {number.format(Number(value.slice(8)))}
            </button>)}
      </div>
    </Modal>
  </>
}
