import { Toast } from '../../ui/Toast'
import { DateField } from '../../ui/DateField'
import { useEffect, useRef, useState, type FormEvent, type FocusEvent, type ReactNode } from 'react'
import { useTranslation } from 'react-i18next'
import type { Label } from '../../i18n/locales'
import { Select } from '../../ui/Select'
import { expenseCategories, purchaseInput, purchaseToday, type Expense, type PurchaseInput } from './api'

const errorsFor = {
  item: 'purchaseItemError',
  amount: 'purchaseAmountError',
  category: 'purchaseCategoryError',
  spentOn: 'purchaseDateError',
  note: 'purchaseNoteError',
} satisfies Record<keyof PurchaseInput, Label>
type Field = keyof typeof errorsFor

function validate(form: HTMLFormElement) {
  return purchaseInput.safeParse(Object.fromEntries(new FormData(form)))
}

export function PurchaseForm({ expense, busy, error, context, defaultCategory, defaultDate, onSave, onCancel }: {
  expense: Expense | null
  busy: boolean
  error: Label | undefined
  context?: ReactNode
  defaultCategory?: string
  defaultDate?: string
  onSave: (input: PurchaseInput) => Promise<boolean>
  onCancel: () => void
}) {
  const { t } = useTranslation()
  const [invalid, setInvalid] = useState<Partial<Record<Field, boolean>>>({})
  const editedFields = useRef(new Set<Field>())
  const item = useRef<HTMLInputElement>(null)
  useEffect(() => { if (expense) item.current?.focus() }, [expense])

  function fieldProps(name: Field) {
    return {
      name,
      'aria-invalid': invalid[name] || undefined,
      'aria-describedby': invalid[name] ? 'purchase-error-' + name : undefined,
    }
  }

  function fieldError(name: Field) {
    return invalid[name] && <span id={'purchase-error-' + name} className="account-field-error" aria-live="polite">
      {t(errorsFor[name])}
    </span>
  }

  function validateField(event: FocusEvent<HTMLFormElement> | FormEvent<HTMLFormElement>, onBlur: boolean) {
    const field = (event.target as HTMLInputElement).name as Field
    if (!Object.hasOwn(errorsFor, field)) return
    if (!onBlur) editedFields.current.add(field)
    if (onBlur && 'relatedTarget' in event && event.relatedTarget instanceof Element
      && event.relatedTarget.closest('[data-modal-dismiss]')) return
    if (!invalid[field] && (!onBlur || !editedFields.current.has(field))) return
    const result = validate(event.currentTarget)
    const hasError = !result.success && result.error.issues.some(issue => issue.path[0] === field)
    setInvalid(previous => ({ ...previous, [field]: hasError }))
  }

  async function submit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const form = event.currentTarget
    const result = validate(form)
    if (!result.success) {
      const fields = result.error.issues.map(issue => issue.path[0] as Field)
      setInvalid(Object.fromEntries(fields.map(field => [field, true])))
      const first = form.elements.namedItem(fields[0])
      if (fields[0] === 'spentOn') form.querySelector<HTMLButtonElement>('.date-field-trigger')?.focus()
      else if (first instanceof HTMLElement) first.focus()
      return
    }
    if (await onSave(result.data) && !expense) {
      form.reset()
      editedFields.current.clear()
      setInvalid({})
    }
  }

  return <section className="panel purchase-entry">
    <h2 id="purchase-form-title">{t(expense ? 'editPurchase' : 'addPurchase')}</h2>
    {context && <p className="muted purchase-form-context">{context}</p>}
    <form onSubmit={submit} onBlur={event => validateField(event, true)}
      onChange={event => validateField(event, false)} noValidate>
      <fieldset className="purchase-form" aria-labelledby="purchase-form-title" disabled={busy}>
        <label>{t('purchaseItem')}<input ref={item} {...fieldProps('item')} defaultValue={expense?.item}
          dir="auto" maxLength={120} required />{fieldError('item')}</label>
        <div className="purchase-form-pair">
          <label>{t('purchaseAmount')}<input {...fieldProps('amount')} inputMode="decimal" dir="ltr"
            defaultValue={expense ? (expense.amount_minor / 100).toFixed(2) : ''} required />{fieldError('amount')}</label>
          <div>
            <DateField label={t('purchaseDate')} name="spentOn" defaultValue={expense?.spent_on ?? defaultDate ?? purchaseToday()}
              invalid={invalid.spentOn} describedBy={fieldProps('spentOn')['aria-describedby']}
              onChange={() => setInvalid(previous => ({ ...previous, spentOn: false }))} />
            {fieldError('spentOn')}
          </div>
        </div>
        <label>{t('purchaseCategory')}
          <Select {...fieldProps('category')} defaultValue={expense?.category ?? defaultCategory ?? ''} required>
            <option value="" disabled>{t('chooseCategory')}</option>
            {expenseCategories.map(category => <option value={category} key={category}>{t(category)}</option>)}
          </Select>
          {fieldError('category')}
        </label>
        <label>{t('purchaseNote')}<textarea {...fieldProps('note')} dir="auto" maxLength={500}
          defaultValue={expense?.note ?? ''} />{fieldError('note')}</label>
        {error && <Toast message={t(error)} />}
        <div className="purchase-actions">
          <button className="primary" type="submit" aria-busy={busy}>{t('savePurchase')}</button>
          {expense && <button className="secondary" type="button" data-modal-dismiss onClick={onCancel}>{t('cancelPurchase')}</button>}
        </div>
      </fieldset>
    </form>
  </section>
}
