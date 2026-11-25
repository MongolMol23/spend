import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ArrowLeft, ChevronRight, Folder, FolderPlus, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { clearRetryKey, retryKey } from '../../data/retryKey'
import { useFormats } from '../../i18n/useFormats'
import { Amount } from '../../ui/Amount'
import { LedgerEditor, LedgerHeading } from '../../ui/LedgerEditor'
import { Toast } from '../../ui/Toast'
import { categoryLabel, purchasesKey, type Expense, type PurchaseClient } from './api'

const collectionsKey = [...purchasesKey, 'folders'] as const
const totalMinor = (expenses: Expense[]) => expenses.reduce((sum, expense) => sum + expense.amount_minor, 0)
export type PurchaseDestination = { kind: 'collection' | 'section'; id: string; name: string; collection: string }

export function PurchaseCollections({ client, owner, busy, onAddPurchase, purchaseActions }: {
  client: PurchaseClient; owner: string; busy: boolean
  onAddPurchase: (folder: PurchaseDestination) => void
  purchaseActions: (expense: Expense, descriptionId: string) => ReactNode
}) {
  const { t } = useTranslation()
  const { date } = useFormats()
  const titleId = useId()
  const queryClient = useQueryClient()
  const [editor, setEditor] = useState<{ collection?: string }>()
  const [activeGroup, setActiveGroup] = useState<string>()
  const [activeSection, setActiveSection] = useState<string>()
  const list = useQuery({
    queryKey: collectionsKey,
    queryFn: async ({ signal }) => {
      const { data, error } = await client.rpc('list_purchase_folders').abortSignal(signal)
      if (error) throw error
      return data
    },
  })
  const create = useMutation({
    mutationFn: async ({ name, collection }: { name: string; collection?: string }) => {
      const scope = owner + ':purchase-collection:' + (collection ?? 'root')
      const id = await retryKey(scope, name)
      const { error } = await client.rpc('create_purchase_collection', {
        p_id: id, p_name: name, ...(collection ? { p_collection: collection } : {}),
      })
      if (error) throw error
      clearRetryKey(scope)
      return id
    },
    onSuccess: async (id, { collection }) => {
      setActiveGroup(collection ?? id)
      setActiveSection(collection ? id : undefined)
      setEditor(undefined)
      await queryClient.invalidateQueries({ queryKey: collectionsKey })
    },
  })

  function openEditor(collection?: string) {
    create.reset()
    setEditor({ collection })
  }

  function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (create.isPending || !editor) return
    const input = event.currentTarget.elements.namedItem('name') as HTMLInputElement
    const name = input.value.trim()
    if (!name) { input.value = ''; input.reportValidity(); return }
    create.mutate({ name, collection: editor.collection })
  }

  const group = list.data?.find(item => item.id === activeGroup)
  const section = group?.sections.find(item => item.id === activeSection)
  const expenses = section?.purchases ?? group?.purchases ?? []
  const total = group ? totalMinor(expenses) + (section ? 0 : group.sections.reduce((sum, item) => sum + totalMinor(item.purchases), 0)) : 0

  function folderRow(id: string, name: string, minor: number, onClick: () => void) {
    return <button type="button" className="purchase-folder-row" key={id} onClick={onClick}>
      <span className="purchase-record-icon" aria-hidden="true"><Folder size={19} /></span>
      <strong><bdi>{name}</bdi></strong>
      <Amount value={minor / 100} />
      <ChevronRight className="purchase-folder-arrow" size={17} aria-hidden="true" />
    </button>
  }

  return <section className="panel purchase-collections">
    {!group && <LedgerHeading title={t('purchaseCollections')} action={t('addPurchaseCollection')} busy={busy || create.isPending}
      onAdd={() => openEditor()} />}
    {list.isPending && <p className="loading-state" role="status">{t('loading')}</p>}
    {list.isError && <><Toast message={t('failed')} /><button className="secondary" type="button" onClick={() => void list.refetch()}>{t('retry')}</button></>}
    {list.data?.length === 0 && <p className="empty-state">{t('noPurchaseCollections')}</p>}
    {!group && <div className="purchase-folder-list">{list.data?.map(item => folderRow(item.id, item.name,
      totalMinor(item.purchases) + item.sections.reduce((sum, subfolder) => sum + totalMinor(subfolder.purchases), 0),
      () => { setActiveSection(undefined); setActiveGroup(item.id) }))}</div>}
    {group && <>
      <button type="button" className="purchase-folder-back" onClick={() => section ? setActiveSection(undefined) : setActiveGroup(undefined)}>
        <ArrowLeft size={16} aria-hidden="true" /><bdi>{section ? group.name : t('purchaseCollections')}</bdi>
      </button>
      <div className="purchase-folder-heading">
        <h2><bdi>{section?.name ?? group.name}</bdi></h2>
        <div><small>{t('purchaseFolderTotal')}</small><strong><Amount value={total / 100} /></strong></div>
      </div>
      <div className="purchase-folder-actions">
        <button className="primary purchase-collection-add" type="button" disabled={busy}
          onClick={() => onAddPurchase({ kind: section ? 'section' : 'collection', id: section?.id ?? group.id,
            name: section?.name ?? group.name, collection: group.name })}>
          <Plus size={16} aria-hidden="true" />{t('addPurchase')}
        </button>
        {!section && <button className="secondary purchase-collection-add" type="button" disabled={busy || create.isPending}
          onClick={() => openEditor(group.id)}>
          <FolderPlus size={17} aria-hidden="true" />{t('addPurchaseSection')}
        </button>}
      </div>
      {expenses.length === 0 && (section || group.sections.length === 0) && <p className="muted">{t('noFolderPurchases')}</p>}
      {!section && group.sections.length > 0 && <div className="purchase-folder-list">
        {group.sections.map(item => folderRow(item.id, item.name, totalMinor(item.purchases), () => setActiveSection(item.id)))}
      </div>}
      {expenses.length > 0 && <ul className="purchase-folder-expenses">
        {expenses.map(expense => <li key={expense.id}>
          <div className="purchase-group-copy" id={'folder-expense-' + expense.id}>
            <strong><bdi>{expense.item}</bdi></strong>
            <small>{t(categoryLabel(expense.category))} · <time dateTime={expense.spent_on}>{date.format(new Date(expense.spent_on))}</time></small>
          </div>
          <strong><Amount value={expense.amount_minor / 100} /></strong>
          {purchaseActions(expense, 'folder-expense-' + expense.id)}
          {expense.note && <p className="reason purchase-group-note"><bdi>{expense.note}</bdi></p>}
        </li>)}
      </ul>}
    </>}
    {editor && <LedgerEditor titleId={titleId} busy={create.isPending} onClose={() => setEditor(undefined)}>
      <section className="panel purchase-entry">
        <h2 id={titleId}>{t(editor.collection ? 'addPurchaseSection' : 'addPurchaseCollection')}</h2>
        <form className="purchase-form" onSubmit={submit}>
          <label>{t(editor.collection ? 'purchaseSectionName' : 'purchaseCollectionName')}
            <input name="name" dir="auto" maxLength={120} required disabled={create.isPending} />
          </label>
          {create.isError && <Toast message={t('purchaseSaveFailed')} />}
          <button className="primary" type="submit" disabled={create.isPending} aria-busy={create.isPending}>
            {t(editor.collection ? 'addPurchaseSection' : 'addPurchaseCollection')}
          </button>
        </form>
      </section>
    </LedgerEditor>}
  </section>
}
