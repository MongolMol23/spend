import { Modal } from './Modal'
import { useLayoutEffect, useRef, type ReactNode } from 'react'
import { Plus, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function LedgerHeading({ title, action, onAdd, busy, summary }: {
  title: string
  action: string
  onAdd: () => void
  busy: boolean
  summary?: ReactNode
}) {
  return <div className="ledger-heading">
    <h2>{title}</h2>
    {summary}
    <button type="button" className="primary" disabled={busy} onClick={onAdd}>
      <Plus size={18} aria-hidden="true" />{action}
    </button>
  </div>
}

export function LedgerEditor({ titleId, busy, onClose, children }: {
  titleId: string
  busy: boolean
  onClose: () => void
  children: ReactNode
}) {
  const { t } = useTranslation()
  const dialog = useRef<HTMLDialogElement>(null)

  useLayoutEffect(() => {
    const element = dialog.current
    if (!element) return
    element.showModal()
    // Close before removal so the browser can return focus to the opener.
    return () => element.close()
  }, [])

  return <Modal ref={dialog} className="ledger-editor" aria-labelledby={titleId} busy={busy} onDismiss={onClose}>
    {children}
    <button type="button" className="sidebar-close ledger-editor-close" data-modal-dismiss
      disabled={busy} aria-label={t('cancelPurchase')} onClick={onClose}>
      <X size={19} aria-hidden="true" />
    </button>
  </Modal>
}
