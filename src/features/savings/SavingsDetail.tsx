import { Modal } from '../../ui/Modal'
import { readHistory } from '../../data/readHistory'
import { Toast } from '../../ui/Toast'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link } from 'react-router'
import { Archive, ArrowLeft, Pencil, Vault } from 'lucide-react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { HistoryDisclosure, HistoryEntry } from '../../ui/HistoryEntry'
import { ledgerToday } from '../../data/calendar'
import type { Label } from '../../i18n/locales'
import { Amount } from '../../ui/Amount'
import { LedgerEditor } from '../../ui/LedgerEditor'
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
  const { t, i18n } = useTranslation()
  const [movementType, setMovementType] = useState<'deposit' | 'withdraw'>()
  const [invalid, setInvalid] = useState<Label>()
  const heading = useRef<HTMLHeadingElement>(null)
  const dialog = useRef<HTMLDialogElement>(null)
  const remaining = Math.max(0, goal.target_minor - goal.saved_minor)
  const message = invalid ?? movementError
  const percent = new Intl.NumberFormat(i18n.language === 'ar' ? 'ar-EG' : 'en-EG', { style: 'percent', maximumFractionDigits: 0 })
  const progress = Math.min(1, goal.saved_minor / goal.target_minor)
  const movements = useQuery({
    queryKey: [...savingsKey, 'movements', goal.id],
    queryFn: ({ signal }) => readHistory(savingsPageSize, page => listSavingsMovements(client, goal.id, page, signal)),
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
      setMovementType(undefined)
    }
  }

  return <section className="panel debt-detail savings-detail">
    <div className="debt-detail-heading">
      <div className="debt-person">
        <span className="debt-avatar" aria-hidden="true"><Vault size={20} /></span>
        <h2 ref={heading} tabIndex={-1}><bdi>{goal.name}</bdi></h2>
      </div>
      <Link className="secondary debt-back" to="/savings"><ArrowLeft size={16} aria-hidden="true" />{t('savingsBack')}</Link>
    </div>
    <div className="debt-balance-summary savings-balance-summary">
      <div className="row">
        <strong>{t('savingsSaved')}</strong>
        <span className="status" data-state={!remaining ? 'settled' : undefined}>
          {t(goal.archived_at ? 'savingsArchived' : !remaining ? 'savingsReached' : 'savingsInProgress')}
        </span>
      </div>
      <strong className="debt-remaining"><Amount value={goal.saved_minor / 100} /></strong>
      <span className="debt-remaining-label">{t('savingsProgressValue', { percent: percent.format(progress) })}</span>
      <div className="debt-progress" role="progressbar" aria-label={t('savingsProgress')}
        aria-valuemin={0} aria-valuemax={goal.target_minor} aria-valuenow={Math.min(goal.saved_minor, goal.target_minor)}>
        <span style={{ inlineSize: progress * 100 + '%' }} />
      </div>
      {goal.target_on && <span className="debt-due">{t('savingsTargetDate')} · <time dateTime={goal.target_on}>{date.format(new Date(goal.target_on))}</time></span>}
    </div>
    <dl className="debt-detail-totals">
      {([
        ['savingsTarget', goal.target_minor], ['remaining', remaining],
      ] as const).map(([label, amount]) => <div key={label}><dt>{t(label)}</dt><dd><Amount value={amount / 100} /></dd></div>)}
    </dl>
    {!goal.archived_at && <div className="debt-detail-tools savings-detail-tools">
      <button type="button" className="primary" disabled={busy}
        onClick={() => { setInvalid(undefined); setMovementType('deposit') }}>{t('savingsDeposit')}</button>
      <button type="button" className="secondary" disabled={busy || goal.saved_minor === 0}
        onClick={() => { setInvalid(undefined); setMovementType('withdraw') }}>{t('savingsWithdraw')}</button>
      <button type="button" className="secondary savings-icon-action" disabled={busy} onClick={edit}
        aria-label={t('savingsEdit')} title={t('savingsEdit')}><Pencil size={17} aria-hidden="true" /></button>
      <button type="button" className="secondary savings-icon-action" disabled={busy} onClick={() => dialog.current?.showModal()}
        aria-label={t('savingsArchive')} title={t('savingsArchive')}><Archive size={18} aria-hidden="true" /></button>
    </div>}
    {movementType && !goal.archived_at && <LedgerEditor titleId="savings-movement-title" busy={busy} onClose={() => setMovementType(undefined)}>
      <section className="panel savings-entry savings-movement-editor">
        <h2 id="savings-movement-title">{t(movementType === 'deposit' ? 'savingsDeposit' : 'savingsWithdraw')}</h2>
        <p><bdi>{goal.name}</bdi> · {t('savingsSaved')} <Amount value={goal.saved_minor / 100} /></p>
        <form onSubmit={submit} noValidate onChange={() => setInvalid(undefined)}>
          <fieldset className="debt-form" disabled={busy} aria-label={t('savingsRecord')}>
            <input type="hidden" name="direction" value={movementType} />
            <div className="debt-pair">
              <label>{t('savingsAmount')}<input name="amount" inputMode="decimal" dir="ltr" required /></label>
              <label>{t('savingsMovementDate')}<input name="movedOn" type="date" dir="ltr" min="0001-01-01" max="9999-12-31" defaultValue={ledgerToday()} required /></label>
            </div>
            {message && <Toast message={t(message)} />}
            <div><button type="submit" className="primary" aria-busy={pending === 'move'}>{t('savingsRecord')}</button></div>
          </fieldset>
        </form>
      </section>
    </LedgerEditor>}
    <HistoryDisclosure className="record-history" title={t('savingsMovements')}>
      {movements.isPending && <p className="loading-state" role="status">{t('loading')}</p>}
      {movements.isError && <><Toast message={t('failed')} />
        <button type="button" className="secondary" disabled={movements.isFetching} aria-busy={movements.isFetching} onClick={() => void movements.refetch()}>{t('retry')}</button></>}
      {movements.data && (movements.data.length ? <ol className="history-list savings-movements" role="list">
        {movements.data.map(movement => <HistoryEntry key={movement.id}
          title={t(movement.direction === 'deposit' ? 'savingsDeposit' : 'savingsWithdraw')}
          timestamp={movement.moved_on} date={date} amount={<Amount value={movement.amount_minor / 100} />} />)}
      </ol> : <p className="empty-state">{t('savingsNoMovements')}</p>)}
    </HistoryDisclosure>
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
