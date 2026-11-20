import { useEffect, useEffectEvent, useId, useRef, useState, type ChangeEvent } from 'react'
import { Camera, Image as ImageIcon, ScanLine } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { LedgerEditor } from '../../ui/LedgerEditor'
import { scannedInviteUsername } from './friendInvite'

const messages = {
  starting: 'friendQrStarting',
  live: 'friendQrAim',
  invalid: 'friendQrInvalid',
  denied: 'friendQrDenied',
  missing: 'friendQrMissing',
  busy: 'friendQrBusy',
  unavailable: 'friendQrUnavailable',
} as const

function cameraFailure(error: unknown) {
  if (error instanceof DOMException) {
    if (error.name === 'NotAllowedError') return 'denied'
    if (error.name === 'NotFoundError' || error.name === 'OverconstrainedError') return 'missing'
    if (error.name === 'NotReadableError' || error.name === 'AbortError') return 'busy'
  }
  return 'unavailable'
}

async function readPhoto(file: File) {
  const url = URL.createObjectURL(file)
  try {
    const photo = new Image()
    photo.src = url
    await photo.decode()
    const scale = Math.min(1, 1280 / Math.max(photo.naturalWidth, photo.naturalHeight))
    const canvas = document.createElement('canvas')
    canvas.width = Math.max(1, Math.round(photo.naturalWidth * scale))
    canvas.height = Math.max(1, Math.round(photo.naturalHeight * scale))
    const context = canvas.getContext('2d')
    if (!context) throw new Error('Canvas unavailable')
    context.drawImage(photo, 0, 0, canvas.width, canvas.height)
    const { default: decode } = await import('jsqr')
    return decode(context.getImageData(0, 0, canvas.width, canvas.height).data, canvas.width, canvas.height,
      { inversionAttempts: 'attemptBoth' })?.data
  } finally {
    URL.revokeObjectURL(url)
  }
}

export function FriendQrScanner({ onScan, onClose }: { onScan: (username: string) => void; onClose: () => void }) {
  const { t } = useTranslation()
  const titleId = useId()
  const video = useRef<HTMLVideoElement>(null)
  const photoInput = useRef<HTMLInputElement>(null)
  const readingPhoto = useRef(false)
  const [status, setStatus] = useState<keyof typeof messages>('starting')
  const [photoMessage, setPhotoMessage] = useState<'friendQrReadingPhoto' | 'friendQrNoCodeInPhoto' | 'friendQrPhotoError' | 'friendQrInvalid'>()
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
        try {
          stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false })
        } catch (error) {
          if (!active || cameraFailure(error) !== 'missing') throw error
          stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: false })
        }
        if (!active) {
          stream.getTracks().forEach(track => track.stop())
          return
        }
        preview.srcObject = stream
        preview.muted = true
        await preview.play()
        const { default: decode } = await import('jsqr')
        if (!active) return

        const canvas = document.createElement('canvas')
        const context = canvas.getContext('2d', { willReadFrequently: true })
        if (!context) throw new Error('Canvas unavailable')
        setStatus('live')

        function scan() {
          if (!readingPhoto.current && preview.readyState >= HTMLMediaElement.HAVE_CURRENT_DATA &&
            preview.videoWidth && preview.videoHeight && context) {
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
        if (active) {
          preview.srcObject = null
          setStatus(cameraFailure(error))
        }
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

  async function scanPhoto(event: ChangeEvent<HTMLInputElement>) {
    const input = event.currentTarget
    const file = input.files?.[0]
    input.value = ''
    if (!file || readingPhoto.current) return
    readingPhoto.current = true
    setPhotoMessage('friendQrReadingPhoto')
    try {
      const code = await readPhoto(file)
      if (!input.isConnected) return
      const username = code && scannedInviteUsername(code, window.location.origin)
      if (username) onScan(username)
      else setPhotoMessage(code ? 'friendQrInvalid' : 'friendQrNoCodeInPhoto')
    } catch {
      if (input.isConnected) setPhotoMessage('friendQrPhotoError')
    } finally {
      readingPhoto.current = false
    }
  }

  const failed = status !== 'starting' && status !== 'live' && status !== 'invalid'
  return <LedgerEditor titleId={titleId} busy={false} onClose={onClose}>
    <section className="panel friend-qr-scanner">
      <h2 id={titleId} tabIndex={-1} ref={heading => { heading?.setAttribute('autofocus', '') }}>
        <ScanLine size={23} aria-hidden="true" />{t('friendQrTitle')}
      </h2>
      <div className="friend-qr-preview" data-status={status} data-failed={failed || undefined} aria-hidden="true">
        <video ref={video} autoPlay playsInline muted />
        <div className="friend-qr-reticle"><span /></div>
        {(failed || status === 'starting') && <span className="friend-qr-placeholder"><Camera size={26} /></span>}
      </div>
      <p className="friend-qr-status" role="status">{t(photoMessage ?? messages[status])}</p>
      <input ref={photoInput} type="file" accept="image/*" hidden onChange={event => void scanPhoto(event)} />
      <div className="friend-qr-actions">
        <button type="button" className={failed ? 'primary' : 'secondary'} disabled={photoMessage === 'friendQrReadingPhoto'}
          aria-busy={photoMessage === 'friendQrReadingPhoto'} onClick={() => photoInput.current?.click()}>
          <ImageIcon size={17} aria-hidden="true" />{t('friendQrChoosePhoto')}
        </button>
        {failed && <button type="button" className="secondary" disabled={photoMessage === 'friendQrReadingPhoto'}
          onClick={() => { setPhotoMessage(undefined); setStatus('starting'); setAttempt(attempt + 1) }}>
          {t('retry')}
        </button>}
      </div>
    </section>
  </LedgerEditor>
}
