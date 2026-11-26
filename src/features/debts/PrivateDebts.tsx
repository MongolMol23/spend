import { FeatureHeading } from '../../ui/FeatureHeading'
import { Scale, ChevronRight, ArrowDownLeft, ArrowUpRight } from 'lucide-react'
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
import { ActiveLinkIndicator } from '../../ui/ActiveLinkIndicator'
import { changeDebt, debtKey, debtPageSize, listDebts, readDebt, type DebtChange, type DebtClient, type PrivateDebt } from './api'
import { DebtDetail } from './DebtDetail'
import { DebtForm } from './DebtForm'
import { DebtHistory } from './DebtHistory'
import { DebtPages } from './DebtPages'
import './debts.css'

function errorLabel(error: unknown): Label | undefined {
  if (!error) return undefined
  const message = typeof error === 'object' && 'message' in error ? error.message : ''
  if (message === 'private_debt_changed') return 'debtChanged'
  if (message === 'private_debt_payment_exceeds_balance') return 'debtInvalidPayment'
  return 'debtWriteFailed'
}

function debtSearch(direction: PrivateDebt['direction'], page = 0, id = '') {
  const params = new URLSearchParams()
  if (direction === 'owed') params.set('direction', direction)
  if (page > 0) params.set('page', String(page + 1))
  if (id) params.set('debt', id)
  return params.size ? '?' + params.toString() : ''
}

