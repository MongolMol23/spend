import { readHistory } from '../../data/readHistory'
import { cairoDayStart } from '../../data/calendar'
import { HistoryDates, useHistoryDates } from '../../ui/HistoryDates'
import { LedgerEditor, LedgerHeading } from '../../ui/LedgerEditor'
import { HistoryDisclosure } from '../../ui/HistoryEntry'
import { Toast } from '../../ui/Toast'
import { useState } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { clearRetryKey, retryKey } from '../../data/retryKey'
import type { Label } from '../../i18n/locales'
import { Amount } from '../../ui/Amount'
import { Select } from '../../ui/Select'
import { MonthPicker } from '../../ui/MonthPicker'
import {
  categoryLabel, expenseCategories, listPurchases, monthlyPurchases, purchaseHistory, purchasePageSize,
  purchasesKey, purchaseToday, type Expense, type PurchaseClient, type PurchaseInput,
} from './api'
import { ArchivePurchase } from './ArchivePurchase'
import { PurchaseForm } from './PurchaseForm'
import { PurchaseHistory } from './PurchaseHistory'

function changeError(error: unknown, fallback: Label): Label | undefined {
  if (!error) return undefined
  return typeof error === 'object' && 'message' in error && error.message === 'expense_changed'
    ? 'purchaseChanged' : fallback
}

function Pages({ label, page, hasNext, onPage }: {
  label: string; page: number; hasNext: boolean; onPage: (page: number) => void
}) {
  const { t, i18n } = useTranslation()
  if (!page && !hasNext) return null
  return <nav aria-label={label} className="purchase-actions purchase-pages">
    <button type="button" className="secondary" disabled={!page} onClick={() => onPage(page - 1)}>{t('previousPage')}</button>
    <span>{t('pageNumber', { page: new Intl.NumberFormat(i18n.language).format(page + 1) })}</span>
    <button type="button" className="secondary" disabled={!hasNext} onClick={() => onPage(page + 1)}>{t('nextPage')}</button>
  </nav>
}

