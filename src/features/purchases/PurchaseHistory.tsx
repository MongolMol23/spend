import { HistoryEntry } from '../../ui/HistoryEntry'
import { useTranslation } from 'react-i18next'
import { changedHistoryFields, HistoryChanges, type HistoryField } from '../../ui/HistoryChanges'
import { z } from 'zod'
import type { Tables } from '../../data/database.types'
import { Amount } from '../../ui/Amount'
import { categoryLabel } from './api'

const snapshot = z.object({
  item: z.string(),
  amount_minor: z.number(),
  category: z.string(),
  spent_on: z.iso.date(),
  note: z.string().nullable(),
})

export function PurchaseHistory({ events }: { events: Tables<'personal_activity'>[] }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-EG'
  const eventTime = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo' })
  const purchaseDate = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' })
  function fields(value: z.infer<typeof snapshot>): HistoryField[] {
    return [
      { label: t('purchaseHistoryItem'), raw: value.item, display: <bdi>{value.item}</bdi> },
      { label: t('purchaseHistoryAmount'), raw: value.amount_minor, display: <Amount value={value.amount_minor / 100} /> },
      { label: t('purchaseCategory'), raw: value.category, display: t(categoryLabel(value.category)) },
      { label: t('purchaseDate'), raw: value.spent_on, display: <time dateTime={value.spent_on}>{purchaseDate.format(new Date(value.spent_on))}</time> },
      { label: t('purchaseHistoryNote'), raw: value.note, display: <bdi>{value.note ?? t('purchaseNoNote')}</bdi> },
    ]
  }
  const entries = events.flatMap(event => {
    const after = snapshot.safeParse(event.after_data).data
    const before = snapshot.safeParse(event.before_data).data
    const label = event.action === 'created' ? 'purchaseCreated' : event.action === 'archived' ? 'purchaseArchived' : 'purchaseUpdated'
    const previous = before && event.action === 'updated' ? fields(before) : undefined
    const details = after ? changedHistoryFields(previous ? fields(after) : fields(after).slice(1), previous) : []
    if (previous && after && !details.length) return []
    return <HistoryEntry key={event.id} timestamp={event.created_at} date={eventTime}
      detailLabel={previous ? undefined : t('historyDetails')}
      title={<>{t(label)}{after && <> · <bdi>{after.item}</bdi></>}</>}>
      {!!details.length && <HistoryChanges changes={details} />}
    </HistoryEntry>
  })
  if (!entries.length) return <p className="empty-state">{t('historyNoEntries')}</p>
  return <ol className="history-list" role="list">{entries}</ol>
}
