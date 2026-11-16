import { Toast } from '../../ui/Toast'
import { useEffect, useRef, useState, type FormEvent } from 'react'
import { Link, useNavigate } from 'react-router'
import { useTranslation } from 'react-i18next'
import { ArrowRight } from 'lucide-react'
import { PasswordInput } from './PasswordInput'
import type { Label } from '../../i18n/locales'
import { supabase } from '../../data/supabase'
import { checkUsernameAvailability, useUsernameAvailability } from './useUsernameAvailability'
import { accountFieldError, signupFields, signupProfileSchema, type AccountField } from './validation'

type Mode = 'signin' | 'signup' | 'forgot' | 'reset' | 'confirm'

export function AccountForm({ mode, onSwitch }: { mode: Mode; onSwitch?: () => void }) {
  const { t, i18n } = useTranslation()
  const navigate = useNavigate()
  const [notice, setNotice] = useState<Label>()
  const [error, setError] = useState<Label>()
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<AccountField, Label>>>({})
  const touched = useRef(new Set<AccountField>())
  const [busy, setBusy] = useState(false)
  const [verified, setVerified] = useState(false)
  const [usernameInput, setUsernameInput] = useState('')
  const [rejectedUsername, setRejectedUsername] = useState<string>()
  const username = signupProfileSchema.shape.username.safeParse(usernameInput).data
  const available = useUsernameAvailability(mode === 'signup' && !notice ? username : undefined)
  const usernameTaken = Boolean(username && (username === rejectedUsername || available === false))
  const [tokenHash] = useState(() => new URLSearchParams(location.search).get('token_hash'))
  const callback = mode === 'reset' || mode === 'confirm'
  const needsPassword = mode !== 'forgot' && mode !== 'confirm'

  function validateFields(values: FormData) {
    const errors: Partial<Record<AccountField, Label>> = {}
    for (const field of touched.current) {
      const message = accountFieldError(field, values, mode === 'signin')
      if (message) errors[field] = message
    }
    setFieldErrors(errors)
    return errors
  }

  function fieldProps(field: AccountField, hint?: string) {
    const message = fieldErrors[field] ?? (field === 'username' && usernameTaken ? 'usernameTaken' : undefined)
    return {
      name: field,
      'aria-labelledby': `account-${field}-label`,
      'aria-invalid': message ? true : undefined,
      'aria-describedby': [hint, message && `account-${field}-error`,
        field === 'username' && available === true && !message && 'signup-username-available'].filter(Boolean).join(' ') || undefined,
    }
  }

  function fieldMessage(field: AccountField) {
    const message = fieldErrors[field] ?? (field === 'username' && usernameTaken ? 'usernameTaken' : undefined)
    return <span className="account-field-error" aria-live="polite">
      {message && <span id={`account-${field}-error`}>{t(message)}</span>}
    </span>
  }

  useEffect(() => {
    if (callback && tokenHash) history.replaceState(history.state, '', location.pathname)
  }, [callback, tokenHash])

  async function verifyLink() {
    if (!supabase || !tokenHash || busy) return
    setBusy(true)
    setError(undefined)
    try {
      // Require a user action so an email scanner opening the page cannot consume the link.
      const { error: failure } = await supabase.auth.verifyOtp({
        token_hash: tokenHash,
        type: mode === 'reset' ? 'recovery' : 'email',
      })
      if (failure) setError('invalidLink')
      else setVerified(true)
    } catch {
      setError('accountError')
    } finally {
      setBusy(false)
    }
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!supabase || busy) return
    const values = new FormData(event.currentTarget)
    const email = String(values.get('email') ?? '').trim()
    const password = String(values.get('password') ?? '')
    setError(undefined)
    setNotice(undefined)
    const fields = mode === 'signup' ? signupFields : mode === 'reset' ? ['password'] as const
      : mode === 'forgot' ? ['email'] as const : ['email', 'password'] as const
    fields.forEach(field => touched.current.add(field))
    const errors = validateFields(values)
    const firstInvalid = fields.find(field => errors[field])
    if (firstInvalid) {
      const input = event.currentTarget.elements.namedItem(firstInvalid)
      if (input instanceof HTMLElement) input.focus()
      return
    }
    if (mode === 'reset' && !verified) return setError('invalidLink')
    const usernameField = event.currentTarget.elements.namedItem('username')
    if (mode === 'signup' && usernameTaken && username === signupProfileSchema.shape.username.safeParse(values.get('username')).data) {
      if (usernameField instanceof HTMLElement) usernameField.focus()
      return
    }
    setBusy(true)
    try {
      if (mode === 'signup') {
        const profile = signupProfileSchema.safeParse({ ...Object.fromEntries(values), language: i18n.language })
        if (!profile.success) return setError('invalidSignupProfile')
        const { error: failure } = await supabase.auth.signUp({
          email, password, options: { data: { spend_profile: profile.data } },
        })
        if (failure?.code === 'unexpected_failure') {
          // The name can be claimed between the live check and the signup transaction.
          if (await checkUsernameAvailability(profile.data.username) === false) {
            setRejectedUsername(profile.data.username)
            if (usernameField instanceof HTMLElement) usernameField.focus()
            return
          }
          return setError('signupProfileUnavailable')
        }
        if (failure) throw failure
        setNotice('signupPendingReview')
      } else if (mode === 'forgot') {
        const { error: failure } = await supabase.rpc('spend_request_recovery', { requested_email: email })
        if (failure) throw failure
        setNotice('manualRecoveryRequested')
      } else if (mode === 'reset') {
        const { error: failure } = await supabase.auth.updateUser({ password })
        if (failure) throw failure
        const { error: signOutError } = await supabase.auth.signOut()
        if (signOutError) throw signOutError
        setVerified(false)
        setNotice('passwordChanged')
      } else {
        const { error: failure } = await supabase.auth.signInWithPassword({ email, password })
        if (failure?.code === 'email_not_confirmed' || failure?.message === 'spend_account_pending_review') {
          return setError('signupPendingReview')
        }
        if (failure) throw failure
        const { data: isAdmin } = await supabase.rpc('spend_is_admin')
        void navigate(isAdmin ? '/admin' : '/overview', { replace: true })
      }
    } catch {
      setError('accountError')
    } finally {
      setBusy(false)
    }
  }

  const canSubmit = !callback || (mode === 'reset' && verified)
  return <section className="panel">
    <h1 tabIndex={-1}>{t(mode)}</h1>
    {mode === 'signin' && <p className="account-intro">{t('signinIntro')}</p>}
    {canSubmit && <form className="account-form" onSubmit={submit} noValidate
      onBlur={event => {
        if (!(event.target instanceof HTMLInputElement)) return
        touched.current.add(event.target.name as AccountField)
        validateFields(new FormData(event.currentTarget))
      }}
      onChange={event => validateFields(new FormData(event.currentTarget))}>
      {mode === 'signup' && <>
        <div className="signup-names">
          <label><span id="account-name_ar-label">{t('nameArabic')}</span><input {...fieldProps('name_ar')} maxLength={80} dir="rtl" required />{fieldMessage('name_ar')}</label>
          <label><span id="account-name_en-label">{t('nameEnglish')}</span><input {...fieldProps('name_en')} maxLength={80} dir="ltr" required />{fieldMessage('name_en')}</label>
        </div>
        <label><span id="account-username-label">{t('username')}</span><input {...fieldProps('username', 'signup-username-hint')}
          autoComplete="username" maxLength={24} dir="ltr" required onChange={event => {
            setUsernameInput(event.target.value)
            setRejectedUsername(undefined)
          }} />{fieldMessage('username')}
          <span className="account-field-feedback" aria-live="polite">
            {available === true && !usernameTaken && <span id="signup-username-available">{t('usernameAvailable')}</span>}
          </span>
        </label>
        <small id="signup-username-hint">{t('usernameHint')}</small>
      </>}
      {!callback && <label><span id="account-email-label">{t('email')}</span><input {...fieldProps('email')} type="email" autoComplete="email"
        required dir="ltr" />{fieldMessage('email')}</label>}
      {needsPassword && <div className="account-field">
        <div className="row">
          <label id="account-password-label" htmlFor="account-password">{t('password')}</label>
          {mode === 'signin' && <Link to="/account/forgot">{t('forgot')}</Link>}
        </div>
        <PasswordInput key={mode} id="account-password" {...fieldProps('password')}
          autoComplete={mode === 'signin' ? 'current-password' : 'new-password'} required />
        {fieldMessage('password')}
      </div>}
      {mode === 'signup' && <div className="account-field">
        <label id="account-confirm_password-label" htmlFor="account-confirm_password">{t('confirmPassword')}</label>
        <PasswordInput id="account-confirm_password" {...fieldProps('confirm_password')} autoComplete="new-password" required />
        {fieldMessage('confirm_password')}
      </div>}
      <button className="primary" disabled={busy}>{t(mode)}</button>
    </form>}
    {error && <Toast message={t(error)} />}
    {notice && <Toast kind="success" message={t(notice)} />}
    {mode === 'confirm' && verified && <Toast kind="success" message={t('emailConfirmed')} />}
    {callback && !verified && !notice && (tokenHash
      ? <button className="primary" disabled={busy} onClick={() => void verifyLink()}>{t('verifyLink')}</button>
      : <Toast message={t('invalidLink')} />)}
    <nav className="account-links" aria-label={t('account')}>
      {mode === 'confirm' && verified && <Link className="primary" to="/overview">{t('dashboard')}</Link>}
      {(mode === 'signin' || mode === 'signup') && <p className="account-switch">
        <span>{t(mode === 'signin' ? 'newToSpend' : 'alreadyHaveAccount')}</span>
        <Link className="secondary" to={mode === 'signin' ? '/account/signup' : '/account'} onClick={event => {
          if (!onSwitch || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return
          event.preventDefault()
          onSwitch()
        }}>
          {t(mode === 'signin' ? 'signup' : 'signin')} <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </p>}
      {mode !== 'signin' && mode !== 'signup' && <Link className="secondary" to="/account">{t('signin')}</Link>}
    </nav>
  </section>
}

