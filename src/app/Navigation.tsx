import { type MouseEvent } from 'react'
import { CalendarCheck, CalendarDays, ChartColumn, CircleUserRound, Ellipsis, LayoutDashboard, ReceiptText, Scale, UsersRound, Vault } from 'lucide-react'
import { useTranslation } from 'react-i18next'
import { NavLink, useLocation } from 'react-router'
import { ActiveLinkIndicator } from '../ui/ActiveLinkIndicator'

export function Navigation({ label, onNavigate, onMore }: {
  label?: string
  onNavigate?: () => void
  onMore?: (event: MouseEvent<HTMLButtonElement>) => void
}) {
  const { t } = useTranslation()
  const { pathname } = useLocation()

  return (
    <nav className="site-nav" aria-label={label ?? t('navigation')}>
      {onMore && <ActiveLinkIndicator selection={pathname} />}
      <NavLink to="/overview" onClick={onNavigate}>
        <LayoutDashboard size={18} aria-hidden="true" />{t('dashboard')}
      </NavLink>
      <NavLink to="/purchases" onClick={onNavigate}><ReceiptText size={18} aria-hidden="true" />{t('purchases')}</NavLink>
      <NavLink to="/debts" onClick={onNavigate}><Scale size={18} aria-hidden="true" /><span className="nav-full-label">{t('privateDebts')}</span><span className="nav-short-label">{t('navDebts')}</span></NavLink>
      <NavLink to="/savings" onClick={onNavigate}><Vault size={18} aria-hidden="true" /><span className="nav-full-label">{t('savingsGoals')}</span><span className="nav-short-label">{t('navSavings')}</span></NavLink>
      <NavLink className="nav-secondary" to="/installments" onClick={onNavigate}><CalendarDays size={18} aria-hidden="true" />{t('installments')}</NavLink>
      <NavLink className="nav-secondary" to="/monthly-expenses" onClick={onNavigate}><CalendarCheck size={18} aria-hidden="true" />{t('monthlyExpenses')}</NavLink>
      <NavLink className="nav-secondary" to="/analytics" onClick={onNavigate}><ChartColumn size={18} aria-hidden="true" />{t('analytics')}</NavLink>
      <NavLink className="nav-secondary" to="/account" onClick={onNavigate}><CircleUserRound size={18} aria-hidden="true" />{t('account')}</NavLink>
      <NavLink className="nav-secondary" to="/connections" onClick={onNavigate}><UsersRound size={18} aria-hidden="true" />{t('connections')}</NavLink>
      {onMore && <button type="button" className="nav-more" aria-haspopup="dialog" aria-controls="sidebar" onClick={onMore}>
        <Ellipsis size={18} aria-hidden="true" />{t('navMore')}
      </button>}
    </nav>
  )
}
