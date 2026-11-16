export function toMinorUnits(raw: string): number | null {
  const normalized = raw.trim().replace(/[٠-٩۰-۹]/g, digit =>
    String(digit.charCodeAt(0) - (digit <= '٩' ? 0x660 : 0x6f0))).replace(/[٫,]/g, '.')
  if (!/^\d{1,8}(\.\d{1,2})?$/.test(normalized)) return null
  const [whole, fraction = ''] = normalized.split('.')
  const value = Number(whole) * 100 + Number(fraction.padEnd(2, '0'))
  return value > 0 && value <= 2147483647 ? value : null
}
