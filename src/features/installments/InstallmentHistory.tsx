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
  return <HistoryDisclosure className="debt-history installment-history" title={t('installmentHistory')}
    filters={<HistoryDates {...historyDates} />}>
    {history.isPending && <p className="loading-state" role="status">{t('loading')}</p>}
    {history.isError && <><Toast message={t('failed')} />
      <button type="button" className="secondary" onClick={() => void history.refetch()}>{t('retry')}</button></>}
    {history.data && (history.data.length ? <ol className="history-list" role="list">
      {history.data.map(event => {
        const after = snapshot.safeParse(event.after_data).data
        const before = snapshot.safeParse(event.before_data).data
        const label = event.entity_type === 'installment_payment' ? 'debtPaymentSaved'
          : event.action === 'archived' ? 'installmentArchived' : event.action === 'updated' ? 'installmentUpdated' : 'installmentCreated'
        return <HistoryEntry key={event.id} timestamp={event.created_at} date={eventTime} amount={after?.amount_minor !== undefined && <Amount value={after.amount_minor / 100} />}
          title={<>{t(label)}{after && <> · <bdi>{after.name}</bdi></>}</>}>
          {after && <>
            <div className="debt-snapshots">
              {([{ label: 'purchaseBefore', value: before }, { label: 'purchaseAfter', value: after }] as const)
                .map(({ label: state, value }) => value && <div key={state}>
                  <strong>{t(state)}</strong>
                  <p><bdi>{value.name}</bdi></p>
                  {value.total_minor !== undefined && <p>{t('installmentTotal')} · <Amount value={value.total_minor / 100} /></p>}
                  {value.amount_minor !== undefined && <p>{t('installmentAmount')} · <Amount value={value.amount_minor / 100} /></p>}
                  {value.remaining_minor !== undefined && <p>{t('remaining')} · <Amount value={value.remaining_minor / 100} /></p>}
                  {value.due_on && <p>{t('installmentDueDate')} · <time dateTime={value.due_on}>{date.format(new Date(value.due_on))}</time></p>}
                  {value.paid_on && <p>{t('debtPaidOn')} · <time dateTime={value.paid_on}>{date.format(new Date(value.paid_on))}</time></p>}
                  {value.schedule && <ul className="ledger">{value.schedule.map((due, index) => <li className="row debt-row" key={index}>
                    <time dateTime={due.due_on}>{date.format(new Date(due.due_on))}</time><Amount value={due.amount_minor / 100} />
                  </li>)}</ul>}
                </div>)}
            </div>
            {event.action === 'archived' && <Link to={'?plan=' + event.entity_id} className="secondary">{t('installmentView')}</Link>}
          </>}
        </HistoryEntry>
      })}
    </ol> : <p className="empty-state">{t('historyNoEntries')}</p>)}
  </HistoryDisclosure>
}
