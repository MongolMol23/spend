import { useTranslation } from 'react-i18next'

export function DebtPages({ page, hasNext, move }: { page: number; hasNext: boolean; move: (page: number) => void }) {
  const { t, i18n } = useTranslation()
  if (!page && !hasNext) return null
  return <div className="debt-actions">
    <button type="button" className="secondary" disabled={!page} onClick={() => move(page - 1)}>{t('previousPage')}</button>
    <span>{t('pageNumber', { page: new Intl.NumberFormat(i18n.language).format(page + 1) })}</span>
    <button type="button" className="secondary" disabled={!hasNext} onClick={() => move(page + 1)}>{t('nextPage')}</button>
  </div>
}
