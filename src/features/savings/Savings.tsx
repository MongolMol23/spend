import { FeatureHeading } from '../../ui/FeatureHeading'
import { ChevronRight, Vault } from 'lucide-react'
import { LedgerEditor, LedgerHeading } from '../../ui/LedgerEditor'
import { Toast } from '../../ui/Toast'
import { SignInLink } from '../accounts/SignInLink'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { LedgerQueries, useLedgerOwner } from '../../data/LedgerSession'
import { supabase } from '../../data/supabase'
import type { Label } from '../../i18n/locales'
import { Amount } from '../../ui/Amount'
import { DebtPages } from '../debts/DebtPages'
import { changeSavings, goalInput, listSavingsGoals, readSavingsGoal, savingsKey, savingsPageSize, type SavingsChange, type SavingsClient, type SavingsGoal } from './api'
import { SavingsDetail } from './SavingsDetail'
import { SavingsHistory } from './SavingsHistory'
import './savings.css'

function errorLabel(error: unknown): Label | undefined {
  if (!error) return undefined
  const message = typeof error === 'object' && 'message' in error ? error.message : ''
  if (message === 'savings_changed') return 'savingsChanged'
  if (message === 'savings_insufficient') return 'savingsInsufficient'
  if (message === 'savings_balance_limit') return 'savingsLimit'
  if (message === 'savings_invalid_movement') return 'savingsInvalidMovement'
  return 'failed'
}

function GoalForm({ goal, busy, error, save, cancel }: {
  goal?: SavingsGoal
  busy: boolean
  error?: Label
  save: (change: SavingsChange) => Promise<boolean>
  cancel: () => void
}) {
  const { t } = useTranslation()
  const [invalid, setInvalid] = useState(false)
  const name = useRef<HTMLInputElement>(null)
  const message = invalid ? 'savingsInvalidGoal' : error
  useEffect(() => { if (goal) name.current?.focus() }, [goal])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const result = goalInput.safeParse(Object.fromEntries(new FormData(form)))
    if (!result.success) {
      setInvalid(true)
      const field = form.elements.namedItem(String(result.error.issues[0]?.path[0]))
      if (field instanceof HTMLElement) field.focus()
      return
    }
    setInvalid(false)
    if (await save({ kind: 'save', goal, input: result.data }) && !goal) form.reset()
  }
  return <section className="panel savings-entry">
    <h2 id="savings-entry-title">{t(goal ? 'savingsEdit' : 'savingsAdd')}</h2>
    <form onSubmit={submit} noValidate onChange={() => setInvalid(false)}>
      <fieldset className="debt-form" aria-labelledby="savings-entry-title" disabled={busy}>
        <label>{t('savingsName')}<input ref={name} name="name" defaultValue={goal?.name} dir="auto" required maxLength={120} /></label>
        <label>{t('savingsTarget')}<input name="target" defaultValue={goal ? (goal.target_minor / 100).toFixed(2) : ''}
          inputMode="decimal" dir="ltr" required /></label>
        <label>{t('savingsOptionalDate')}<input name="targetOn" type="date" dir="ltr" min="0001-01-01" max="9999-12-31" defaultValue={goal?.target_on ?? ''} /></label>
        {message && <Toast message={t(message)} />}
        <div className="debt-actions">
          <button type="submit" className="primary" aria-busy={busy}>{t('savingsSave')}</button>
          {goal && <button type="button" className="secondary" onClick={cancel}>{t('cancelPurchase')}</button>}
        </div>
      </fieldset>
    </form>
  </section>
}