export function PurchaseWorkspace({ client, owner }: { client: PurchaseClient; owner: string }) {
  const { t, i18n } = useTranslation()
  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-EG'
  const date = new Intl.DateTimeFormat(locale, { dateStyle: 'medium', timeZone: 'UTC' })
  const queryClient = useQueryClient()
  const [month, setMonth] = useState(() => purchaseToday().slice(0, 7))
  const [category, setCategory] = useState('')
  const [page, setPage] = useState(0)
  const historyDates = useHistoryDates()
  const { from, until } = historyDates
  const [editorOpen, setEditorOpen] = useState(false)
  const [editing, setEditing] = useState<Expense | null>(null)
  const [removing, setRemoving] = useState<Expense | null>(null)
  const [notice, setNotice] = useState<Label>()

  const list = useQuery({
    queryKey: [...purchasesKey, 'list', month, category, page],
    queryFn: ({ signal }) => listPurchases(client, month, category, page, signal),
  })
  const summary = useQuery({
    queryKey: [...purchasesKey, 'summary', month],
    queryFn: ({ signal }) => monthlyPurchases(client, month, signal),
  })
  const history = useQuery({
    queryKey: [...purchasesKey, 'history', from, until],
    queryFn: ({ signal }) => readHistory(purchasePageSize, page => purchaseHistory(client, page, signal, cairoDayStart(from), cairoDayStart(until))),
  })

  const save = useMutation({
    mutationFn: async ({ input, expense }: { input: PurchaseInput; expense: Expense | null }) => {
      const scope = owner + ':purchase:create'
      const id = expense?.id ?? await retryKey(scope, input)
      const { error } = await client.rpc('save_expense', {
        p_id: id, p_item: input.item, p_amount: input.amount, p_category: input.category, p_spent_on: input.spentOn,
        ...(input.note ? { p_note: input.note } : {}),
        ...(expense ? { p_version: expense.version } : {}),
      })
      if (error) throw error
      if (!expense) clearRetryKey(scope)
    },
    onSuccess: async (_result, { input, expense }) => {
      setEditorOpen(false)
      setEditing(null)
      setMonth(input.spentOn.slice(0, 7))
      setCategory('')
      setPage(0)
      await queryClient.invalidateQueries({ queryKey: purchasesKey })
      setNotice(expense ? 'purchaseUpdated' : 'purchaseCreated')
    },
    onError: error => {
      if (changeError(error, 'purchaseSaveFailed') === 'purchaseChanged') {
        void queryClient.invalidateQueries({ queryKey: purchasesKey })
      }
    },
  })
  const archive = useMutation({
    mutationFn: async (expense: Expense) => {
      const { error } = await client.rpc('archive_expense', { p_id: expense.id, p_version: expense.version })
      if (error) throw error
    },
    onSuccess: async (_result, expense) => {
      setRemoving(null)
      setEditing(current => current?.id === expense.id ? null : current)
      await queryClient.invalidateQueries({ queryKey: purchasesKey })
      setNotice('purchaseArchived')
    },
    onError: error => {
      if (changeError(error, 'purchaseRemoveFailed') === 'purchaseChanged') {
        void queryClient.invalidateQueries({ queryKey: purchasesKey })
      }
    },
  })
  const busy = save.isPending || archive.isPending

  const closeEditor = () => { setEditorOpen(false); setEditing(null); save.reset() }

  return <>
    {editorOpen && <LedgerEditor titleId="purchase-form-title" busy={busy} onClose={closeEditor}>
      <PurchaseForm key={editing?.id ?? 'new'} expense={editing} busy={busy}
        error={changeError(save.error, 'purchaseSaveFailed')}
        onCancel={closeEditor}
        onSave={async input => {
          setNotice(undefined)
          try { await save.mutateAsync({ input, expense: editing }); return true } catch { return false }
        }} />
    </LedgerEditor>}
    {notice && <Toast kind="success" message={t(notice)} />}
    <section className="panel purchase-log">
      <LedgerHeading title={t('purchaseList')} action={t('addPurchase')} busy={busy}
        onAdd={() => { setEditing(null); save.reset(); setEditorOpen(true) }}
        summary={summary.data && <p className="purchase-total">
          <span>{t('monthlyPurchases')}</span>
          <strong><Amount value={summary.data.reduce((total, row) => total + Number(row.total_minor), 0) / 100} /></strong>
        </p>} />
      <div className="purchase-toolbar">
        <div className="purchase-form-pair purchase-filters" role="group" aria-label={t('purchaseFilters')}>
          <MonthPicker value={month} onChange={value => { setMonth(value); setPage(0) }} />
          <label>{t('purchaseCategory')}
            <Select value={category} onChange={event => { setCategory(event.target.value); setPage(0) }}>
              <option value="">{t('allCategories')}</option>
              {expenseCategories.map(value => <option value={value} key={value}>{t(value)}</option>)}
            </Select>
          </label>
        </div>
      </div>
      {list.isPending || summary.isPending ? <p className="loading-state" role="status">{t('loading')}</p> : null}
      {(list.isError || summary.isError) && <>
        <Toast message={t('failed')} />
        <button type="button" className="secondary" onClick={() => { void list.refetch(); void summary.refetch() }}>{t('retry')}</button>
      </>}
      {list.data && (list.data.length ? <ul className="ledger">
        {list.data.slice(0, purchasePageSize).map(expense => <li className="purchase-record" key={expense.id}>
          <div className="purchase-record-details">
            <div className="row purchase-row"><strong id={'purchase-item-' + expense.id}><bdi>{expense.item}</bdi></strong>
              <strong><Amount value={expense.amount_minor / 100} /></strong></div>
            <div className="row purchase-row muted"><span>{t(categoryLabel(expense.category))}</span>
              <time dateTime={expense.spent_on}>{date.format(new Date(expense.spent_on))}</time></div>
            {expense.note && <p className="reason"><bdi>{expense.note}</bdi></p>}
          </div>
          <div className="purchase-actions">
            <button type="button" className="secondary" disabled={busy} aria-describedby={'purchase-item-' + expense.id}
              onClick={() => { setEditorOpen(true); setEditing(expense); save.reset(); setNotice(undefined) }}>{t('editPurchase')}</button>
            <button type="button" className="secondary purchase-remove" disabled={busy} aria-describedby={'purchase-item-' + expense.id}
              onClick={() => { archive.reset(); setRemoving(expense); setNotice(undefined) }}>{t('removePurchase')}</button>
          </div>
        </li>)}
      </ul> : <p className="empty-state">{t('noPurchases')}</p>)}
      <Pages label={t('purchasePages')} page={page} hasNext={(list.data?.length ?? 0) > purchasePageSize} onPage={setPage} />
    </section>
    <HistoryDisclosure className="purchase-history" title={t('purchaseHistory')}
    filters={<HistoryDates {...historyDates} />}>
      {history.isPending && <p className="loading-state" role="status">{t('loading')}</p>}
      {history.isError && <><Toast message={t('failed')} />
        <button type="button" className="secondary" onClick={() => void history.refetch()}>{t('retry')}</button></>}
      {history.data && <PurchaseHistory events={history.data} />}
    </HistoryDisclosure>
    {removing && <ArchivePurchase expense={removing} busy={archive.isPending}
      error={changeError(archive.error, 'purchaseRemoveFailed')}
      onArchive={() => archive.mutate(removing)} onClose={() => setRemoving(null)} />}
  </>
}
