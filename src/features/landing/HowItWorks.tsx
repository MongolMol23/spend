import { CircleCheck, Clock3, HandCoins, History, ReceiptText, Sparkles, UserRound, UserRoundPlus } from 'lucide-react'
import { useCallback, useEffect, useRef, useState } from 'react'
import { useTranslation } from 'react-i18next'
import { Amount } from '../../ui/Amount'

const steps = [
  ['landingFriend', 'landingFriendDetail', UserRoundPlus],
  ['landingRequest', 'landingRequestDetail', HandCoins],
  ['landingTrack', 'landingTrackDetail', History],
] as const

const requested = 250
const confirmed = 100
const previewPayment = 50

export function HowItWorks() {
  const { t } = useTranslation()
  const [payment, setPayment] = useState<'idle' | 'pending' | 'confirmed'>('idle')
  const [view, setView] = useState<'mine' | 'friend'>('mine')
  const [switchedView, setSwitchedView] = useState(false)
  const [artRun, setArtRun] = useState(0)
  const paid = confirmed + (payment === 'confirmed' ? previewPayment : 0)
  const balance = useRef<HTMLDivElement>(null)
  const history = useRef<HTMLOListElement>(null)
  const artwork = useRef<HTMLDivElement>(null)
  const ticket = useRef<HTMLSpanElement>(null)

  const playArtwork = useCallback(() => {
    if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return
    if (ticket.current?.getAnimations().some(animation => animation.playState === 'running')) return
    setArtRun(run => run + 1)
  }, [])

  useEffect(() => {
    if (typeof IntersectionObserver === 'undefined') return

    // Start each effect independently when its content is visible.
    const observer = new IntersectionObserver(entries => {
      for (const { target, isIntersecting, intersectionRatio } of entries) {
        if (!(target instanceof HTMLElement) || !isIntersecting || intersectionRatio < .5) continue
        if (target === artwork.current) playArtwork()
        else target.dataset.paymentMotion = 'playing'
        observer.unobserve(target)
      }
    }, { threshold: .5 })
    for (const element of [balance.current, history.current]) {
      if (!element) continue
      element.dataset.paymentMotion = 'waiting'
      observer.observe(element)
    }
    if (artwork.current) observer.observe(artwork.current)
    return () => observer.disconnect()
  }, [playArtwork])

  function switchView(option: typeof view) {
    if (view === option) return
    setSwitchedView(true)
    setView(option)
  }

  function advanceExample() {
    if (payment === 'idle' && view === 'mine') {
      switchView('friend')
      return
    }
    if (payment === 'pending' && view === 'friend') {
      switchView('mine')
      return
    }
    setPayment(payment === 'idle' ? 'pending' : payment === 'pending' ? 'confirmed' : 'idle')
  }

  return <section className="landing-workflow" aria-labelledby="landing-workflow-title">
    <div className="landing-steps">
      <h2 id="landing-workflow-title">{t('landingHow')}</h2>
      <ol>
        {steps.map(([title, detail, Icon]) => <li key={title}>
          <span className="icon-tile" aria-hidden="true"><Icon size={19} /></span>
          <div><h3>{t(title)}</h3><p>{t(detail)}</p></div>
        </li>)}
      </ol>
      <div className="landing-request-art" ref={artwork} aria-hidden="true" data-animate={artRun > 0}
        onPointerEnter={event => {
          if (event.pointerType !== 'touch' && event.buttons === 0) playArtwork()
        }}>
        <Sparkles key={artRun} className="landing-request-art-sparkle" size={24} aria-hidden="true" />
        <div className="landing-request-art-track" aria-hidden="true">
          <span className="landing-request-art-person"><UserRound size={25} />
            {payment === 'pending' && <span className="landing-request-art-pending"><Clock3 size={17} /></span>}
            {payment === 'confirmed' && <span className="landing-request-art-confirmed"><CircleCheck size={19} /></span>}
          </span>
          <span className="landing-request-art-person"><UserRound size={25} />
            {payment === 'confirmed' && <span className="landing-request-art-confirmed"><CircleCheck size={19} /></span>}
          </span>
          <span key={artRun} ref={ticket} className="landing-request-art-ticket"><ReceiptText size={25} /></span>
        </div>
      </div>
    </div>
    <article className="panel landing-request-preview" aria-labelledby="landing-example-title">
      <header className="landing-preview-header">
        <div className="row landing-preview-meta">
          <span>{t('landingExample')}</span>
          <span className="status">{t('partial')}</span>
        </div>
        <h3 id="landing-example-title" className="section-heading">
          <span className="icon-tile" aria-hidden="true"><HandCoins size={19} /></span>{t('landingDinner')}
        </h3>
      </header>
      <div className="landing-preview-body">
        <div className="landing-perspective" role="group" aria-label={t('landingPerspective')} data-view={view}>
          {(['mine', 'friend'] as const).map(option => <button type="button" key={option}
            aria-pressed={view === option} onClick={() => switchView(option)}>
            {t(option === 'mine' ? 'landingMyView' : 'landingFriendView')}
          </button>)}
        </div>
        <p className="landing-perspective-caption" aria-live="polite">
          <span key={view} data-switched={switchedView || undefined}>{t(view === 'mine' ? 'landingTheyOwe' : 'landingYouOwe')}</span>
        </p>
        <div className="landing-request-balance" ref={balance}>
          <dl className="landing-request-totals">
            <div className="landing-request-remaining">
              <dt>{t('remaining')}</dt><dd aria-live="polite"><Amount value={requested - paid} /></dd>
            </div>
            <div><dt>{t('total')}</dt><dd><Amount value={requested} /></dd></div>
            <div><dt>{t('paid')}</dt><dd><Amount value={paid} /></dd></div>
          </dl>
          <div className="landing-payment-progress" role="progressbar" aria-label={t('landingPaymentProgress')}
            aria-valuemin={0} aria-valuemax={requested} aria-valuenow={paid}>
            <span aria-hidden="true" style={{ inlineSize: (paid / requested) * 100 + '%' }} />
          </div>
        </div>
        <h4>{t('landingPaymentHistory')}</h4>
        <ol className="ledger landing-payment-history" ref={history} aria-live="polite">
          <li><HandCoins size={18} aria-hidden="true" /><span>{t('landingRequestSent')}</span><Amount value={requested} /></li>
          <li><CircleCheck className="landing-payment-check" size={18} aria-hidden="true" /><span>{t('landingPaymentConfirmed')}</span><Amount value={confirmed} /></li>
          {payment !== 'idle' && <li className="landing-preview-payment">
            {payment === 'pending' ? <Clock3 size={18} aria-hidden="true" /> : <CircleCheck size={18} aria-hidden="true" />}
            <span>{t(payment === 'pending' ? 'paymentPending' : 'landingPaymentConfirmed')}</span><Amount value={previewPayment} />
          </li>}
        </ol>
        <button className="secondary landing-preview-action" type="button" onClick={advanceExample}>
          {payment === 'idle' && view === 'friend' ? <>{t('landingPreviewPayment')} <Amount value={previewPayment} /></>
            : t(payment === 'confirmed' ? 'landingResetPreview'
              : payment === 'idle' ? 'landingSwitchToPayer'
              : view === 'mine' ? 'confirmPayment' : 'landingSwitchToRecipient')}
        </button>
      </div>
    </article>
  </section>
}
