import { Modal } from '../../ui/Modal'
import { readHistory } from '../../data/readHistory'
import { HistoryDates, useHistoryDates } from '../../ui/HistoryDates'
import { Toast } from '../../ui/Toast'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { HistoryDisclosure, HistoryEntry } from '../../ui/HistoryEntry'
import { ledgerToday } from '../../data/calendar'
import type { Label } from '../../i18n/locales'
import { Amount } from '../../ui/Amount'
import { Select } from '../../ui/Select'
import { listSavingsMovements, movementInput, savingsKey, savingsPageSize, type SavingsChange, type SavingsClient, type SavingsGoal } from './api'

export function SavingsDetail({ client, goal, date, busy, pending, movementError, archiveError, save, edit }: {
  client: SavingsClient
  goal: SavingsGoal
  date: Intl.DateTimeFormat
  busy: boolean
  pending?: SavingsChange['kind']
  movementError?: Label
  archiveError?: Label
  save: (change: SavingsChange) => Promise<boolean>
  edit: () => void
}) {
  const { t } = useTranslation()
  const historyDates = useHistoryDates()
  const { from, until } = historyDates
  const [invalid, setInvalid] = useState<Label>()
  const heading = useRef<HTMLHeadingElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const remaining = Math.max(0, goal.target_minor - goal.saved_minor)
  const message = invalid ?? movementError
  const movements = useQuery({
    queryKey: [...savingsKey, 'movements', goal.id, from, until],
    queryFn: ({ signal }) => readHistory(savingsPageSize, page => listSavingsMovements(client, goal.id, page, signal, from, until)),
  })
  useEffect(() => { heading.current?.focus() }, [])

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const result = movementInput.safeParse(Object.fromEntries(new FormData(form)))
    if (!result.success) {
      setInvalid('savingsInvalidMovement')
      const field = form.elements.namedItem(String(result.error.issues[0]?.path[0]))
      if (field instanceof HTMLElement) field.focus()
      return
    }
    if (result.data.direction === 'withdraw' && result.data.amount > goal.saved_minor) {
      setInvalid('savingsInsufficient')
      form.querySelector<HTMLInputElement>('[name="amount"]')?.focus()
      return
    }
    setInvalid(undefined)
    if (await save({ kind: 'move', goal, input: result.data })) {
      form.reset()
    }
  }

  return <section className="panel debt-detail savings-detail">
    <h2 ref={heading} tabIndex={-1}><bdi>{goal.name}</bdi></h2>
    {goal.target_on && <p>{t('savingsTargetDate')} · <time dateTime={goal.target_on}>{date.format(new Date(goal.target_on))}</time></p>}
    {goal.archived_at && <p className="status">{t('savingsArchived')}</p>}
    {!remaining && <p className="status" data-state="settled">{t('savingsReached')}</p>}
    <progress className="savings-progress" aria-label={t('savingsProgress')} max={goal.target_minor}
      value={Math.min(goal.saved_minor, goal.target_minor)} />
    <dl className="debt-balances">
      {([
        ['savingsTarget', goal.target_minor], ['savingsSaved', goal.saved_minor], ['remaining', remaining],
      ] as const).map(([label, amount]) => <div key={label}><dt>{t(label)}</dt><dd><Amount value={amount / 100} /></dd></div>)}
    </dl>
    {!goal.archived_at && <form onSubmit={submit} noValidate onChange={() => setInvalid(undefined)}>
      <fieldset className="debt-form" disabled={busy} aria-label={t('savingsRecord')}>
        <label>{t('savingsMovementType')}<Select name="direction" defaultValue="deposit">
          <option value="deposit">{t('savingsDeposit')}</option>
          <option value="withdraw">{t('savingsWithdraw')}</option>
        </Select></label>
        <div className="debt-pair">
          <label>{t('savingsAmount')}<input name="amount" inputMode="decimal" dir="ltr" required /></label>
          <label>{t('savingsMovementDate')}<input name="movedOn" type="date" dir="ltr" min="0001-01-01" max="9999-12-31" defaultValue={ledgerToday()} required /></label>
        </div>
        {message && <Toast message={t(message)} />}
        <div><button type="submit" className="primary" aria-busy={pending === 'move'}>{t('savingsRecord')}</button></div>
      </fieldset>
    </form>}
    <HistoryDisclosure className="record-history" title={t('savingsMovements')}
    filters={<HistoryDates {...historyDates} />}>
      {movements.isPending && <p className="loading-state" role="status">{t('loading')}</p>}
      {movements.isError && <><Toast message={t('failed')} />
        <button type="button" className="secondary" disabled={movements.isFetching} aria-busy={movements.isFetching} onClick={() => void movements.refetch()}>{t('retry')}</button></>}
      {movements.data && (movements.data.length ? <ol className="history-list savings-movements" role="list">
        {movements.data.map(movement => <HistoryEntry key={movement.id}
          title={t(movement.direction === 'deposit' ? 'savingsDeposit' : 'savingsWithdraw')}
          timestamp={movement.moved_on} date={date} amount={<Amount value={movement.amount_minor / 100} />} />)}
      </ol> : <p className="empty-state">{t('historyNoEntries')}</p>)}
    </HistoryDisclosure>
    {!goal.archived_at && <div className="debt-actions">
      <button type="button" className="secondary" disabled={busy} onClick={edit}>{t('savingsEdit')}</button>
      <button type="button" className="secondary" disabled={busy} onClick={() => dialog.current?.showModal()}>{t('savingsArchive')}</button>
    </div>}
    <Modal ref={dialog} busy={busy} className="panel debt-dialog" aria-labelledby="archive-savings-title">
      <h2 id="archive-savings-title">{t('savingsArchive')}</h2>
      <p><bdi>{goal.name}</bdi></p>
      <p>{t('savingsArchivePrompt')}</p>
      {archiveError && <Toast message={t(archiveError)} />}
      <div className="debt-actions">
        <button type="button" className="secondary" disabled={busy} onClick={() => dialog.current?.close()}>{t('cancelPurchase')}</button>
        <button type="button" className="primary" disabled={busy} aria-busy={pending === 'archive'} onClick={async () => {
          if (await save({ kind: 'archive', goal })) dialog.current?.close()
        }}>{t('debtArchiveConfirm')}</button>
      </div>
    </Modal>
  </section>
}
