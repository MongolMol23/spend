import { FeatureHeading } from '../../ui/FeatureHeading'
import { Toast } from '../../ui/Toast'
import { SignInLink } from '../accounts/SignInLink'
import { useState } from 'react'
import { useQuery } from '@tanstack/react-query'
import { useTranslation } from 'react-i18next'
import { Link, useSearchParams } from 'react-router'
import { ChartColumn, PieChart, ReceiptText } from 'lucide-react'
import { LedgerQueries, useLedgerOwner } from '../../data/LedgerSession'
import { ledgerToday } from '../../data/calendar'
import { supabase } from '../../data/supabase'
import { useFormats } from '../../i18n/useFormats'
import { Amount } from '../../ui/Amount'
import { Select } from '../../ui/Select'
import { ActiveLinkIndicator } from '../../ui/ActiveLinkIndicator'
import { DebtPages } from '../debts/DebtPages'
import { categoryLabel, expenseCategories, listPurchases, monthlyPurchases, purchasePageSize, purchasesKey, type PurchaseClient } from '../purchases/api'
import './analytics.css'

function AnalyticsLoading() {
  const { t } = useTranslation()

  return <section className="panel analytics-trend analytics-loading">
    <p className="loading-state" role="status">
      {t('analyticsLoading')}
    </p>
    <div className="analytics-bars analytics-skeleton" aria-hidden="true">
      {[48, 70, 58, 88, 67, 80].map(height => <span key={height} style={{ blockSize: height + '%' }} />)}
    </div>
  </section>
}

function recentMonths(current: string) {
  const date = new Date(current + '-01T00:00:00Z')
  date.setUTCMonth(date.getUTCMonth() - 5)
  return Array.from({ length: 6 }, () => {
    const month = date.toISOString().slice(0, 7)
    date.setUTCMonth(date.getUTCMonth() + 1)
    return month
  })
}

