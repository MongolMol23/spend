import { Toast } from '../../ui/Toast'
import { useEffect, useId, useRef, useState, type FormEvent, type KeyboardEvent } from 'react'
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
  const optionsId = useId()
  const [name, setName] = useState(debt?.contact ?? '')
  const [friend, setFriend] = useState<Person>()
  const [naming, setNaming] = useState(false)
  const [highlighted, setHighlighted] = useState(-1)
  const search = name.trim().toLocaleLowerCase().replace(/^@/, '')
  const suggestions = !friend ? (friends ?? []).filter(person =>
    person.display_name.toLocaleLowerCase().includes(search) || person.username.toLocaleLowerCase().includes(search),
  ).slice(0, 5) : []
  const expanded = naming && suggestions.length > 0
  const message = invalid ?? error
  useEffect(() => { if (debt) contact.current?.focus() }, [debt])

  function closeSuggestions() {
    setNaming(false)
    setHighlighted(-1)
  }

  function chooseFriend(person: Person) {
    setName(person.display_name)
    setFriend(person)
    closeSuggestions()
    contact.current?.focus()
  }

  function handleContactKey(event: KeyboardEvent<HTMLInputElement>) {
    if (event.nativeEvent.isComposing) return
    if (expanded && event.key === 'Escape') {
      event.preventDefault()
      closeSuggestions()
    } else if (expanded && event.key === 'Enter' && suggestions[highlighted]) {
      event.preventDefault()
      chooseFriend(suggestions[highlighted])
    } else if (suggestions.length && (event.key === 'ArrowDown' || event.key === 'ArrowUp')) {
      event.preventDefault()
      setNaming(true)
      const next = event.key === 'ArrowDown' ? Math.min(highlighted + 1, suggestions.length - 1)
        : highlighted < 0 ? suggestions.length - 1 : Math.max(highlighted - 1, 0)
      setHighlighted(next)
    }
  }

  useEffect(() => {
    if (expanded && highlighted >= 0) {
      document.getElementById(optionsId + '-' + highlighted)?.scrollIntoView({ block: 'nearest' })
    }
  }, [expanded, highlighted, optionsId])
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
        <div className="debt-contact-field">
          <label htmlFor={optionsId + '-contact'}>{t('debtContact')}</label>
          <div className="debt-name-input">
            <input ref={contact} id={optionsId + '-contact'} name="contact" value={name} dir="auto" required maxLength={120} autoComplete="off"
              role={debt ? undefined : 'combobox'} aria-expanded={debt ? undefined : expanded}
              aria-autocomplete={debt ? undefined : 'list'} aria-controls={expanded ? optionsId : undefined}
              aria-activedescendant={expanded && suggestions[highlighted] ? optionsId + '-' + highlighted : undefined}
              onClick={() => setNaming(true)} onBlur={closeSuggestions} onKeyDown={handleContactKey}
              onChange={event => {
                setName(event.target.value)
                setFriend(undefined)
                setNaming(true)
                setHighlighted(-1)
              }} />
            {expanded && <ul id={optionsId} className="debt-friend-options" role="listbox" aria-label={t('friends')}>
              {suggestions.map((person, index) => <li key={person.id} id={optionsId + '-' + index} role="option"
                aria-selected={index === highlighted} onMouseDown={event => event.preventDefault()}
                onClick={() => chooseFriend(person)}>
                <bdi>{person.display_name}</bdi><small><bdi dir="ltr">@{person.username}</bdi></small>
              </li>)}
            </ul>}
          </div>
          {!debt && <small className="muted">{t(friend ? 'sharedDebtNeedsApproval' : 'debtContactOptions')}</small>}
          {naming && loadingFriends && <small role="status">{t('loading')}</small>}
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
