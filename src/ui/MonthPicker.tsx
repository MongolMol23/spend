import { Modal } from './Modal'
import { useId, useRef, useState } from 'react'
import { CalendarDays, Funnel, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { ledgerToday } from '../data/calendar'
import './history.css'

export function MonthPicker({ value, onChange, iconOnly = false }: {
  value: string; onChange: (month: string) => void; iconOnly?: boolean
}) {
  const { t, i18n } = useTranslation()
  const dialog = useRef<HTMLDialogElement>(null)
  const title = useId()
  const [year, setYear] = useState(value.slice(0, 4))
  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-EG'
  const format = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const monthName = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' })
  const current = ledgerToday().slice(0, 7)
  const selected = format.format(new Date(value + '-01'))
  const label = t('purchaseMonth') + ' · ' + selected

  function choose(month: string) {
    onChange(month)
    dialog.current?.close()
  }

  return <div className="month-picker">
    {!iconOnly && <span className="month-picker-label">{t('purchaseMonth')}</span>}
    <button type="button" className="secondary month-picker-trigger" aria-haspopup="dialog"
      aria-label={label} title={iconOnly ? label : undefined}
      data-icon-only={iconOnly || undefined} data-filtered={iconOnly && value !== current ? true : undefined}
      onClick={() => { setYear(value.slice(0, 4)); dialog.current?.showModal() }}>
      {iconOnly ? <Funnel size={18} aria-hidden="true" /> : <>{selected}<CalendarDays size={18} aria-hidden="true" /></>}
    </button>
    <Modal ref={dialog} className="panel history-calendar-dialog" aria-labelledby={title}>
      <header>
        <strong id={title}>{t('chooseMonth')}</strong>
        <button type="button" className="sidebar-close" aria-label={t('cancelPurchase')} onClick={() => dialog.current?.close()}>
          <X size={18} aria-hidden="true" />
        </button>
      </header>
      <label className="month-picker-year">{t('historyYear')}
        <input type="number" dir="ltr" inputMode="numeric" min={1} max={9999} step={1} value={year}
          onChange={event => setYear(event.target.value)} />
      </label>
      <div className="history-calendar-grid month-picker-grid">
        {Array.from({ length: 12 }, (_, index) => {
          const validYear = /^\d{1,4}$/.test(year) && Number(year) > 0
          const month = (validYear ? year.padStart(4, '0') : value.slice(0, 4)) + '-' + String(index + 1).padStart(2, '0')
          const date = new Date(month + '-01')
          return <button key={index} type="button" disabled={!validYear} aria-label={format.format(date)}
            aria-pressed={month === value} onClick={() => choose(month)}>{monthName.format(date)}</button>
        })}
      </div>
      <div className="month-picker-footer">
        <button type="button" className="secondary" onClick={() => choose(current)}>{t('thisMonth')}</button>
      </div>
    </Modal>
  </div>
}
