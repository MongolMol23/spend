import { useState, useSyncExternalStore } from 'react'
import { Download, Share, Wallet, X } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { Toast } from '../../ui/Toast'
import './install-offer.css'

type InstallPrompt = Event & {
  prompt(): Promise<{ outcome: 'accepted' | 'dismissed' }>
}

const dismissalKey = 'spend-install-offer-dismissed'
const device = navigator as Navigator & { standalone?: boolean }
const standalone = window.matchMedia('(display-mode: standalone)').matches || device.standalone === true
const ios = /iPhone|iPad|iPod/.test(device.userAgent) || (device.platform === 'MacIntel' && device.maxTouchPoints > 1)
const listeners = new Set<() => void>()
let offer: InstallPrompt | 'ios' | null = !standalone && ios ? 'ios' : null
let hidden = standalone

try { hidden ||= sessionStorage.getItem(dismissalKey) === 'true' } catch { /* Storage may be blocked. */ }

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => { listeners.delete(listener) }
}

function snapshot() { return hidden ? null : offer }
function updateOffer(next: typeof offer) {
  offer = next
  listeners.forEach(listener => listener())
}

window.addEventListener('beforeinstallprompt', event => {
  event.preventDefault()
  if (!hidden) updateOffer(event as InstallPrompt)
})
window.addEventListener('appinstalled', () => {
  hidden = true
  updateOffer(null)
})

export function InstallOffer() {
  const { t } = useTranslation()
  const available = useSyncExternalStore(subscribe, snapshot)
  const [showInstructions, setShowInstructions] = useState(false)
  const [failed, setFailed] = useState(false)

  async function install(prompt: InstallPrompt) {
    setFailed(false)
    updateOffer(null)
    try {
      await prompt.prompt()
    } catch {
      setFailed(true)
    }
  }

  function dismiss() {
    hidden = true
    try { sessionStorage.setItem(dismissalKey, 'true') } catch { /* Keep it hidden in memory. */ }
    updateOffer(null)
  }

  return <>
    {available && <section className="install-offer" aria-label={t('installSpend')}>
      <span className="brand-mark install-offer-icon" aria-hidden="true"><Wallet size={21} /></span>
      <div className="install-offer-copy">
        <strong>{t('installSpend')}</strong>
        <span>{t('installSpendHint')}</span>
      </div>
      <button type="button" className="primary install-offer-action"
        aria-expanded={available === 'ios' ? showInstructions : undefined}
        onClick={() => available === 'ios' ? setShowInstructions(value => !value) : void install(available)}>
        {available === 'ios' ? <Share size={17} aria-hidden="true" /> : <Download size={17} aria-hidden="true" />}
        {t(available === 'ios' ? 'installSpendHow' : 'installSpendAction')}
      </button>
      <button type="button" className="install-offer-dismiss" aria-label={t('installSpendDismiss')} onClick={dismiss}>
        <X size={17} aria-hidden="true" />
      </button>
      {available === 'ios' && showInstructions && <p className="install-offer-instructions">{t('installSpendIos')}</p>}
    </section>}
    {failed && <Toast message={t('installSpendFailed')} />}
  </>
}
