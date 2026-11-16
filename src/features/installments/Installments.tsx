import { FeatureHeading } from '../../ui/FeatureHeading'
import { CalendarDays } from 'lucide-react'
import { LedgerEditor, LedgerHeading } from '../../ui/LedgerEditor'
import { Toast } from '../../ui/Toast'
import { SignInLink } from '../accounts/SignInLink'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { LedgerQueries, useLedgerOwner } from '../../data/LedgerSession'
import { supabase } from '../../data/supabase'
import type { Label } from '../../i18n/locales'
import { Amount } from '../../ui/Amount'
import { DebtPages } from '../debts/DebtPages'
import { changeInstallment, installmentKey, installmentPageSize, listInstallmentPlans, readInstallmentPlan, type InstallmentChange, type InstallmentClient } from './api'
import { InstallmentHistory } from './InstallmentHistory'
import { PlanDetail } from './PlanDetail'
import { PlanForm } from './PlanForm'
import './installments.css'

const errors: Record<string, Label> = {
  installment_schedule: 'installmentInvalidSchedule',
  installment_schedule_locked: 'installmentLocked',
  installment_payment_exceeds_balance: 'installmentInvalidPayment',
  installment_changed: 'installmentChanged',
}

function InstallmentWorkspace({ client, owner }: { client: InstallmentClient; owner: string }) {
  const { t, i18n } = useTranslation()
  const date = new Intl.DateTimeFormat(i18n.language === 'ar' ? 'ar-EG' : 'en-EG', { dateStyle: 'medium', timeZone: 'UTC' })
  const [params, setParams] = useSearchParams()
  const id = params.get('plan') ?? ''
  const [page, setPage] = useState(0)
  // Keep the version that the user opened for editing across background refetches.
  const [editorOpen, setEditorOpen] = useState(false)
  const [editSnapshot, setEditSnapshot] = useState<NonNullable<Awaited<ReturnType<typeof readInstallmentPlan>>>>()
  const [notice, setNotice] = useState<Label>()
  const queryClient = useQueryClient()
  const list = useQuery({
    queryKey: [...installmentKey, 'list', page],
    queryFn: ({ signal }) => listInstallmentPlans(client, page, signal),
  })
  const detail = useQuery({
    queryKey: [...installmentKey, 'detail', id],
    queryFn: ({ signal }) => readInstallmentPlan(client, id, signal),
    enabled: Boolean(id),
  })
  const mutation = useMutation({
    mutationFn: (change: InstallmentChange) => changeInstallment(client, owner, change),
    onSuccess: async (planId, change) => {
      if (change.kind !== 'pay') {
        setEditSnapshot(undefined)
        setPage(0)
        if (id !== planId) setParams({ plan: planId })
      }
      if (change.kind === 'save') setEditorOpen(false)
      await queryClient.invalidateQueries({ queryKey: installmentKey })
      setNotice(change.kind === 'pay' ? 'debtPaymentSaved' : change.kind === 'archive' ? 'installmentArchived'
        : change.plan ? 'installmentUpdated' : 'installmentCreated')
    },
    onError: () => queryClient.invalidateQueries({ queryKey: installmentKey }),
  })
  const error = mutation.error ? errors[mutation.error.message] ?? 'failed' : undefined
  const samePlan = mutation.variables?.plan?.id === id
  const editing = id === editSnapshot?.id && !detail.data?.archived_at ? editSnapshot : undefined

  async function save(change: InstallmentChange) {
    setNotice(undefined)
    try { await mutation.mutateAsync(change); return true } catch { return false }
  }

  function closeEditor() {
    setEditorOpen(false)
    setEditSnapshot(undefined)
    mutation.reset()
  }

  return <>
    {editorOpen && <LedgerEditor titleId="installment-form-title" busy={mutation.isPending} onClose={closeEditor}>
      <PlanForm key={editing ? editing.id + ':' + editing.version : 'new'} plan={editing} dues={editing?.installment_dues}
        busy={mutation.isPending} save={save}
        error={mutation.variables?.kind === 'save' && (samePlan || !mutation.variables.plan) ? error : undefined}
        cancel={closeEditor} />
    </LedgerEditor>}
    {notice && <Toast kind="success" message={t(notice)} />}
    <div className="debt-stack">
      {id && (detail.isPending ? <p className="loading-state" role="status">{t('loading')}</p>
        : detail.isError && !detail.data ? <section className="panel"><Toast message={t('failed')} />
          <button type="button" className="secondary" onClick={() => void detail.refetch()}>{t('retry')}</button></section>
        : detail.data ? <PlanDetail key={id} plan={detail.data} dues={detail.data.installment_dues} date={date}
          busy={mutation.isPending} save={save} edit={() => { setEditorOpen(true); setEditSnapshot(detail.data ?? undefined); mutation.reset() }}
          paymentError={samePlan && mutation.variables?.kind === 'pay' ? error : undefined}
          archiveError={samePlan && mutation.variables?.kind === 'archive' ? error : undefined} />
        : <p className="empty-state">{t('installmentMissing')}</p>)}
      <section className="panel savings-list">
        <LedgerHeading title={t('installmentActive')} action={t('installmentAdd')} busy={mutation.isPending} onAdd={() => { setEditSnapshot(undefined); mutation.reset(); setEditorOpen(true) }} />
        {list.isPending && <p className="loading-state" role="status">{t('loading')}</p>}
        {list.isError && <><Toast message={t('failed')} />
          <button type="button" className="secondary" onClick={() => void list.refetch()}>{t('retry')}</button></>}
        {list.data && (list.data.length ? <ul className="ledger">
          {list.data.slice(0, installmentPageSize).map(plan => <li key={plan.id}>
            <Link to={'?plan=' + plan.id} aria-current={id === plan.id ? 'true' : undefined}
              className="row debt-row debt-list-link" onClick={() => { setEditSnapshot(undefined); setNotice(undefined) }}>
              <strong className="reason"><bdi>{plan.name}</bdi></strong><Amount value={plan.total_minor / 100} />
            </Link>
          </li>)}
        </ul> : <p className="empty-state">{t('installmentEmpty')}</p>)}
        <DebtPages page={page} hasNext={(list.data?.length ?? 0) > installmentPageSize} move={setPage} />
      </section>
    </div>
    <InstallmentHistory client={client} date={date} />
  </>
}

export function Installments() {
  const { t } = useTranslation()
  const owner = useLedgerOwner()
  return <main id="main" tabIndex={-1} className="shell">
    <FeatureHeading title={t('installments')} icon={CalendarDays} accent="amber" />
    {!supabase ? <Toast message={t('failed')} />
      : owner === undefined ? <p role="status" className="loading-state">{t('loading')}</p>
      : owner === null ? <SignInLink />
      : <LedgerQueries key={owner}><InstallmentWorkspace client={supabase} owner={owner} /></LedgerQueries>}
  </main>
}
