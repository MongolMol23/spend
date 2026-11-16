import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { Check, CircleAlert, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'

export function Toast({ message, kind = 'error' }: { message: string; kind?: 'success' | 'error' }) {
  return <ToastMessage key={message} message={message} kind={kind} />
}

function ToastMessage({ message, kind }: { message: string; kind: 'success' | 'error' }) {
  const { t } = useTranslation()
  const anchor = useRef<HTMLSpanElement>(null)
  const [container, setContainer] = useState<HTMLElement | null>(null)
  const [dismissed, setDismissed] = useState(false)
  const [hovered, setHovered] = useState(false)
  const [focused, setFocused] = useState(false)
  const Icon = kind === 'success' ? Check : CircleAlert

  useLayoutEffect(() => {
    // A modal dialog sits above the page, so its feedback must stay inside it.
    setContainer(anchor.current?.closest('dialog') ?? document.getElementById('toast-region'))
  }, [])

  useEffect(() => {
    if (!container || dismissed || hovered || focused) return
    const timeout = window.setTimeout(() => setDismissed(true), kind === 'success' ? 5000 : 8000)
    return () => window.clearTimeout(timeout)
  }, [container, dismissed, focused, hovered, kind])

  return <>
    <span ref={anchor} hidden />
    {container && createPortal(
      <div className="app-toast" data-kind={kind} data-dismissed={dismissed} inert={dismissed}
        onMouseEnter={() => setHovered(true)} onMouseLeave={() => setHovered(false)}
        onFocus={() => setFocused(true)} onBlur={() => setFocused(false)}>
        <Icon size={19} aria-hidden="true" />
        <span role={kind === 'success' ? 'status' : 'alert'}>{message}</span>
        <button type="button" aria-label={t('dismissToast')} onClick={() => setDismissed(true)}>
          <X size={16} aria-hidden="true" />
        </button>
      </div>,
      container,
    )}
  </>
}
