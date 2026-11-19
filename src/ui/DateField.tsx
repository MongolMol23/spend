import { useEffect, useId, useRef, useState } from 'react'
import { ledgerToday } from '../data/calendar'
import { HistoryCalendar } from './HistoryCalendar'

export function DateField({ label, name, defaultValue = '', optional, readOnly, invalid, describedBy, onChange }: {
  label: string
  name: string
  defaultValue?: string
  optional?: boolean
  readOnly?: boolean
  invalid?: boolean
  describedBy?: string
  onChange?: () => void
}) {
  const id = useId()
  const valueField = useRef<HTMLInputElement>(null)
  const [value, setValue] = useState(defaultValue)

  useEffect(() => {
    const form = valueField.current?.form
    const reset = () => setValue(defaultValue)
    form?.addEventListener('reset', reset)
    return () => form?.removeEventListener('reset', reset)
  }, [defaultValue])

  return <div className="date-field">
    <label htmlFor={id}>{label}</label>
    <input type="hidden" name={name} value={value} ref={valueField} />
    <HistoryCalendar day={value} today={ledgerToday()} max="9999-12-31" label={label} triggerId={id}
      field readOnly={readOnly} clearable={optional} invalid={invalid} describedBy={describedBy}
      selectDay={day => { setValue(day); onChange?.() }} />
  </div>
}
