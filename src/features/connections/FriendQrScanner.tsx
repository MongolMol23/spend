import { useEffect, useEffectEvent, useId, useRef, useState } from 'react'
import { Camera, ScanLine } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LedgerEditor } from '../../ui/LedgerEditor'
import { scannedInviteUsername } from './friendInvite'

const messages = {
  starting: 'friendQrStarting',
  live: 'friendQrAim',
  invalid: 'friendQrInvalid',
  denied: 'friendQrDenied',
  unavailable: 'friendQrUnavailable',
} as const

export function FriendQrScanner({ onScan, onClose }: { onScan: (username: string) => void; onClose: () => void }) {
  const { t } = useTranslation()
  const titleId = useId()
  const video = useRef<HTMLVideoElement>(null)
  const [status, setStatus] = useState<keyof typeof messages>('starting')
  const [attempt, setAttempt] = useState(0)
  const reportScan = useEffectEvent(onScan)

  useEffect(() => {
    const preview = video.current
    if (!preview) return
    let active = true
    let stream: MediaStream | undefined
    let timer: number | undefined

    async function start(preview: HTMLVideoElement) {
      try {
        if (!navigator.mediaDevices?.getUserMedia) throw new Error('Camera unavailable')
        const { default: decode } = await import('jsqr')
        if (!active) return
        stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        if (!active) {
          stream.getTracks().forEach(track => track.stop())
          return
        }
        preview.srcObject = stream
        await preview.play()
        if (!active) return

        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (!context) throw new Error('Canvas unavailable')
        setStatus('live')

        function scan() {
          if (preview.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA && preview.videoWidth && preview.videoHeight && context) {
            const size = Math.min(preview.videoWidth, preview.videoHeight)
            const sample = Math.min(size, 480)
            if (canvas.width !== sample || canvas.height !== sample) canvas.width = canvas.height = sample
            context.drawImage(preview, (preview.videoWidth - size) / 2, (preview.videoHeight - size) / 2,
              size, size, 0, 0, sample, sample)
            const { data } = context.getImageData(0, 0, sample, sample)
            const result = decode(data, sample, sample, { inversionAttempts: 'dontInvert' })
            if (result) {
              const username = scannedInviteUsername(result.data, window.location.origin)
              if (username) {
                reportScan(username)
                return
              }
              setStatus('invalid')
            }
          }
          timer = window.setTimeout(scan, 135)
        }
        scan()
      } catch (error) {
        stream?.getTracks().forEach(track => track.stop())
        if (active) setStatus(error instanceof DOMException && error.name === 'NotAllowedError' ? 'denied' : 'unavailable')
      }
    }
    void start(preview)

    return () => {
      active = false
      window.clearTimeout(timer)
      stream?.getTracks().forEach(track => track.stop())
      preview.srcObject = null
    }
  }, [attempt])

  const failed = status === 'denied' || status === 'unavailable'
  return <LedgerEditor titleId={titleId} busy={false} onClose={onClose}>
    <section className="panel friend-qr-scanner">
      <h2 id={titleId} tabIndex={-1} ref={heading => { heading?.setAttribute('autofocus', '') }}>
        <ScanLine size={23} aria-hidden="true" />{t('friendQrTitle')}
      </h2>
      <div className="friend-qr-preview" data-status={status} aria-hidden="true">
        <video ref={video} autoPlay playsInline muted />
        <div className="friend-qr-reticle"><span /></div>
        {(failed || status === 'starting') && <span className="friend-qr-placeholder"><Camera size={26} /></span>}
      </div>
      <p className="friend-qr-status" role="status">{t(messages[status])}</p>
      {failed && <button type="button" className="secondary" onClick={() => { setStatus('starting'); setAttempt(attempt + 1) }}>
        {t('retry')}
      </button>}
    </section>
  </LedgerEditor>
}