function SavingsWorkspace({ client, owner }: { client: SavingsClient; owner: string }) {
  const { t, i18n } = useTranslation()
  const date = new Intl.DateTimeFormat(i18n.language === 'ar' ? 'ar-EG' : 'en-EG', { dateStyle: 'medium', timeZone: 'UTC' })
  const [params, setParams] = useSearchParams()
  const id = params.get('goal') ?? ''
  const [page, setPage] = useState(0)
  const [editorOpen, setEditorOpen] = useState(false)
  const [editSnapshot, setEditSnapshot] = useState<SavingsGoal>()
  const [notice, setNotice] = useState<Label>()
  const queryClient = useQueryClient()
  const list = useQuery({
    queryKey: [...savingsKey, 'list', page],
    queryFn: ({ signal }) => listSavingsGoals(client, page, signal),
  })
  const detail = useQuery({
    queryKey: [...savingsKey, 'detail', id],
    queryFn: ({ signal }) => readSavingsGoal(client, id, signal),
    enabled: Boolean(id),
  })
  const mutation = useMutation({
    mutationFn: (change: SavingsChange) => changeSavings(client, owner, change),
    onSuccess: async (goalId, change) => {
      if (change.kind !== 'move') {
        setEditSnapshot(undefined)
        setPage(0)
        if (id !== goalId) setParams({ goal: goalId })
      }
      if (change.kind === 'save') setEditorOpen(false)
      await queryClient.invalidateQueries({ queryKey: savingsKey })
      const label = change.kind === 'archive' ? 'savingsArchived'
        : change.kind === 'move' ? (change.input.direction === 'deposit' ? 'savingsDeposited' : 'savingsWithdrawn')
        : change.goal ? 'savingsUpdated' : 'savingsCreated'
      setNotice(label)
    },
    onError: () => queryClient.invalidateQueries({ queryKey: savingsKey }),
  })
  const editing = id === editSnapshot?.id && !detail.data?.archived_at ? editSnapshot : undefined
  const error = errorLabel(mutation.error)
  const sameGoal = mutation.variables?.goal?.id === id
  const save = async (change: SavingsChange) => {
    setNotice(undefined)
    try { await mutation.mutateAsync(change); return true } catch { return false }
  }

  function closeEditor() {
    setEditorOpen(false)
    setEditSnapshot(undefined)
    mutation.reset()
  }

  return <>
    {editorOpen && <LedgerEditor titleId="savings-entry-title" busy={mutation.isPending} onClose={closeEditor}>
      <GoalForm key={editing ? editing.id + ':' + editing.version : 'new'} goal={editing}
        busy={mutation.isPending} save={save}
        error={mutation.variables?.kind === 'save' && (sameGoal || !mutation.variables.goal) ? error : undefined}
        cancel={closeEditor} />
    </LedgerEditor>}
    {notice && <Toast kind="success" message={t(notice)} />}
    <div className="debt-stack">
      {id && (detail.isPending ? <p className="loading-state" role="status">{t('loading')}</p>
        : detail.isError && !detail.data ? <section className="panel"><Toast message={t('failed')} />
          <div className="debt-actions"><button type="button" className="secondary" disabled={detail.isFetching} aria-busy={detail.isFetching} onClick={() => void detail.refetch()}>{t('retry')}</button>
            <Link className="secondary" to="/savings">{t('savingsBack')}</Link></div></section>
        : detail.data ? <SavingsDetail key={id} client={client} goal={detail.data} date={date} busy={mutation.isPending} pending={mutation.isPending ? mutation.variables?.kind : undefined}
          save={save} edit={() => { setEditorOpen(true); setEditSnapshot(detail.data ?? undefined); mutation.reset() }}
          movementError={sameGoal && mutation.variables?.kind === 'move' ? error : undefined}
          archiveError={sameGoal && mutation.variables?.kind === 'archive' ? error : undefined} />
        : <section className="panel"><p className="empty-state">{t('savingsMissing')}</p>
          <Link className="secondary" to="/savings">{t('savingsBack')}</Link></section>)}
      {!id && <section className="panel savings-list debt-list">
        <LedgerHeading title={t('savingsActive')} action={t('savingsAdd')} busy={mutation.isPending} onAdd={() => { setEditSnapshot(undefined); mutation.reset(); setEditorOpen(true) }} />
        {list.isPending && <p className="loading-state" role="status">{t('loading')}</p>}
        {list.isError && <><Toast message={t('failed')} />
          <button type="button" className="secondary" disabled={list.isFetching} aria-busy={list.isFetching} onClick={() => void list.refetch()}>{t('retry')}</button></>}
        {list.data && (list.data.length ? <ul className="ledger">
          {list.data.slice(0, savingsPageSize).map(goal => <li key={goal.id}>
            <Link to={'?goal=' + goal.id} aria-current={id === goal.id ? 'true' : undefined}
              className="debt-contact-card savings-goal-card" onClick={() => { setEditSnapshot(undefined); setNotice(undefined) }}>
              <span className="debt-avatar" aria-hidden="true"><Vault size={20} /></span>
              <span className="debt-contact-copy">
                <strong><bdi>{goal.name}</bdi></strong>
                <span className="muted">{t('savingsGoalTarget')} <Amount value={goal.target_minor / 100} /></span>
                <span className="debt-progress" role="progressbar" aria-label={t('savingsProgressNamed', { name: goal.name })}
                  aria-valuemin={0} aria-valuemax={goal.target_minor} aria-valuenow={Math.min(goal.saved_minor, goal.target_minor)}>
                  <span style={{ inlineSize: Math.min(100, goal.saved_minor / goal.target_minor * 100) + '%' }} />
                </span>
                {goal.target_on && <time dateTime={goal.target_on}>{date.format(new Date(goal.target_on))}</time>}
              </span>
              <strong className="debt-contact-amount"><Amount value={goal.saved_minor / 100} /></strong>
              <ChevronRight className="debt-contact-arrow" size={18} aria-hidden="true" />
            </Link>
          </li>)}
        </ul> : <p className="empty-state">{t('savingsEmpty')}</p>)}
        <DebtPages page={page} hasNext={(list.data?.length ?? 0) > savingsPageSize} move={setPage} />
      </section>}
    </div>
    {!id && <SavingsHistory client={client} date={date} />}
  </>
}

export function Savings() {
  const { t } = useTranslation()
  const owner = useLedgerOwner()
  return <main id="main" tabIndex={-1} className="shell">
    <FeatureHeading title={t('savingsGoals')} icon={Vault} accent="mint" />
    {!supabase ? <Toast message={t('failed')} />
      : owner === undefined ? <p role="status" className="loading-state">{t('loading')}</p>
      : owner === null ? <SignInLink />
      : <LedgerQueries key={owner}><SavingsWorkspace client={supabase} owner={owner} /></LedgerQueries>}
  </main>
}
