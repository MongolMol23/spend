import { useFormats } from '../i18n/useFormats'

export function Amount({ value }: { value: number }) {
  const { money } = useFormats()
  return <bdi className="amount">{money.format(value)}</bdi>
}
