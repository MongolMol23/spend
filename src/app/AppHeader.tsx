import { Modal } from '../ui/Modal'
import { useEffect, useLayoutEffect, useRef, useState, type MouseEvent } from 'react'
import { useTranslation } from 'react-i18next'
import { LogOut, X } from 'lucide-react'
import { Link, useNavigate } from 'react-router'
import { HeaderPreferences } from '../ui/HeaderPreferences'
import { Brand } from '../ui/Brand'
import { Navigation } from './Navigation'
import { ResponseBadge } from './ResponseBadge'
import { supabase } from '../data/supabase'
import { Toast } from '../ui/Toast'

export function AppHeader({ admin = false, authPage = false }: { admin?: boolean; authPage?: boolean }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const sidebar = useRef<HTMLDialogElement>(null)
  const header = useRef<HTMLDivElement>(null)
  const [userId, setUserId] = useState<string>()
  const [signingOut, setSigningOut] = useState<'header' | 'sidebar'>()
  const [signOutFailed, setSignOutFailed] = useState<'header' | 'sidebar'>()
  const showMemberNavigation = !admin && !authPage

  useLayoutEffect(() => {
    const top = header.current
    const nav = top?.querySelector<HTMLElement>(':scope > .site-nav')
    const brand = top?.querySelector<HTMLElement>(':scope > .overview-brand')
    const preferences = top?.querySelector<HTMLElement>(':scope > .header-preferences')
    if (!top || !nav || !brand || !preferences) return

    function fitNavigation() {
      if (!top || !nav || !brand || !preferences) return
      if (window.innerWidth < 1200) {
        delete top.dataset.inlineNav
        delete top.dataset.expandedNav
        return
      }
      // Measure intrinsic link widths before deciding whether all three areas fit.
      top.setAttribute('data-expanded-nav', '')
      const savedStyle = nav.getAttribute('style')
      nav.style.inlineSize = 'max-content'
      nav.style.maxInlineSize = 'none'
      const navWidth = nav.getBoundingClientRect().width
      if (savedStyle === null) nav.removeAttribute('style')
      else nav.setAttribute('style', savedStyle)
      const gap = parseFloat(getComputedStyle(top).columnGap) || 0
      const required = brand.getBoundingClientRect().width + navWidth + preferences.getBoundingClientRect().width + gap * 2
      top.toggleAttribute('data-inline-nav', required <= top.clientWidth)
      top.toggleAttribute('data-expanded-nav', navWidth <= top.clientWidth)
    }

    fitNavigation()
    const observer = new ResizeObserver(fitNavigation)
    observer.observe(top)
    observer.observe(brand)
    observer.observe(preferences)
    let mounted = true
    void document.fonts.ready.then(() => { if (mounted) fitNavigation() })
    return () => { mounted = false; observer.disconnect() }
  }, [i18n.language, userId, showMemberNavigation])

  useEffect(() => {
    const subscription = supabase?.auth.onAuthStateChange((_event, session) => setUserId(session?.user.id))
    return () => subscription?.data.subscription.unsubscribe()
  }, [])

  async function signOut(source: 'header' | 'sidebar') {
    if (!supabase || signingOut) return
    setSigningOut(source)
    setSignOutFailed(undefined)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      sidebar.current?.close()
      if (admin) void navigate('/account', { replace: true })
    } catch {
      setSignOutFailed(source)
    } finally {
      setSigningOut(undefined)
    }
  }
  function openNavigation(event: MouseEvent<HTMLButtonElement>) {
    const dialog = sidebar.current
    if (!dialog) return
    dialog.dataset.pointer = String(event.detail > 0)
    dialog.showModal()
  }
  return <>
    <a className="skip" href="#main" onClick={event => {
      event.preventDefault()
      document.getElementById('main')?.focus()
    }}>{t('skip')}</a>
    <header className="site-header"><div ref={header} className="top shell" data-admin={admin || undefined} data-auth-page={authPage || undefined}>
      <div className="overview-brand">
        <Link className="brand" to={admin ? '/admin' : '/'}><Brand /></Link>
      </div>
      <HeaderPreferences notification={showMemberNavigation && <ResponseBadge userId={userId} />}>
        {userId && !authPage && <button type="button" className="secondary header-signout" disabled={!!signingOut} aria-busy={signingOut === 'header'}
          aria-label={t('signout')} title={t('signout')} onClick={() => void signOut('header')}>
          <LogOut size={18} aria-hidden="true" />
        </button>}
      </HeaderPreferences>
      {showMemberNavigation && <Navigation onMore={openNavigation} />}
    </div></header>
    {userId && signOutFailed === 'header' && <Toast message={t('accountError')} />}
    {showMemberNavigation && <Modal id="sidebar" className="sidebar" ref={sidebar} aria-labelledby="sidebar-title">
      <div className="sidebar-content">
        <div className="row">
          <h2 id="sidebar-title" className="brand"><Brand /></h2>
          <button type="button" className="sidebar-close" aria-label={t('closeMenu')} onClick={() => sidebar.current?.close()}>
            <X size={20} aria-hidden="true" />
          </button>
        </div>
        <Navigation label={t('sidebarNavigation')} onNavigate={() => sidebar.current?.close()} />
        {userId && <footer className="sidebar-actions">
          <button type="button" className="secondary" disabled={!!signingOut} aria-busy={signingOut === 'sidebar'} onClick={() => void signOut('sidebar')}>
            <LogOut size={17} aria-hidden="true" />{t('signout')}
          </button>
          {signOutFailed === 'sidebar' && <Toast message={t('accountError')} />}
        </footer>}
      </div>
    </Modal>}
  </>
}
