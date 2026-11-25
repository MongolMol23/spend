import { useId, useState, type FormEvent, type ReactNode } from 'react'
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query'
import { ChevronDown, FolderOpen, Plus } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { clearRetryKey, retryKey } from '../../data/retryKey'
import { useFormats } from '../../i18n/useFormats'
import { Amount } from '../../ui/Amount'
import { LedgerEditor, LedgerHeading } from '../../ui/LedgerEditor'
import { Toast } from '../../ui/Toast'
import { categoryLabel, purchasesKey, type Expense, type PurchaseClient } from './api'

const collectionsKey = [...purchasesKey, 'collections'] as const

export function PurchaseCollections({ client, owner, busy, onAddPurchase, purchaseActions }: {
  client: PurchaseClient; owner: string; busy: boolean
  onAddPurchase: (section: { id: string; name: string; collection: string }) => void
  purchaseActions: (expense: Expense, descriptionId: string) => ReactNode
}) {
  const { t } = useTranslation()
  const { date } = useFormats()
  const titleId = useId()
  const queryClient = useQueryClient()
  const [editor, setEditor] = useState<{ collection?: string }>()
  const [activeGroup, setActiveGroup] = useState<string>()
  const list = useQuery({
    queryKey: collectionsKey,
    queryFn: async ({ signal }) => {
      const { data, error } = await client.rpc('list_purchase_collections').abortSignal(signal)
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

  return <section className="panel purchase-collections">
    <LedgerHeading title={t('purchaseCollections')} action={t('addPurchaseCollection')} busy={busy || create.isPending}
      onAdd={() => openEditor()} />
    {list.isPending && <p className="loading-state" role="status">{t('loading')}</p>}
    {list.isError && <><Toast message={t('failed')} /><button className="secondary" type="button" onClick={() => void list.refetch()}>{t('retry')}</button></>}
    {list.data?.length === 0 && <p className="empty-state">{t('noPurchaseCollections')}</p>}
    {list.data?.map(group => {
      const total = group.sections.reduce((sum, section) =>
        section.purchases.reduce((sectionSum, expense) => sectionSum + expense.amount_minor, sum), 0)
      return <details key={group.id} className="purchase-collection" open={activeGroup === group.id}>
        <summary onClick={event => { event.preventDefault(); setActiveGroup(current => current === group.id ? undefined : group.id) }}>
          <span className="purchase-record-icon" aria-hidden="true"><FolderOpen size={19} /></span>
          <strong><bdi>{group.name}</bdi></strong>
          <strong><Amount value={total / 100} /></strong>
          <ChevronDown className="purchase-group-chevron" size={17} aria-hidden="true" />
        </summary>
        <div className="purchase-collection-body">
          {group.sections.map(section => <section key={section.id} className="purchase-collection-section">
            <header>
              <h3><bdi>{section.name}</bdi></h3>
              <strong><Amount value={section.purchases.reduce((sum, expense) => sum + expense.amount_minor, 0) / 100} /></strong>
            </header>
            {section.purchases.length > 0 && <ul className="purchase-group-payments">
              {section.purchases.map(expense => <li key={expense.id}>
                <div className="purchase-group-copy" id={'section-expense-' + expense.id}>
                  <strong><bdi>{expense.item}</bdi></strong>
                  <small>{t(categoryLabel(expense.category))} · <time dateTime={expense.spent_on}>{date.format(new Date(expense.spent_on))}</time></small>
                </div>
                <strong><Amount value={expense.amount_minor / 100} /></strong>
                {purchaseActions(expense, 'section-expense-' + expense.id)}
                {expense.note && <p className="reason purchase-group-note"><bdi>{expense.note}</bdi></p>}
              </li>)}
            </ul>}
            <button className="secondary purchase-collection-add" type="button" disabled={busy}
              onClick={() => onAddPurchase({ id: section.id, name: section.name, collection: group.name })}>
              <Plus size={16} aria-hidden="true" />{t('addPurchase')}
            </button>
          </section>)}
          <button className="secondary purchase-collection-add" type="button" disabled={busy || create.isPending} onClick={() => openEditor(group.id)}>
            <Plus size={16} aria-hidden="true" />{t('addPurchaseSection')}
          </button>
        </div>
      </details>
    })}
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
