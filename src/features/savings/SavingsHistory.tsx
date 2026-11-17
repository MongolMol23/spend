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
  return <HistoryDisclosure className="debt-history savings-history" title={t('savingsHistory')}
    filters={<HistoryDates {...historyDates} />}>
    {history.isPending && <p className="loading-state" role="status">{t('loading')}</p>}
    {history.isError && <><Toast message={t('failed')} />
      <button type="button" className="secondary" disabled={history.isFetching} aria-busy={history.isFetching} onClick={() => void history.refetch()}>{t('retry')}</button></>}
    {history.data && (history.data.length ? <ol className="history-list" role="list">
      {history.data.map(event => {
        const after = snapshot.safeParse(event.after_data).data
        const before = snapshot.safeParse(event.before_data).data
        const label = after?.direction === 'deposit' ? 'savingsDeposited'
          : after?.direction === 'withdraw' ? 'savingsWithdrawn'
          : event.action === 'archived' ? 'savingsArchived' : event.action === 'updated' ? 'savingsUpdated' : 'savingsCreated'
        return <HistoryEntry key={event.id} timestamp={event.created_at} date={eventTime}
          title={<>{t(label)}{after && <> · <bdi>{after.name}</bdi></>}</>}>
          {after && <>
            <div className="debt-snapshots">
              {([{ label: 'purchaseBefore', value: before }, { label: 'purchaseAfter', value: after }] as const)
                .map(({ label: state, value }) => value && <div key={state}>
                  <strong>{t(state)}</strong>
                  <p><bdi>{value.name}</bdi></p>
                  {value.target_minor !== undefined && <p>{t('savingsTarget')} · <Amount value={value.target_minor / 100} /></p>}
                  {value.amount_minor !== undefined && <p>{t('savingsAmount')} · <Amount value={value.amount_minor / 100} /></p>}
                  {value.target_on && <p>{t('savingsTargetDate')} · <time dateTime={value.target_on}>{date.format(new Date(value.target_on))}</time></p>}
                  {value.moved_on && <p>{t('savingsMovementDate')} · <time dateTime={value.moved_on}>{date.format(new Date(value.moved_on))}</time></p>}
                  <p>{t('savingsSaved')} · <Amount value={value.saved_minor / 100} /></p>
                </div>)}
            </div>
            {event.action === 'archived' && <Link to={'?goal=' + event.entity_id} className="secondary">{t('savingsView')}</Link>}
          </>}
        </HistoryEntry>
      })}
    </ol> : <p className="empty-state">{t('historyNoEntries')}</p>)}
  </HistoryDisclosure>
}
