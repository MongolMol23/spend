import { useLayoutEffect, useRef, type MouseEvent } from 'react'
import { CalendarDays, ChartColumn, CircleUserRound, Ellipsis, LayoutDashboard, ReceiptText, Scale, UsersRound, Vault } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink, useLocation } from 'react-router'

export function Navigation({ label, onNavigate, onMore }: {
  label?: string
  onNavigate?: () => void
  onMore?: (event: MouseEvent<HTMLButtonElement>) => void
}) {
  const { t, i18n } = useTranslation()
  const { pathname } = useLocation()
  const nav = useRef<HTMLElement>(null)
  const indicator = useRef<HTMLSpanElement>(null)

  useLayoutEffect(() => {
    const container = nav.current
    const highlight = indicator.current
    if (!container || !highlight) return

    const active = container.querySelector<HTMLElement>('a[aria-current]')
    function position() {
      if (!container || !highlight) return
      if (!active?.getClientRects().length) {
        highlight.hidden = true
        return
      }

      const bounds = container.getBoundingClientRect()
      const tab = active.getBoundingClientRect()
      highlight.style.transform = `translate(${tab.left - bounds.left - container.clientLeft}px, ${tab.top - bounds.top - container.clientTop}px)`
      highlight.style.width = `${tab.width}px`
      highlight.style.height = `${tab.height}px`
      highlight.hidden = false
    }

    position()
    if (typeof ResizeObserver === 'undefined') return
    // Tab widths can change when the header wraps or translated labels resize.
    const observer = new ResizeObserver(position)
    observer.observe(container)
    for (const link of container.querySelectorAll('a')) observer.observe(link)
    return () => observer.disconnect()
  }, [pathname, i18n.language])

  return (
    <nav ref={nav} className="site-nav" aria-label={label ?? t('navigation')}>
      {onMore && <span ref={indicator} className="nav-indicator" aria-hidden="true" hidden />}
      <NavLink to="/overview" onClick={onNavigate}>
        <LayoutDashboard size={18} aria-hidden="true" />{t('dashboard')}
      </NavLink>
      <NavLink to="/purchases" onClick={onNavigate}><ReceiptText size={18} aria-hidden="true" />{t('purchases')}</NavLink>
      <NavLink to="/debts" onClick={onNavigate}><Scale size={18} aria-hidden="true" /><span className="nav-full-label">{t('privateDebts')}</span><span className="nav-short-label">{t('navDebts')}</span></NavLink>
      <NavLink to="/savings" onClick={onNavigate}><Vault size={18} aria-hidden="true" /><span className="nav-full-label">{t('savingsGoals')}</span><span className="nav-short-label">{t('navSavings')}</span></NavLink>
      <NavLink className="nav-secondary" to="/installments" onClick={onNavigate}><CalendarDays size={18} aria-hidden="true" />{t('installments')}</NavLink>
      <NavLink className="nav-secondary" to="/analytics" onClick={onNavigate}><ChartColumn size={18} aria-hidden="true" />{t('analytics')}</NavLink>
      <NavLink className="nav-secondary" to="/account" onClick={onNavigate}><CircleUserRound size={18} aria-hidden="true" />{t('account')}</NavLink>
      <NavLink className="nav-secondary" to="/connections" onClick={onNavigate}><UsersRound size={18} aria-hidden="true" />{t('connections')}</NavLink>
      {onMore && <button type="button" className="nav-more" aria-haspopup="dialog" aria-controls="sidebar" onClick={onMore}>
        <Ellipsis size={18} aria-hidden="true" />{t('navMore')}
      </button>}
    </nav>
  )
}
