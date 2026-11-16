import { Eye, EyeOff } from 'lucide-react'
import { useState, type ComponentProps } from 'react'
import { useTranslation } from 'react-i18next'

export function PasswordInput(props: Omit<ComponentProps<'input'>, 'type'>) {
  const { t } = useTranslation()
  const [visible, setVisible] = useState(false)
  const Icon = visible ? EyeOff : Eye

  return <div className="password-input" data-visible={visible}>
    <input {...props} type={visible ? 'text' : 'password'} spellCheck={false} autoCapitalize="none" />
    <button type="button" aria-label={t(visible ? 'hidePassword' : 'showPassword')}
      onClick={() => setVisible(value => !value)}>
      <span className="password-eye"><Icon size={17} aria-hidden="true" /></span>
    </button>
  </div>
}
