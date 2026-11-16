import { readHistory } from '../../data/readHistory'
import { cairoDayStart } from '../../data/calendar'
import { HistoryDates, useHistoryDates } from '../../ui/HistoryDates'
import { HistoryEntry, HistoryDisclosure } from '../../ui/HistoryEntry'
import { Toast } from '../../ui/Toast'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
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
  return <HistoryDisclosure className="debt-history" title={t('debtHistory')}
    filters={<HistoryDates {...historyDates} />}>
    {history.isPending && <p className="loading-state" role="status">{t('loading')}</p>}
    {history.isError && <><Toast message={t('failed')} />
      <button type="button" className="secondary" onClick={() => void history.refetch()}>{t('retry')}</button></>}
    {history.data && (history.data.length ? <ol className="history-list" role="list">
      {history.data.map(event => {
        const after = snapshot.safeParse(event.after_data).data
        const before = snapshot.safeParse(event.before_data).data
        const label = event.entity_type === 'private_debt_payment' ? 'debtPaymentSaved'
          : event.action === 'archived' ? 'debtArchived' : event.action === 'updated' ? 'debtUpdated' : 'debtSaved'
        return <HistoryEntry key={event.id} timestamp={event.created_at} date={eventTime}
          title={<>{t(label)}{after && <> · <bdi>{after.contact}</bdi></>}</>}>
          {after && <>
            <div className="debt-snapshots">
              {([{ label: 'purchaseBefore', value: before }, { label: 'purchaseAfter', value: after }] as const)
                .map(({ label: state, value }) => value && <div key={state}>
                  <strong>{t(state)}</strong>
                  <p className="row debt-row"><bdi>{value.contact}</bdi><Amount value={value.amount_minor / 100} /></p>
                  <p>{t(value.direction)}</p>
                  {value.due_on && <p>{t('due')} <time dateTime={value.due_on}>{date.format(new Date(value.due_on))}</time></p>}
                  {value.paid_on && <p>{t('debtPaidOn')} <time dateTime={value.paid_on}>{date.format(new Date(value.paid_on))}</time></p>}
                  <p className="row debt-row">{t('remaining')} <Amount value={(value.remaining_minor ?? value.amount_minor - (value.paid_minor ?? 0)) / 100} /></p>
                </div>)}
            </div>
          </>}
        </HistoryEntry>
      })}
    </ol> : <p className="empty-state">{t('historyNoEntries')}</p>)}
  </HistoryDisclosure>
}
