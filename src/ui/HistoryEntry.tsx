import { ChevronDown, Clock3, History } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import './history.css'

export function HistoryDisclosure({ title, className, children, filters }: {
  title: string
  className?: string
  children: ReactNode
  filters?: ReactNode
}) {
  return <details className={className ? `panel history-disclosure ${className}` : 'panel history-disclosure'}>
    <summary className="history-disclosure-summary">
      <span className="history-entry-icon" aria-hidden="true"><History size={18} /></span>
      <strong>{title}</strong>
      <ChevronDown className="history-disclosure-chevron" size={18} aria-hidden="true" />
    </summary>
    {filters}
    <div className="history-disclosure-content" role="region" aria-label={title} tabIndex={0}>{children}</div>
  </details>
}

export function HistoryEntry({ title, timestamp, date, amount, children, detailLabel, collapsible = true }: {
  title: ReactNode
  timestamp: string
  date: Intl.DateTimeFormat
  amount?: ReactNode
  children?: ReactNode
  detailLabel?: string
  collapsible?: boolean
}) {
  const { t } = useTranslation()
  const heading = <>
    <span className="history-entry-icon" aria-hidden="true"><Clock3 size={17} /></span>
    <span className="history-entry-copy">
      <strong>{title}</strong>
      <time dateTime={timestamp}>{date.format(new Date(timestamp))}</time>
    </span>
    {amount && <span className="history-entry-amount">{amount}</span>}
  </>

  return <li className="history-entry">
    {children && collapsible ? <details>
      <summary className="history-entry-head">
        {heading}
        <span className="history-entry-toggle">
          <span>{detailLabel ?? t('purchaseDetails')}</span>
          <ChevronDown size={16} aria-hidden="true" />
        </span>
      </summary>
      <div className="history-entry-body">{children}</div>
    </details> : <div className="history-entry-card">
      <div className="history-entry-head">{heading}</div>
      {children && <div className="history-entry-body">{children}</div>}
    </div>}
  </li>
}
