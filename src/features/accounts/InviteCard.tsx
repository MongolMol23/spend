import { useId, useMemo, useRef, useState, type PointerEvent } from 'react'
import { ChevronRight, Link2, QrCode, Share2, Sparkles } from 'lucide-react'
import qrcode from 'qrcode-generator'
import { useTranslation } from 'react-i18next'
import { LedgerEditor } from '../../ui/LedgerEditor'
import { Brand } from '../../ui/Brand'
import { Toast } from '../../ui/Toast'
import { friendInvitePath } from '../connections/friendInvite'
import './invite-card.css'

const inviteOpenThreshold = .72

type InviteDrag = {
  pointerId: number
  x: number
  y: number
  direction: number
  travel: number
  axis?: 'horizontal' | 'vertical'
}

export function InviteCard({ username }: { username: string }) {
  const { t } = useTranslation()
  const titleId = useId()
  const hintId = useId()
  const rail = useRef<HTMLSpanElement>(null)
  const thumb = useRef<HTMLSpanElement>(null)
  const drag = useRef<InviteDrag | null>(null)
  const suppressClick = useRef(false)
  const [open, setOpen] = useState(false)
  const [sharing, setSharing] = useState(false)
  const [feedback, setFeedback] = useState<'inviteCopied' | 'inviteShareFailed'>()
  const url = new URL(friendInvitePath(username), window.location.origin).href
  const qr = useMemo(() => {
    const code = qrcode(0, 'M')
    code.addData(url)
    code.make()
    return code.createDataURL(5, 20)
  }, [url])
  const canShare = typeof navigator.share === 'function'

  function openCard() {
    setFeedback(undefined)
    setOpen(true)
  }

  function startDrag(event: PointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || event.button !== 0 || !rail.current || !thumb.current) return
    const button = event.currentTarget
    suppressClick.current = false
    drag.current = {
      pointerId: event.pointerId,
      x: event.clientX,
      y: event.clientY,
      direction: getComputedStyle(button).direction === 'rtl' ? -1 : 1,
      travel: Math.max(1, rail.current.clientWidth - thumb.current.offsetWidth),
    }
    button.setPointerCapture(event.pointerId)
  }

  function moveDrag(event: PointerEvent<HTMLButtonElement>) {
    const active = drag.current
    if (active?.pointerId !== event.pointerId) return
    const dx = event.clientX - active.x
    const dy = event.clientY - active.y
    if (!active.axis) {
      if (Math.max(Math.abs(dx), Math.abs(dy)) < 8) return
      active.axis = Math.abs(dx) > Math.abs(dy) ? 'horizontal' : 'vertical'
      suppressClick.current = true
    }
    if (active.axis !== 'horizontal') return
    const distance = Math.max(0, Math.min(active.travel, dx * active.direction))
    const progress = Math.min(1, distance / (active.travel * inviteOpenThreshold))
    const button = event.currentTarget
    button.setAttribute('data-dragging', '')
    button.toggleAttribute('data-invite-ready', progress === 1)
    button.style.setProperty('--invite-hint-progress', String(progress))
    button.style.setProperty('--invite-offset', distance * active.direction + 'px')
    button.style.setProperty('--invite-fill', distance + 'px')
  }

  function finishDrag(event: PointerEvent<HTMLButtonElement>) {
    const active = drag.current
    if (active?.pointerId !== event.pointerId) return
    const released = event.type === 'pointerup'
    if (released) moveDrag(event)
    drag.current = null
    const button = event.currentTarget
    button.removeAttribute('data-dragging')
    button.removeAttribute('data-invite-ready')
    button.style.removeProperty('--invite-hint-progress')
    button.style.removeProperty('--invite-offset')
    button.style.removeProperty('--invite-fill')
    if (!released) suppressClick.current = true
    if (released && active.axis === 'horizontal' &&
      (event.clientX - active.x) * active.direction >= active.travel * inviteOpenThreshold) openCard()
  }

  async function shareLink() {
    setFeedback(undefined)
    setSharing(true)
    try {
      if (canShare) {
        try {
          await navigator.share({ url, title: 'Spend · @' + username })
          return
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') return
        }
      }
      await navigator.clipboard.writeText(url)
      setFeedback('inviteCopied')
    } catch {
      setFeedback('inviteShareFailed')
    } finally {
      setSharing(false)
    }
  }

  return <>
    <button type="button" className="secondary profile-invite" aria-haspopup="dialog" aria-describedby={hintId}
      aria-label={t('inviteTitle')} onPointerDown={startDrag} onPointerMove={moveDrag} onPointerUp={finishDrag}
      onPointerCancel={finishDrag} onLostPointerCapture={finishDrag}
      onClick={event => { if (event.detail === 0 || !suppressClick.current) openCard() }}>
      <span className="profile-invite-rail" ref={rail} aria-hidden="true">
        <span className="profile-invite-thumb" ref={thumb}><ChevronRight size={21} /></span>
      </span>
      <span className="profile-invite-label">
        <strong>{t('inviteTitle')}</strong>
        <small className="profile-invite-hint">
          <span id={hintId}>{t('inviteSwipeHint')}</span>
          <span className="profile-invite-release" aria-hidden="true">{t('inviteReleaseHint')}</span>
        </small>
      </span>
      <span className="profile-invite-paper" aria-hidden="true"><QrCode size={16} /></span>
    </button>
    {open && <LedgerEditor titleId={titleId} busy={sharing} onClose={() => setOpen(false)}>
      <section className="panel invite-card">
        <h2 id={titleId}>{t('inviteTitle')}</h2>
        <div className="invite-pass">
          <div className="invite-paper-book" aria-hidden="true">
            <span className="invite-paper-leaf invite-paper-leaf-left" />
            <span className="invite-paper-leaf invite-paper-leaf-right" />
          </div>
          <Sparkles className="invite-paper-sparkle" size={21} aria-hidden="true" />
          <div className="invite-paper-wallet" dir="ltr">
            <span className="brand"><Brand /></span>
          </div>
          <div className="invite-paper-ticket">
            <div className="invite-card-code">
              <img src={qr} alt={t('inviteQr', { username })} width={164} height={164} />
            </div>
            <strong className="invite-pass-handle"><bdi dir="ltr">@{username}</bdi></strong>
          </div>
        </div>
        <p className="invite-scan-hint">{t('inviteScanHint')}</p>
        <button type="button" className="primary invite-share-action" disabled={sharing} aria-busy={sharing}
          onClick={() => void shareLink()}>
          {canShare ? <Share2 size={16} aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}
          {t(canShare ? 'inviteShare' : 'inviteCopy')}
        </button>
        {feedback && <Toast kind={feedback === 'inviteShareFailed' ? 'error' : 'success'} message={t(feedback)} />}
      </section>
    </LedgerEditor>}
  </>
}
