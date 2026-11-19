import type { Locator, Page } from '@playwright/test'

export async function pickDate(page: Page, trigger: Locator, label: string, day: string) {
  await trigger.click()
  const calendar = page.getByRole('dialog', { name: label, exact: true })
  await calendar.getByRole('spinbutton', { name: 'Year' }).fill(day.slice(0, 4))
  await calendar.getByRole('combobox', { name: 'Month' }).selectOption(day.slice(5, 7))
  const format = new Intl.DateTimeFormat('en-EG', { dateStyle: 'long', timeZone: 'UTC' })
  await calendar.getByRole('button', { name: format.format(new Date(day)), exact: true }).click()
}
