import { ChevronDown, LockKeyhole, UsersRound } from 'lucide-react'
import { useTranslation } from 'react-i18next'

const privacy = [
  ['landingPrivacyPersonal', 'landingPrivacyPersonalDetail', LockKeyhole],
  ['landingPrivacyShared', 'landingPrivacySharedDetail', UsersRound],
] as const

const questions = [
  ['landingFaqOffline', 'landingFaqOfflineAnswer'],
  ['landingFaqTransfers', 'landingFaqTransfersAnswer'],
  ['landingFaqPartial', 'landingFaqPartialAnswer'],
] as const

export function PrivacyAndFaq() {
  const { t } = useTranslation()

  return <div className="landing-information">
    <section className="panel landing-privacy" aria-labelledby="landing-privacy-title">
      <h2 id="landing-privacy-title">{t('landingPrivacy')}</h2>
      <ul>
        {privacy.map(([title, detail, Icon]) => <li key={title}>
          <span className="icon-tile" aria-hidden="true"><Icon size={18} /></span>
          <div><h3>{t(title)}</h3><p>{t(detail)}</p></div>
        </li>)}
      </ul>
    </section>
    <section className="landing-faq" aria-labelledby="landing-faq-title">
      <h2 id="landing-faq-title">{t('landingFaq')}</h2>
      {questions.map(([question, answer], index) => <details className="panel" key={question} name="landing-faq" open={index === 0}>
        <summary>{t(question)}<ChevronDown size={18} aria-hidden="true" /></summary>
        <p>{t(answer)}</p>
      </details>)}
    </section>
  </div>
}
