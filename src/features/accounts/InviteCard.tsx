import { useId, useMemo, useState, type PointerEvent } from 'react'
import { ChevronRight, Image, Link2, QrCode, Share2, Sparkles } from 'lucide-react'
import qrcode from 'qrcode-generator'
import { useTranslation } from 'react-i18next'
import { LedgerEditor } from '../../ui/LedgerEditor'
import { Brand } from '../../ui/Brand'
import { Toast } from '../../ui/Toast'
import { friendInvitePath } from '../connections/friendInvite'
import { makeInviteImage } from './inviteImage'
import './invite-card.css'

function moveFoil(event: PointerEvent<HTMLDivElement>) {
  if (!event.isPrimary || window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
  const card = event.currentTarget
  const bounds = card.getBoundingClientRect()
  const horizontal = Math.max(0, Math.min(1, (event.clientX - bounds.left) / bounds.width))
  const vertical = Math.max(0, Math.min(1, (event.clientY - bounds.top) / bounds.height))
  card.style.setProperty('--foil-x', horizontal * 100 + '%')
  card.style.setProperty('--foil-y', vertical * 100 + '%')
}

function resetFoil(event: PointerEvent<HTMLDivElement>) {
  event.currentTarget.style.removeProperty('--foil-x')
  event.currentTarget.style.removeProperty('--foil-y')
}

export function InviteCard({ username, initial }: { username: string; initial?: string }) {
  const { t } = useTranslation()
  const titleId = useId()
  const [open, setOpen] = useState(false)
  const [sharing, setSharing] = useState<'link' | 'image'>()
  const [feedback, setFeedback] = useState<'inviteCopied' | 'inviteShareFailed' | 'inviteImageSaved'>()
  const url = new URL(friendInvitePath(username), window.location.origin).href
  const { code, qr } = useMemo(() => {
    const code = qrcode(0, 'M')
    code.addData(url)
    code.make()
    return { code, qr: code.createDataURL(5, 20) }
  }, [url])
  const canShare = typeof navigator.share === 'function'

  async function share(kind: 'link' | 'image') {
    setFeedback(undefined)
    setSharing(kind)
    try {
      const file = kind === 'image' ? await makeInviteImage(username, initial ?? '', code) : undefined
      const data = file ? { files: [file] } : { url }
      if (canShare && (!file || navigator.canShare?.({ files: [file] }))) {
        try {
          await navigator.share({ ...data, title: 'Spend · @' + username })
          return
        } catch (error) {
          if (error instanceof DOMException && error.name === 'AbortError') return
        }
      }
      if (file) {
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
      } else {
        await navigator.clipboard.writeText(url)
        setFeedback('inviteCopied')
      }
    } catch {
      setFeedback('inviteShareFailed')
    } finally {
      setSharing(undefined)
    }
  }

  return <>
    <button type="button" className="secondary profile-invite" aria-haspopup="dialog"
      onClick={() => { setFeedback(undefined); setOpen(true) }}>
      <span className="icon-tile" aria-hidden="true"><QrCode size={20} /></span>
      <strong>{t('inviteTitle')}</strong>
      <ChevronRight className="profile-invite-arrow" size={17} aria-hidden="true" />
    </button>
    {open && <LedgerEditor titleId={titleId} busy={!!sharing} onClose={() => setOpen(false)}>
      <section className="panel invite-card">
        <h2 id={titleId}>{t('inviteTitle')}</h2>
        <div className="invite-pass" onPointerDown={moveFoil} onPointerMove={moveFoil} onPointerLeave={resetFoil}
          onPointerCancel={resetFoil} onPointerUp={event => { if (event.pointerType !== 'mouse') resetFoil(event) }}>
          <div className="invite-pass-art" aria-hidden="true" />
          <div className="invite-pass-heading">
            <span className="brand"><Brand /></span>
            <span className="invite-pass-seal" aria-hidden="true">
              {initial || <Sparkles size={22} />}
            </span>
          </div>
          <div className="invite-card-code">
            <img src={qr} alt={t('inviteQr', { username })} width={164} height={164} />
          </div>
          <strong className="invite-pass-handle"><bdi dir="ltr">@{username}</bdi></strong>
        </div>
        <p className="invite-scan-hint">{t('inviteScanHint')}</p>
        <div className="invite-card-actions">
          <button type="button" className="primary" disabled={!!sharing} aria-busy={sharing === 'link'}
            onClick={() => void share('link')}>
            {canShare ? <Share2 size={16} aria-hidden="true" /> : <Link2 size={16} aria-hidden="true" />}
            {t(canShare ? 'inviteShare' : 'inviteCopy')}
          </button>
          <button type="button" className="secondary invite-image" disabled={!!sharing} aria-busy={sharing === 'image'}
            onClick={() => void share('image')}>
            <Image size={16} aria-hidden="true" />{t('inviteImage')}
          </button>
        </div>
        {feedback && <Toast kind={feedback === 'inviteShareFailed' ? 'error' : 'success'} message={t(feedback)} />}
      </section>
    </LedgerEditor>}
  </>
}
