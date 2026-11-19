import { useLayoutEffect, useRef, type PointerEvent } from 'react'
import { useNavigate, useSearchParams } from 'react-router'
import { AccountForm } from './AccountForm'
import { friendInviteAccountPath, inviteUsername } from '../connections/friendInvite'

type Mode = 'signin' | 'signup'

export function AuthSwitch({ mode }: { mode: Mode }) {
  const navigate = useNavigate()
  const [params] = useSearchParams()
  const panel = useRef<HTMLDivElement>(null)
  const view = useRef<HTMLDivElement>(null)
  const previousMode = useRef(mode)
  const start = useRef<{ id: number; x: number; y: number } | null>(null)
  const nextPath = friendInviteAccountPath(inviteUsername(params.get('friend')), mode === 'signin')

  useLayoutEffect(() => {
    if (previousMode.current !== mode) {
      if (view.current) view.current.dataset.switched = 'true'
      panel.current?.querySelector('h1')?.focus({ preventScroll: true })
    }
    previousMode.current = mode
  }, [mode])

  function switchView() {
    void navigate(nextPath)
  }

  function beginSwipe(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'touch' || !event.isPrimary) return
    // Leave selection, editing, and tapping inside form controls to the browser.
    if (event.target instanceof Element && event.target.closest('input, select, textarea, button, a, label')) return
    start.current = { id: event.pointerId, x: event.clientX, y: event.clientY }
  }

  function finishSwipe(event: PointerEvent<HTMLDivElement>) {
    const origin = start.current
    start.current = null
    if (!origin || origin.id !== event.pointerId) return
    const dx = event.clientX - origin.x
    const dy = event.clientY - origin.y
    const direction = document.documentElement.dir === 'rtl' ? -1 : 1
    const forward = mode === 'signin' ? -direction : direction
    if (dx * forward >= 60 && Math.abs(dx) > Math.abs(dy) * 1.5) switchView()
  }

  return (
    <div className="auth-switch" ref={panel} onPointerDown={beginSwipe} onPointerUp={finishSwipe}
      onPointerCancel={() => { start.current = null }}>
      <div key={mode} ref={view} className="auth-view" data-mode={mode}>
        <AccountForm mode={mode} onSwitch={switchView} />
      </div>
    </div>
  )
}
