import { useTranslation } from 'react-i18next'
import './overview-loading.css'

export function OverviewLoading() {
  const { t } = useTranslation()
  return <div className="overview-loading" role="status">
    <span className="overview-loading-label">{t('loading')}</span>
    <div className="overview-loading-preview" aria-hidden="true">
      <div className="panel overview-loading-budget">
        <span className="overview-loading-line" />
        <span className="overview-loading-number" />
        <div className="overview-loading-totals"><span /><span /></div>
      </div>
      <div className="panel overview-loading-spending">
        <span className="overview-loading-line" />
        <span className="overview-loading-number" />
      </div>
    </div>
  </div>
}
