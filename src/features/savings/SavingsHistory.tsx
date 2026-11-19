import { readHistory } from '../../data/readHistory'
import { cairoDayStart } from '../../data/calendar'
import { HistoryDates, useHistoryDates } from '../../ui/HistoryDates'
import { HistoryEntry, HistoryDialog } from '../../ui/HistoryEntry'
import { Toast } from '../../ui/Toast'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { z } from 'zod'
import { Amount } from '../../ui/Amount'
import { changedHistoryFields, HistoryChanges, type HistoryField } from '../../ui/HistoryChanges'
import { listSavingsHistory, savingsKey, savingsPageSize, type SavingsClient } from './api'

const snapshot = z.object({
  name: z.string(), saved_minor: z.number(), target_minor: z.number().optional(),
  amount_minor: z.number().optional(), target_on: z.iso.date().nullish(),
  moved_on: z.iso.date().optional(), direction: z.enum(['deposit', 'withdraw']).optional(),
})

export function SavingsHistory({ client, date }: { client: SavingsClient; date: Intl.DateTimeFormat }) {
  const { t, i18n } = useTranslation()
  const historyDates = useHistoryDates()
  const { from, until } = historyDates
  const eventTime = new Intl.DateTimeFormat(i18n.language === 'ar' ? 'ar-EG' : 'en-EG', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo',
  })
  const history = useQuery({
    queryKey: [...savingsKey, 'history', from, until],
    queryFn: ({ signal }) => readHistory(savingsPageSize, page => listSavingsHistory(client, page, signal, cairoDayStart(from), cairoDayStart(until))),
  })
  function fields(value: z.infer<typeof snapshot>): HistoryField[] {
    return [
      { label: t('savingsName'), raw: value.name, display: <bdi>{value.name}</bdi> },
      { label: t('savingsTarget'), raw: value.target_minor ?? null, display: <Amount value={(value.target_minor ?? 0) / 100} /> },
      { label: t('savingsAmount'), raw: value.amount_minor ?? null, display: <Amount value={(value.amount_minor ?? 0) / 100} /> },
      { label: t('savingsSaved'), raw: value.saved_minor, display: <Amount value={value.saved_minor / 100} /> },
      { label: t('savingsTargetDate'), raw: value.target_on ?? null, display: value.target_on ? <time dateTime={value.target_on}>{date.format(new Date(value.target_on))}</time> : t('historyNoDate') },
      { label: t('savingsMovementDate'), raw: value.moved_on ?? null, display: value.moved_on ? <time dateTime={value.moved_on}>{date.format(new Date(value.moved_on))}</time> : t('historyNoDate') },
      { label: t('historyMovementType'), raw: value.direction ?? null, display: value.direction ? t(value.direction === 'deposit' ? 'savingsDeposit' : 'savingsWithdraw') : '' },
    ]
  }
  const entries = (history.data ?? []).flatMap(event => {
    const after = snapshot.safeParse(event.after_data).data
    const before = snapshot.safeParse(event.before_data).data
    const label = after?.direction === 'deposit' ? 'savingsDeposited'
      : after?.direction === 'withdraw' ? 'savingsWithdrawn'
      : event.action === 'archived' ? 'savingsArchived' : event.action === 'updated' ? 'savingsUpdated' : 'savingsCreated'
    const previous = before && event.action === 'updated' ? fields(before) : undefined
    const changes = after ? changedHistoryFields(previous ? fields(after) : fields(after).slice(1), previous) : []
    if (previous && after && !changes.length) return []
    return <HistoryEntry key={event.id} timestamp={event.created_at} date={eventTime}
      detailLabel={t(previous ? 'historyChanges' : 'historyDetails')}
      title={<>{t(label)}{after && <> · <bdi>{after.name}</bdi></>}</>}>
      {(changes.length > 0 || event.action === 'archived') && <>
        <HistoryChanges changes={changes} />
        {event.action === 'archived' && <Link to={'?goal=' + event.entity_id} className="secondary">{t('savingsView')}</Link>}
      </>}
    </HistoryEntry>
  })
  return <HistoryDialog className="savings-history" title={t('savingsHistory')}
    filters={<HistoryDates {...historyDates} />}>
    {history.isPending && <p className="loading-state" role="status">{t('loading')}</p>}
    {history.isError && <><Toast message={t('failed')} />
      <button type="button" className="secondary" disabled={history.isFetching} aria-busy={history.isFetching} onClick={() => void history.refetch()}>{t('retry')}</button></>}
    {history.data && (entries.length ? <ol className="history-list" role="list">{entries}</ol>
      : <p className="empty-state">{t('historyNoEntries')}</p>)}
  </HistoryDialog>
}
