import { readHistory } from '../../data/readHistory'
import { cairoDayStart } from '../../data/calendar'
import { HistoryDates, useHistoryDates } from '../../ui/HistoryDates'
import { HistoryEntry, HistoryDisclosure } from '../../ui/HistoryEntry'
import { Toast } from '../../ui/Toast'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link } from 'react-router'
import { z } from 'zod'
import { Amount } from '../../ui/Amount'
import { changedHistoryFields, HistoryChanges, type HistoryField } from '../../ui/HistoryChanges'
import { installmentKey, installmentPageSize, listInstallmentHistory, scheduleEntry, type InstallmentClient } from './api'

const snapshot = z.object({
  name: z.string(), total_minor: z.number().optional(), schedule: z.array(scheduleEntry).optional(),
  amount_minor: z.number().optional(), remaining_minor: z.number().optional(),
  due_on: z.iso.date().optional(), paid_on: z.iso.date().optional(),
})

export function InstallmentHistory({ client, date }: { client: InstallmentClient; date: Intl.DateTimeFormat }) {
  const { t, i18n } = useTranslation()
  const historyDates = useHistoryDates()
  const { from, until } = historyDates
  const eventTime = new Intl.DateTimeFormat(i18n.language === 'ar' ? 'ar-EG' : 'en-EG', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo',
  })
  const history = useQuery({
    queryKey: [...installmentKey, 'history', from, until],
    queryFn: ({ signal }) => readHistory(installmentPageSize, page => listInstallmentHistory(client, page, signal, cairoDayStart(from), cairoDayStart(until))),
  })
  function fields(value: z.infer<typeof snapshot>, scheduleLength: number): HistoryField[] {
    return [
      { label: t('installmentName'), raw: value.name, display: <bdi>{value.name}</bdi> },
      { label: t('installmentTotal'), raw: value.total_minor ?? null, display: <Amount value={(value.total_minor ?? 0) / 100} /> },
      { label: t('installmentAmount'), raw: value.amount_minor ?? null, display: <Amount value={(value.amount_minor ?? 0) / 100} /> },
      { label: t('remaining'), raw: value.remaining_minor ?? null, display: <Amount value={(value.remaining_minor ?? 0) / 100} /> },
      { label: t('installmentDueDate'), raw: value.due_on ?? null, display: value.due_on ? <time dateTime={value.due_on}>{date.format(new Date(value.due_on))}</time> : t('historyNoDate') },
      { label: t('debtPaidOn'), raw: value.paid_on ?? null, display: value.paid_on ? <time dateTime={value.paid_on}>{date.format(new Date(value.paid_on))}</time> : t('historyNoDate') },
      ...Array.from({ length: scheduleLength }, (_, index) => {
        const due = value.schedule?.[index]
        return {
          label: t('historyInstallmentNumber', { number: (index + 1).toLocaleString(i18n.language === 'ar' ? 'ar-EG' : 'en-EG') }),
          raw: due ? due.due_on + '|' + due.amount_minor : null,
          display: due ? <span className="history-schedule-value"><time dateTime={due.due_on}>{date.format(new Date(due.due_on))}</time><Amount value={due.amount_minor / 100} /></span> : t('historyRemoved'),
        }
      }),
    ]
  }
  const entries = (history.data ?? []).flatMap(event => {
    const after = snapshot.safeParse(event.after_data).data
    const before = snapshot.safeParse(event.before_data).data
    const label = event.entity_type === 'installment_payment' ? 'debtPaymentSaved'
      : event.action === 'archived' ? 'installmentArchived' : event.action === 'updated' ? 'installmentUpdated' : 'installmentCreated'
    const scheduleLength = Math.max(after?.schedule?.length ?? 0, before?.schedule?.length ?? 0)
    const previous = before && event.action === 'updated' ? fields(before, before.schedule?.length ?? 0) : undefined
    const changes = after ? changedHistoryFields(previous ? fields(after, scheduleLength) : fields(after, scheduleLength).slice(1), previous) : []
    if (previous && after && !changes.length) return []
    return <HistoryEntry key={event.id} timestamp={event.created_at} date={eventTime}
      detailLabel={t(previous ? 'historyChanges' : 'historyDetails')}
      title={<>{t(label)}{after && <> · <bdi>{after.name}</bdi></>}</>}>
      {(changes.length > 0 || event.action === 'archived') && <>
        <HistoryChanges changes={changes} />
        {event.action === 'archived' && <Link to={'?plan=' + event.entity_id} className="secondary">{t('installmentView')}</Link>}
      </>}
    </HistoryEntry>
  })
  return <HistoryDisclosure className="debt-history installment-history" title={t('installmentHistory')}
    filters={<HistoryDates {...historyDates} />}>
    {history.isPending && <p className="loading-state" role="status">{t('loading')}</p>}
    {history.isError && <><Toast message={t('failed')} />
      <button type="button" className="secondary" disabled={history.isFetching} aria-busy={history.isFetching} onClick={() => void history.refetch()}>{t('retry')}</button></>}
    {history.data && (entries.length ? <ol className="history-list" role="list">{entries}</ol>
      : <p className="empty-state">{t('historyNoEntries')}</p>)}
  </HistoryDisclosure>
}
