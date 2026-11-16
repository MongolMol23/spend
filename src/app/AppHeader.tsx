import { Modal } from '../ui/Modal'
import { useEffect, useRef, useState, type MouseEvent } from 'react'
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
  const { t } = useTranslation()
  const navigate = useNavigate()
  const sidebar = useRef<HTMLDialogElement>(null)
  const [userId, setUserId] = useState<string>()
  const [signingOut, setSigningOut] = useState(false)
  const [signOutFailed, setSignOutFailed] = useState<'header' | 'sidebar'>()
  const showMemberNavigation = !admin && !authPage

  useEffect(() => {
    const subscription = supabase?.auth.onAuthStateChange((_event, session) => setUserId(session?.user.id))
    return () => subscription?.data.subscription.unsubscribe()
  }, [])

  async function signOut(source: 'header' | 'sidebar') {
    if (!supabase || signingOut) return
    setSigningOut(true)
    setSignOutFailed(undefined)
    try {
      const { error } = await supabase.auth.signOut()
      if (error) throw error
      sidebar.current?.close()
      if (admin) void navigate('/account', { replace: true })
    } catch {
      setSignOutFailed(source)
    } finally {
      setSigningOut(false)
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
    <header className="site-header"><div className="top shell" data-admin={admin || undefined} data-auth-page={authPage || undefined}>
      <div className="overview-brand">
        <Link className="brand" to={admin ? '/admin' : '/'}><Brand /></Link>
        {showMemberNavigation && <ResponseBadge userId={userId} />}
      </div>
      <HeaderPreferences>
        {userId && !authPage && <button type="button" className="secondary header-signout" disabled={signingOut}
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
          <button type="button" className="secondary" disabled={signingOut} onClick={() => void signOut('sidebar')}>
            <LogOut size={17} aria-hidden="true" />{t('signout')}
          </button>
          {signOutFailed === 'sidebar' && <Toast message={t('accountError')} />}
        </footer>}
      </div>
    </Modal>}
  </>
}
