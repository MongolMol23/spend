import { useId, useMemo, useRef, useState, type CSSProperties, type PointerEvent } from 'react'
import { ChevronDown, Image, Link2, Share2, Ticket } from 'lucide-react'
import qrcode from 'qrcode-generator'
import { useTranslation } from 'react-i18next'
import { Toast } from '../../ui/Toast'
import { friendInvitePath } from '../connections/friendInvite'
import { makeInviteImage } from './inviteImage'
import './invite-machine.css'

const pullDistance = 112
const cutDistance = pullDistance / 2
const inks = [
  { label: 'inviteLilac', color: '#d9c6ff' },
  { label: 'inviteMango', color: '#ffe488' },
  { label: 'inviteMint', color: '#c9ebd2' },
] as const

export function InviteMachine({ username, initial }: { username: string; initial?: string }) {
  const { t } = useTranslation()
  const titleId = useId()
  const ticketId = useId()
  const machine = useRef<HTMLElement>(null)
  const pull = useRef<{ id: number; start: number; moved: boolean } | null>(null)
  const suppressClick = useRef(false)
  const turn = useRef<{ id: number; x: number; direction: number } | null>(null)
  const suppressTurnClick = useRef(false)
  const [open, setOpen] = useState(false)
  const [sharing, setSharing] = useState<'link' | 'image'>()
  const [inkIndex, setInkIndex] = useState(0)
  const ink = inks[((inkIndex % inks.length) + inks.length) % inks.length]
  const [feedback, setFeedback] = useState<'inviteCopied' | 'inviteShareFailed' | 'inviteImageSaved'>()
  const url = new URL(friendInvitePath(username), window.location.origin).href
  const { code, qr } = useMemo(() => {
    const code = qrcode(0, 'M')
    code.addData(url)
    code.make()
    return { code, qr: code.createDataURL(5, 20) }
  }, [url])

  function beginPull(event: PointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || event.button !== 0) return
    suppressClick.current = false
    if (open) return
    pull.current = { id: event.pointerId, start: event.clientY, moved: false }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function movePull(event: PointerEvent<HTMLButtonElement>) {
    const active = pull.current
    if (active?.id !== event.pointerId) return
    const distance = event.clientY - active.start
    if (Math.abs(distance) >= 6) active.moved = true
    if (!active.moved) return
    const amount = Math.min(1, Math.max(0, distance / pullDistance))
    const element = machine.current
    element?.setAttribute('data-pulling', '')
    element?.toggleAttribute('data-cut-ready', distance >= cutDistance)
    element?.style.setProperty('--invite-reveal', amount + 'fr')
    element?.style.setProperty('--invite-lift', (amount - 1) * 100 + '%')
    element?.style.setProperty('--invite-roll', amount * 1.5 + 'turn')
  }

  function finishPull(event: PointerEvent<HTMLButtonElement>, cancelled = false) {
    const active = pull.current
    if (active?.id !== event.pointerId) return
    pull.current = null
    suppressClick.current = active.moved
    if (!active.moved) return
    const element = machine.current
    if (element) getComputedStyle(element).getPropertyValue('--invite-reveal')
    if (!cancelled && event.clientY - active.start >= cutDistance) setOpen(true)
    element?.removeAttribute('data-pulling')
    element?.removeAttribute('data-cut-ready')
    element?.style.removeProperty('--invite-reveal')
    element?.style.removeProperty('--invite-lift')
    element?.style.removeProperty('--invite-roll')
  }

  function beginTurn(event: PointerEvent<HTMLButtonElement>) {
    if (!event.isPrimary || event.button !== 0) return
    suppressTurnClick.current = false
    turn.current = {
      id: event.pointerId,
      x: event.clientX,
      direction: event.currentTarget.matches(':dir(rtl)') ? -1 : 1,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  function moveTurn(event: PointerEvent<HTMLButtonElement>) {
    const active = turn.current
    if (active?.id !== event.pointerId) return
    const distance = event.clientX - active.x
    if (Math.abs(distance) >= 6) suppressTurnClick.current = true
    if (suppressTurnClick.current) {
      event.currentTarget.style.setProperty('--invite-ink-drag', Math.max(-105, Math.min(105, distance * 2)) + 'deg')
    }
  }

  function finishTurn(event: PointerEvent<HTMLButtonElement>, cancelled = false) {
    const active = turn.current
    if (active?.id !== event.pointerId) return
    turn.current = null
    event.currentTarget.style.removeProperty('--invite-ink-drag')
    const distance = event.clientX - active.x
    if (!cancelled && Math.abs(distance) >= 26) {
      setInkIndex(index => index + Math.sign(distance) * active.direction)
    }
  }

  async function share() {
    setFeedback(undefined)
    setSharing('link')
    try {
      if (typeof navigator.share === 'function') {
        try {
          await navigator.share({ title: 'Spend · @' + username, url })
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
      setSharing(undefined)
    }
  }

  async function shareImage() {
    setFeedback(undefined)
    setSharing('image')
    try {
      const file = await makeInviteImage(username, initial ?? '', ink.color, code)
      if (typeof navigator.share === 'function' && navigator.canShare?.({ files: [file] })) {
        try {
          await navigator.share({ files: [file], title: 'Spend · @' + username })
          return
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') return
        }
      }
      const address = URL.createObjectURL(file)
      const download = document.createElement('a')
      download.href = address
      download.download = file.name
      download.hidden = true
      document.body.append(download)
      download.click()
      download.remove()
      window.setTimeout(() => URL.revokeObjectURL(address), 30_000)
      setFeedback('inviteImageSaved')
    } catch {
      setFeedback('inviteShareFailed')
    } finally {
      setSharing(undefined)
    }
  }

  return <section ref={machine} className="panel invite-machine" data-open={open} aria-labelledby={titleId}
    style={{ '--invite-ink': ink.color, '--invite-ink-turn': inkIndex * 120 + 'deg' } as CSSProperties}>
    <div className="invite-heading">
      <span className="icon-tile" aria-hidden="true"><Ticket size={20} /></span>
      <div><h2 id={titleId}>{t('inviteTitle')}</h2><p>{t('inviteHint')}</p></div>
    </div>
    <button type="button" className="invite-ink-picker" disabled={!!sharing}
      aria-label={t('inviteChangeInk', { color: t(ink.label) })}
      onPointerDown={beginTurn} onPointerMove={moveTurn} onPointerUp={finishTurn}
      onPointerCancel={event => finishTurn(event, true)} onLostPointerCapture={event => finishTurn(event, true)}
      onClick={event => {
        if (event.detail === 0 || !suppressTurnClick.current) setInkIndex(index => index + 1)
      }}>
      <span className="invite-ink-dial" aria-hidden="true" />
      <span>{t('inviteInk')} <strong aria-live="polite">{t(ink.label)}</strong></span>
    </button>
    <button type="button" className="invite-dispenser" aria-controls={ticketId} aria-expanded={open}
      onPointerDown={beginPull} onPointerMove={movePull} onPointerUp={finishPull}
      onPointerCancel={event => finishPull(event, true)} onLostPointerCapture={event => finishPull(event, true)}
      onClick={event => {
        if (event.detail > 0 && suppressClick.current) return
        setOpen(visible => !visible)
      }}>
      <span className="invite-slot" aria-hidden="true" />
      <span className="invite-roller" aria-hidden="true" />
      <span className="invite-pull-tab">
        {t(open ? 'inviteHide' : 'invitePrint')}<ChevronDown size={16} aria-hidden="true" />
      </span>
      <span className="invite-roller" aria-hidden="true" />
    </button>
    <div id={ticketId} className="invite-paper" inert={!open}>
      <div className="invite-paper-clip">
        <div className="invite-feed">
          <div className="invite-ticket">
            <div className="invite-ticket-top">
              <div className="invite-ticket-person">
                <span className="invite-stamp" aria-hidden="true">{initial || <Ticket size={18} />}</span>
                <strong><bdi>Spend</bdi></strong>
                <bdi dir="ltr">@{username}</bdi>
              </div>
              <img src={qr} className="invite-qr" alt={t('inviteQr', { username })} width={112} height={112} />
            </div>
            <div className="invite-ticket-bottom">
              <button type="button" className="secondary" disabled={!!sharing} aria-busy={sharing === 'link'} onClick={() => void share()}>
                {typeof navigator.share === 'function' ? <Share2 size={16} aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}
                {t(typeof navigator.share === 'function' ? 'inviteShare' : 'inviteCopy')}
              </button>
              <button type="button" className="secondary invite-image" disabled={!!sharing} aria-busy={sharing === 'image'}
                onClick={() => void shareImage()}>
                <Image size={16} aria-hidden="true" />{t('inviteImage')}
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
    {feedback && <Toast kind={feedback === 'inviteShareFailed' ? 'error' : 'success'} message={t(feedback)} />}
  </section>
}
