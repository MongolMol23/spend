import { readHistory } from '../../data/readHistory'
import { cairoDayStart } from '../../data/calendar'
import { HistoryDates, useHistoryDates } from '../../ui/HistoryDates'
import { HistoryEntry, HistoryDisclosure } from '../../ui/HistoryEntry'
import { Toast } from '../../ui/Toast'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import type { ReactNode } from 'react'
import { ArrowRight } from 'lucide-react'
import { z } from 'zod'
import { Amount } from '../../ui/Amount'
import { debtKey, debtPageSize, listDebtHistory, type DebtClient } from './api'

const snapshot = z.object({
  contact: z.string(), direction: z.enum(['owed', 'owe']), amount_minor: z.number(),
  paid_minor: z.number().optional(), remaining_minor: z.number().optional(),
  due_on: z.iso.date().nullish(), paid_on: z.iso.date().optional(),
})

export function DebtHistory({ client, date }: { client: DebtClient; date: Intl.DateTimeFormat }) {
  const { t, i18n } = useTranslation()
  const eventTime = new Intl.DateTimeFormat(i18n.language === 'ar' ? 'ar-EG' : 'en-EG', {
    dateStyle: 'medium', timeStyle: 'short', timeZone: 'Africa/Cairo',
  })
  const historyDates = useHistoryDates()
  const { from, until } = historyDates
  const history = useQuery({
    queryKey: [...debtKey, 'history', from, until],
    queryFn: ({ signal }) => readHistory(debtPageSize, page => listDebtHistory(client, page, signal, cairoDayStart(from), cairoDayStart(until))),
  })
  function fields(value: z.infer<typeof snapshot>, payment: boolean): { label: string; raw: string | number | null; display: ReactNode }[] {
    const result = [
      { label: t('debtContact'), raw: value.contact, display: <bdi>{value.contact}</bdi> },
      { label: t('debtHistoryDirection'), raw: value.direction, display: t(value.direction) },
      { label: t(payment ? 'debtPaymentAmount' : 'debtTotal'), raw: value.amount_minor, display: <Amount value={value.amount_minor / 100} /> },
    ]
    const day = payment ? value.paid_on : value.due_on
    return [...result, {
      label: t(payment ? 'debtPaidOn' : 'due'), raw: day ?? null,
      display: day ? <time dateTime={day}>{date.format(new Date(day))}</time> : t('debtHistoryNoDue'),
    }, ...(payment && value.remaining_minor !== undefined ? [{
      label: t('remaining'), raw: value.remaining_minor, display: <Amount value={value.remaining_minor / 100} />,
    }] : [])]
  }
  const entries = (history.data ?? []).flatMap(event => {
    const after = snapshot.safeParse(event.after_data).data
    const before = snapshot.safeParse(event.before_data).data
    const payment = event.entity_type === 'private_debt_payment'
    const label = payment ? 'debtPaymentSaved'
      : event.action === 'archived' ? 'debtArchived' : event.action === 'updated' ? 'debtUpdated' : 'debtSaved'
    const original = before && event.action === 'updated' ? fields(before, payment) : undefined
    const changes = after ? fields(after, payment).flatMap((field, index) => {
      const previous = original?.[index]
      if (previous ? previous.raw === field.raw : index === 0 || field.raw === null) return []
      return [{ ...field, previous }]
    }) : []
    // Ignore updates which changed only internal revision metadata.
    if (original && after && changes.length === 0) return []
    return <HistoryEntry key={event.id} timestamp={event.created_at} date={eventTime}
      detailLabel={t(original ? 'debtHistoryChanges' : 'historyDetails')}
      title={<>{t(label)}{after && <> · <bdi>{after.contact}</bdi></>}</>}>
      {changes.length > 0 && <dl className="debt-history-changes">
        {changes.map(field => <div key={field.label}>
          <dt>{field.label}</dt>
          <dd>{field.previous && <>
            <span className="debt-history-before"><span className="debt-history-accessible">{t('purchaseBefore')} </span>{field.previous.display}</span>
            <ArrowRight className="debt-history-arrow" size={14} aria-hidden="true" />
          </>}
            <strong>{field.previous && <span className="debt-history-accessible">{t('purchaseAfter')} </span>}{field.display}</strong>
          </dd>
        </div>)}
      </dl>}
    </HistoryEntry>
  })
  return <HistoryDisclosure className="debt-history" title={t('debtHistory')}
    filters={<HistoryDates {...historyDates} />}>
    {history.isPending && <p className="loading-state" role="status">{t('loading')}</p>}
    {history.isError && <><Toast message={t('failed')} />
      <button type="button" className="secondary" disabled={history.isFetching} aria-busy={history.isFetching} onClick={() => void history.refetch()}>{t('retry')}</button></>}
    {history.data && (entries.length ? <ol className="history-list" role="list">{entries}</ol>
      : <p className="empty-state">{t('historyNoEntries')}</p>)}
  </HistoryDisclosure>
}
