import { Toast } from '../../ui/Toast'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { useTranslation } from 'react-i18next'
import type { Label } from '../../i18n/locales'
import { Select } from '../../ui/Select'
import { DateField } from '../../ui/DateField'
import type { Person } from '../connections/api'
import { debtInput, sharedDebtInput, type DebtChange, type PrivateDebt, type SharedDebtInput } from './api'

export function DebtForm({ debt, direction, busy, error, save, cancel, friends, sendShared, loadingFriends }: {
  debt?: PrivateDebt
  direction: PrivateDebt['direction']
  busy: boolean
  error?: Label
  save: (change: DebtChange) => Promise<boolean>
  cancel: () => void
  friends?: Person[]
  sendShared?: (input: SharedDebtInput) => void
  loadingFriends?: boolean
}) {
  const { t } = useTranslation()
  const [invalid, setInvalid] = useState<Label>()
  const contact = useRef<HTMLInputElement>(null)
  const [name, setName] = useState(debt?.contact ?? '')
  const [friend, setFriend] = useState<Person>()
  const [naming, setNaming] = useState(false)
  const search = name.trim().toLocaleLowerCase().replace(/^@/, '')
  const suggestions = naming && !friend ? friends?.filter(person =>
    person.display_name.toLocaleLowerCase().includes(search) || person.username.toLocaleLowerCase().includes(search),
  ).slice(0, 5) : undefined
  const message = invalid ?? error
  useEffect(() => { if (debt) contact.current?.focus() }, [debt])
  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const fields = Object.fromEntries(new FormData(form))
    if (friend && sendShared) {
      const shared = sharedDebtInput.safeParse({ ...fields, friend: friend.id })
      if (!shared.success) {
        setInvalid('invalidRequest')
        const field = form.elements.namedItem(String(shared.error.issues[0]?.path[0]))
        if (field instanceof HTMLElement) field.focus()
        return
      }
      setInvalid(undefined)
      sendShared(shared.data)
      return
    }
    const result = debtInput.safeParse(fields)
    if (!result.success) {
      setInvalid('debtInvalid')
      const field = form.elements.namedItem(String(result.error.issues[0]?.path[0]))
      if (field instanceof HTMLElement) field.focus()
      return
    }
    if (debt && result.data.amount < debt.paid_minor) {
      setInvalid('debtBelowPaid')
      form.querySelector<HTMLInputElement>('[name="amount"]')?.focus()
      return
    }
    setInvalid(undefined)
    if (await save({ kind: 'save', debt, input: result.data }) && !debt) form.reset()
  }
  return <section className="panel debt-entry">
    <h2 id="debt-entry-title">{t(debt ? 'editDebt' : 'addDebt')}</h2>
    <form onSubmit={submit} noValidate onChange={() => setInvalid(undefined)}>
      <fieldset className="debt-form" aria-labelledby="debt-entry-title" disabled={busy}>
        <div className="debt-contact-field" onFocus={() => setNaming(true)}
          onBlur={event => { if (!event.currentTarget.contains(event.relatedTarget)) setNaming(false) }}>
          <label>{t('debtContact')}<input ref={contact} name="contact" value={name} dir="auto" required maxLength={120}
            onChange={event => { setName(event.target.value); setFriend(undefined) }} /></label>
          {!debt && <small className="muted">{t(friend ? 'sharedDebtNeedsApproval' : 'debtContactOptions')}</small>}
          {naming && loadingFriends && <small role="status">{t('loading')}</small>}
          {!!suggestions?.length && <ul className="debt-friend-options" aria-label={t('friends')}>
            {suggestions.map(person => <li key={person.id}><button type="button" onClick={() => {
              setName(person.display_name)
              setFriend(person)
              contact.current?.focus()
            }}>
              <bdi>{person.display_name}</bdi><small><bdi dir="ltr">@{person.username}</bdi></small>
            </button></li>)}
          </ul>}
        </div>
        {debt && debt.paid_minor > 0 ? <p>{t('debtDirection')} · {t(debt.direction)}
          <input type="hidden" name="direction" value={debt.direction} />
        </p> : <label>{t('debtDirection')}
          <Select name="direction" defaultValue={debt?.direction ?? direction}>
            <option value="owed">{t('owed')}</option><option value="owe">{t('owe')}</option>
          </Select>
        </label>}
        <label>{t('debtAmount')}<input name="amount" defaultValue={debt ? (debt.amount_minor / 100).toFixed(2) : ''}
          inputMode="decimal" dir="ltr" required /></label>
        {friend && <label>{t('reason')}<textarea name="reason" dir="auto" maxLength={500} required /></label>}
        <DateField label={t('debtDue')} name="dueOn" defaultValue={debt?.due_on ?? ''} optional />
        {message && <Toast message={t(message)} />}
        <div className="debt-actions">
          <button type="submit" className="primary" aria-busy={busy}>{t(friend ? 'sendRequest' : 'debtSave')}</button>
          {debt && <button type="button" className="secondary" onClick={cancel}>{t('cancelPurchase')}</button>}
        </div>
      </fieldset>
    </form>
  </section>
}