function AnalyticsWorkspace({ client }: { client: PurchaseClient }) {
  const { t, i18n } = useTranslation()
  const { money, date } = useFormats()
  const [params] = useSearchParams()
  const requestedView = params.get('section')
  const view = requestedView === 'categories' || requestedView === 'purchases' ? requestedView : 'trend'
  const [currentMonth] = useState(() => ledgerToday().slice(0, 7))
  const [month, setMonth] = useState(currentMonth)
  const [category, setCategory] = useState('')
  const [page, setPage] = useState(0)
  const locale = i18n.language === 'ar' ? 'ar-EG' : 'en-EG'
  const longMonth = new Intl.DateTimeFormat(locale, { month: 'long', year: 'numeric', timeZone: 'UTC' })
  const shortMonth = new Intl.DateTimeFormat(locale, { month: 'short', timeZone: 'UTC' })
  const compact = new Intl.NumberFormat(locale, { notation: 'compact', maximumFractionDigits: 1 })
  const percent = new Intl.NumberFormat(locale, { style: 'percent', maximumFractionDigits: 1 })
  const monthDate = (key: string) => new Date(key + '-01T00:00:00Z')
  const summary = useQuery({
    queryKey: [...purchasesKey, 'analytics', currentMonth],
    queryFn: ({ signal }) => Promise.all(recentMonths(currentMonth).map(async key => {
      const categories = await monthlyPurchases(client, key, signal)
      return { key, categories: [...categories].sort((a, b) => Number(b.total_minor) - Number(a.total_minor)),
        total: categories.reduce((sum, row) => sum + Number(row.total_minor), 0) }
    })),
  })
  const purchases = useQuery({
    queryKey: [...purchasesKey, 'list', month, category, page],
    queryFn: ({ signal }) => listPurchases(client, month, category, page, signal),
    enabled: summary.isSuccess,
  })
  const selected = summary.data?.find(row => row.key === month)
  const peak = Math.max(1, ...(summary.data ?? []).map(row => row.total))

  function selectMonth(key: string) {
    if (month === key) return
    setMonth(key)
    setCategory('')
    setPage(0)
  }

  const heading = <FeatureHeading title={t('analytics')} icon={ChartColumn} accent="lavender">
    {summary.data && <Select aria-label={t('purchaseMonth')} value={month} onChange={event => selectMonth(event.target.value)}>
      {[...summary.data].reverse().map(row => <option key={row.key} value={row.key}>{longMonth.format(monthDate(row.key))}</option>)}
    </Select>}
  </FeatureHeading>

  if (summary.isPending) return <>{heading}<AnalyticsLoading /></>
  if (!summary.data || !selected) return <>{heading}<section className="panel">
    <Toast message={t('failed')} />
    <button className="secondary" type="button" disabled={summary.isFetching} aria-busy={summary.isFetching} onClick={() => void summary.refetch()}>{t('retry')}</button>
  </section></>

  const previous = summary.data[summary.data.indexOf(selected) - 1]
  const change = previous ? selected.total - previous.total : undefined
  const chartCategories = expenseCategories.filter(category =>
    summary.data.some(row => row.categories.some(entry => categoryLabel(entry.category) === category)),
  )

  return <>{heading}<div className="analytics-workspace" data-view={view}>
    <nav className="analytics-sections" data-page-swipe-nav aria-label={t('analytics')}>
      <ActiveLinkIndicator selection={view} />
      {([
        ['trend', 'analyticsMonthsTab', ChartColumn],
        ['categories', 'analyticsCategoriesTab', PieChart],
        ['purchases', 'purchases', ReceiptText],
      ] as const).map(([key, label, Icon]) => <Link key={key} to={'?section=' + key} aria-current={view === key ? 'page' : undefined}>
        <Icon size={16} aria-hidden="true" /><span>{t(label)}</span>
      </Link>)}
    </nav>
    <section className="panel analytics-trend" data-page-swipe-panel aria-labelledby="analytics-trend-title">
      <h2 id="analytics-trend-title" className="section-heading">
        <span className="icon-tile" aria-hidden="true"><ChartColumn size={18} /></span>{t('analyticsTrend')}
      </h2>
      <div className="analytics-month">
        <div>
          <div>{t('analyticsMonthTotal')}</div>
          <strong className="analytics-total"><Amount value={selected.total / 100} /></strong>
          {change !== undefined && <div className="analytics-comparison" aria-live="polite">
            {t(change === 0 ? 'analyticsSameSpending' : change > 0 ? 'analyticsMoreSpending' : 'analyticsLessSpending', {
              amount: money.format(Math.abs(change) / 100),
            })}
          </div>}
        </div>
      </div>
      <div className="analytics-bars">
        {summary.data.map(row => <button key={row.key} type="button" data-swipe-control aria-pressed={row.key === month}
          aria-label={longMonth.format(monthDate(row.key)) + ' · ' + money.format(row.total / 100)}
          onClick={() => selectMonth(row.key)}>
          <span className="analytics-bar-value" aria-hidden="true">{compact.format(row.total / 100)}</span>
          <span className="analytics-bar-track" aria-hidden="true">
            {row.total > 0 && <span className="analytics-stack" style={{ blockSize: (row.total / peak) * 100 + '%' }}>
              {[...row.categories].sort((a, b) => a.category.localeCompare(b.category)).map(entry =>
                <span key={entry.category} data-category={categoryLabel(entry.category)} style={{ flexGrow: Number(entry.total_minor) }} />)}
            </span>}
          </span>
          <span>{shortMonth.format(monthDate(row.key))}</span>
          <span className="analytics-chart-tooltip" aria-hidden="true">
            <strong>{longMonth.format(monthDate(row.key))}</strong>
            <strong className="analytics-tooltip-total"><Amount value={row.total / 100} /></strong>
            {row.categories.map(entry => <span className="analytics-tooltip-row" key={entry.category} data-category={categoryLabel(entry.category)}>
              <span>{t(categoryLabel(entry.category))}</span>
              <Amount value={Number(entry.total_minor) / 100} />
            </span>)}
          </span>
        </button>)}
      </div>
      {chartCategories.length > 0 && <ul className="analytics-legend" aria-label={t('breakdown')}>
        {chartCategories.map(category => <li key={category} data-category={category}>{t(category)}</li>)}
      </ul>}
    </section>
    <div className="analytics-detail">
      <section className="panel analytics-categories" data-page-swipe-panel>
        <h2 className="section-heading"><span className="icon-tile" aria-hidden="true"><PieChart size={18} /></span>{t('breakdown')}</h2>
        {selected.categories.length ? <>
          <button type="button" className="secondary" aria-pressed={!category}
            onClick={() => { setCategory(''); setPage(0) }}>{t('allCategories')}</button>
          <ul className="ledger">
            {selected.categories.map(row => <li key={row.category}>
              <button type="button" data-swipe-control data-category={categoryLabel(row.category)} aria-pressed={row.category === category}
                onClick={() => { setCategory(row.category); setPage(0) }}>
                <span className="row"><span>{t(categoryLabel(row.category))}</span><Amount value={Number(row.total_minor) / 100} /></span>
                <span className="analytics-category-share">
                  <span className="analytics-category-track" aria-hidden="true">
                    <span style={{ inlineSize: (Number(row.total_minor) / selected.total) * 100 + '%' }} />
                  </span>
                  <bdi>{percent.format(Number(row.total_minor) / selected.total)}</bdi>
                </span>
              </button>
            </li>)}
          </ul>
          {category && <Link className="secondary analytics-category-results" to="?section=purchases">{t('analyticsCategoryResults')}</Link>}
        </> : <p className="empty-state">{t('noPurchases')}</p>}
      </section>
      <section className="panel analytics-purchases" data-page-swipe-panel aria-labelledby="analytics-purchases-title">
        <div className="analytics-purchases-heading">
          <h2 id="analytics-purchases-title" className="section-heading">
            <span className="icon-tile" aria-hidden="true"><ReceiptText size={18} /></span>
            <span>{t('purchases')}{category && ' · ' + t(categoryLabel(category))}</span>
          </h2>
          <Link className="secondary analytics-manage" to="/purchases">{t('analyticsManage')}</Link>
        </div>
        {purchases.isPending && <p className="loading-state" role="status">{t('loading')}</p>}
        {purchases.isError && <><Toast message={t('failed')} />
          <button className="secondary" type="button" disabled={purchases.isFetching} aria-busy={purchases.isFetching} onClick={() => void purchases.refetch()}>{t('retry')}</button></>}
        {purchases.data && (purchases.data.length ? <ul className="ledger">
          {purchases.data.slice(0, purchasePageSize).map(purchase => <li key={purchase.id} className="row">
            <div><strong className="reason"><bdi>{purchase.item}</bdi></strong>
              <time dateTime={purchase.spent_on}>{date.format(new Date(purchase.spent_on))}</time></div>
            <strong className="analytics-purchase-amount"><Amount value={purchase.amount_minor / 100} /></strong>
          </li>)}
        </ul> : <p className="empty-state">{t('noPurchases')}</p>)}
        <DebtPages page={page} hasNext={(purchases.data?.length ?? 0) > purchasePageSize} move={setPage} />
      </section>
    </div>
  </div></>
}

export function Analytics() {
  const { t } = useTranslation()
  const owner = useLedgerOwner()
  return <main id="main" tabIndex={-1} className="shell analytics-shell">
    {(!supabase || !owner) && <FeatureHeading title={t('analytics')} icon={ChartColumn} accent="lavender" />}
    {!supabase ? <Toast message={t('purchaseUnavailable')} />
      : owner === undefined ? <AnalyticsLoading />
      : owner === null ? <section className="panel"><p>{t('purchaseSignin')}</p>
        <SignInLink /></section>
      : <LedgerQueries key={owner}><AnalyticsWorkspace client={supabase} /></LedgerQueries>}
  </main>
}