function DebtWorkspace({ client, owner }: { client: DebtClient; owner: string }) {
  const { t, i18n } = useTranslation()
  const date = new Intl.DateTimeFormat(i18n.language === 'ar' ? 'ar-EG' : 'en-EG', { dateStyle: 'medium', timeZone: 'UTC' })
  const [params, setParams] = useSearchParams()
  const activeId = params.get('debt') ?? ''
  const direction = params.get('direction') === 'owed' ? 'owed' : 'owe'
  const requestedPage = Number(params.get('page'))
  const page = Number.isInteger(requestedPage) && requestedPage > 1 && Number.isSafeInteger(requestedPage * debtPageSize)
    ? requestedPage - 1 : 0
  const [editorOpen, setEditorOpen] = useState(false)
  const [editSnapshot, setEditSnapshot] = useState<PrivateDebt>()
  const [notice, setNotice] = useState<Label>()
  const queryClient = useQueryClient()
  const list = useQuery({
    queryKey: [...debtKey, 'list', direction, page],
    queryFn: ({ signal }) => listDebts(client, direction, page, signal),
    enabled: !activeId,
  })
  const detail = useQuery({
    queryKey: [...debtKey, 'detail', activeId],
    queryFn: ({ signal }) => readDebt(client, activeId, signal),
    enabled: Boolean(activeId),
  })
  const mutation = useMutation({
    mutationFn: (change: DebtChange) => changeDebt(client, owner, change),
    onSuccess: async (id, change) => {
      if (change.kind === 'archive') {
        setParams(debtSearch(change.debt.direction), { replace: true })
        setEditSnapshot(undefined)
      } else if (change.kind === 'save') {
        setEditSnapshot(undefined)
        const next = debtSearch(change.input.direction, 0, id)
        if (next.slice(1) !== params.toString()) setParams(next, { replace: activeId === id })
      }
      if (change.kind === 'save') setEditorOpen(false)
      await queryClient.invalidateQueries({ queryKey: debtKey })
      setNotice(change.kind === 'pay' ? 'debtPaymentSaved' : change.kind === 'archive' ? 'debtArchived'
        : change.debt ? 'debtUpdated' : 'debtSaved')
    },
    onError: () => queryClient.invalidateQueries({ queryKey: debtKey }),
  })
  // Keep the revision that populated the form, even if a background refresh sees a newer one.
  const editing = activeId === editSnapshot?.id ? editSnapshot : undefined
  const error = errorLabel(mutation.error)
  const sameDebt = mutation.variables?.debt?.id === activeId
  const returnDirection = detail.data?.direction ?? direction
  const backTo = '/debts' + debtSearch(returnDirection, returnDirection === direction ? page : 0)
  const save = async (change: DebtChange) => {
    setNotice(undefined)
    try { await mutation.mutateAsync(change); return true } catch { return false }
  }

  function closeEditor() {
    setEditorOpen(false)
    setEditSnapshot(undefined)
    mutation.reset()
  }

  return <>
    <FeatureHeading title={t('privateDebts')} icon={Scale} accent="peach">
      {!activeId && <DebtHistory client={client} date={date} />}
    </FeatureHeading>
    {editorOpen && <LedgerEditor titleId="debt-entry-title" busy={mutation.isPending} onClose={closeEditor}>
      <DebtForm key={editing ? editing.id + ':' + editing.version : 'new'} debt={editing} direction={direction}
        busy={mutation.isPending} save={save}
        error={mutation.variables?.kind === 'save' && (sameDebt || !mutation.variables.debt) ? error : undefined}
        cancel={closeEditor} />
    </LedgerEditor>}
    {notice && <Toast kind="success" message={t(notice)} />}
    {!activeId && <nav className="site-nav ledger-view-switch" data-page-swipe-scope data-page-swipe-nav="debt-direction" aria-label={t('debtDirection')}>
      <ActiveLinkIndicator selection={direction} />
      <Link to="/debts" aria-current={direction === 'owe' ? 'page' : undefined}>
        <ArrowUpRight size={18} aria-hidden="true" />{t('owe')}
      </Link>
      <Link to={'/debts' + debtSearch('owed')} aria-current={direction === 'owed' ? 'page' : undefined}>
        <ArrowDownLeft size={18} aria-hidden="true" />{t('owed')}
      </Link>
    </nav>}
    <div className="debt-stack debt-stack-animated">
      {activeId && (detail.isPending ? <p className="loading-state" role="status">{t('loading')}</p>
        : detail.isError && !detail.data ? <section className="panel"><Toast message={t('failed')} />
          <div className="debt-actions"><button type="button" className="secondary" disabled={detail.isFetching} aria-busy={detail.isFetching} onClick={() => void detail.refetch()}>{t('retry')}</button>
            <Link className="secondary" to={backTo}>{t('debtBack')}</Link></div></section>
        : detail.data ? <DebtDetail key={activeId} client={client} debt={detail.data} date={date} backTo={backTo}
          busy={mutation.isPending} pending={mutation.isPending ? mutation.variables?.kind : undefined} save={save} edit={() => { setEditorOpen(true); setEditSnapshot(detail.data ?? undefined); mutation.reset() }}
          payError={sameDebt && mutation.variables?.kind === 'pay' ? error : undefined}
          archiveError={sameDebt && mutation.variables?.kind === 'archive' ? error : undefined} />
        : <section className="panel"><p className="empty-state">{t('debtMissing')}</p>
          <Link className="secondary" to={backTo}>{t('debtBack')}</Link></section>)}
      {!activeId && <section className="panel debt-list" data-page-swipe-panel="debt-direction">
        <LedgerHeading title={t('debtLog')} action={t('addDebt')} busy={mutation.isPending} onAdd={() => { setEditSnapshot(undefined); mutation.reset(); setEditorOpen(true) }} />
        {list.isPending && <p className="loading-state" role="status">{t('loading')}</p>}
        {list.isError && <><Toast message={t('failed')} />
          <button type="button" className="secondary" disabled={list.isFetching} aria-busy={list.isFetching} onClick={() => void list.refetch()}>{t('retry')}</button></>}
        {list.data && (list.data.length ? <ul className="ledger">
          {list.data.slice(0, debtPageSize).map(debt => <li key={debt.id}>
            <Link to={debtSearch(direction, page, debt.id)}
              className="debt-contact-card" data-direction={debt.direction} onClick={() => { setEditSnapshot(undefined); setNotice(undefined) }}>
              <span className="debt-avatar" aria-hidden="true">{Array.from(debt.contact)[0]?.toLocaleUpperCase()}</span>
              <span className="debt-contact-copy">
                <strong><bdi>{debt.contact}</bdi></strong>
                {debt.due_on && <time dateTime={debt.due_on}>{date.format(new Date(debt.due_on))}</time>}
              </span>
              <strong className="debt-contact-amount"><Amount value={(debt.amount_minor - debt.paid_minor) / 100} /></strong>
              <ChevronRight className="debt-contact-arrow" size={18} aria-hidden="true" />
            </Link>
          </li>)}
        </ul> : <p className="empty-state">{t(direction === 'owe' ? 'noDebtsOwe' : 'noDebtsOwed')}</p>)}
        <DebtPages page={page} hasNext={(list.data?.length ?? 0) > debtPageSize} move={next => setParams(debtSearch(direction, next))} />
      </section>}
    </div>
  </>
}

export function PrivateDebts() {
  const { t } = useTranslation()
  const owner = useLedgerOwner()
  return <main id="main" tabIndex={-1} className="shell">
    {(!supabase || !owner) && <FeatureHeading title={t('privateDebts')} icon={Scale} accent="peach" />}
    {!supabase ? <Toast message={t('failed')} />
      : owner === undefined ? <p role="status" className="loading-state">{t('loading')}</p>
      : owner === null ? <SignInLink />
      : <LedgerQueries key={owner}><DebtWorkspace client={supabase} owner={owner} /></LedgerQueries>}
  </main>
}
