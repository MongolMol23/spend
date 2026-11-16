import { Modal } from '../../ui/Modal'
import { Toast } from '../../ui/Toast'
import { useEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'
import type { Label } from '../../i18n/locales'
import type { Expense } from './api'

export function ArchivePurchase({ expense, busy, error, onArchive, onClose }: {
  expense: Expense
  busy: boolean
  error: Label | undefined
  onArchive: () => void
  onClose: () => void
}) {
  const { t } = useTranslation()
  const dialog = useRef<HTMLDialogElement>(null)
  useEffect(() => { dialog.current?.showModal() }, [])
  return <Modal ref={dialog} busy={busy} className="panel purchase-dialog" aria-labelledby="remove-purchase-title" onClose={onClose}>
    <h2 id="remove-purchase-title">{t('removePurchase')}</h2>
    <p><strong><bdi>{expense.item}</bdi></strong></p>
    <p>{t('purchaseRemovePrompt')}</p>
    {error && <Toast message={t(error)} />}
    <div className="purchase-actions">
      <button className="secondary" type="button" disabled={busy} onClick={() => dialog.current?.close()}>{t('cancelPurchase')}</button>
      <button className="primary" type="button" disabled={busy} onClick={onArchive}>{t('removePurchase')}</button>
    </div>
  </Modal>
}
