import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export type HistoryField = { label: string; raw: string | number | null; display: ReactNode }
export type HistoryChange = HistoryField & { previous?: HistoryField }

export function changedHistoryFields(after: HistoryField[], before?: HistoryField[]): HistoryChange[] {
  return after.flatMap(field => {
    const previous = before?.find(value => value.label === field.label)
    if (previous ? previous.raw === field.raw : field.raw === null) return []
    return [{ ...field, previous }]
  })
}

export function HistoryChanges({ changes }: { changes: HistoryChange[] }) {
  const { t } = useTranslation()
  if (!changes.length) return null
  return <dl className="history-change-fields">
    {changes.map(field => <div key={field.label}>
      <dt>{field.label}</dt>
      <dd>
        {field.previous && <>
          <span className="history-change-before"><span className="history-accessible">{t('purchaseBefore')} </span>{field.previous.display}</span>
          <ArrowRight className="history-change-arrow" size={14} aria-hidden="true" />
        </>}
        <strong>{field.previous && <span className="history-accessible">{t('purchaseAfter')} </span>}{field.display}</strong>
      </dd>
    </div>)}
  </dl>
}
