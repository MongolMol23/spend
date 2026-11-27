import { expect, test, type Browser, type APIRequestContext } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { mailLink } from './mailpit'

test.use({ actionTimeout: 12_000 })

async function account(browser: Browser, request: APIRequestContext, username: string) {
  const context = await browser.newContext()
  const page = await context.newPage()
  const email = username + '@example.com'
  await page.goto('http://127.0.0.1:5173/account/signup')
  await page.getByLabel('Name in Arabic').fill('محمد')
  await page.getByLabel('Name in English').fill(username)
  await page.getByLabel('Username').fill(username)
  await page.getByLabel('Email').fill(email)
  await page.getByLabel('Password', { exact: true }).fill('Spend-test-2026!')
  await page.getByLabel('Confirm password').fill('Spend-test-2026!')
  await page.getByRole('button', { name: 'Create account' }).click()
  await expect(page.getByRole('status')).toContainText('will arrive shortly')
  await page.goto(await mailLink(request, email, '/account/confirm'))
  await page.getByRole('button', { name: 'Verify link' }).click()
  await expect(page.getByRole('status')).toHaveText('Email confirmed.')
  await page.getByRole('link', { name: 'Sign in' }).click()
  await expect(page.getByLabel('Username', { exact: true })).toHaveValue(username)
  await page.goto('http://127.0.0.1:5173/connections')
  await expect(page.getByRole('heading', { name: 'Money requests', exact: true })).toBeVisible()
  return { context, page }
}

test('friends exchange a private bilingual money request', async ({ browser, request }) => {
  test.setTimeout(100_000)
  const suffix = Date.now().toString(36)
  const first = await account(browser, request, 'a_' + suffix)
  const second = await account(browser, request, 'b_' + suffix)
  const third = await account(browser, request, 'c_' + suffix)
  try {
    // The desktop grid can make the friends card narrower than the mobile layout.
    await first.page.setViewportSize({ width: 900, height: 850 })
    await second.page.setViewportSize({ width: 390, height: 850 })
    await second.page.locator('.language').selectOption('ar')
    await expect(second.page.locator('.header-response bdi')).toHaveText('٠')
    for (const page of [first.page, second.page]) {
      await page.locator('.connection-sections a[href="/connections?view=add"]').click()
      const form = page.locator('.friend-search')
      const input = await form.getByRole('textbox').boundingBox()
      const button = await form.getByRole('button').boundingBox()
      expect(input).not.toBeNull()
      expect(button).not.toBeNull()
      expect(button!.y).toBeLessThan(input!.y + input!.height)
      expect(button!.x + button!.width <= input!.x || input!.x + input!.width <= button!.x).toBe(true)
    }
    await first.page.getByLabel('Username').fill('b_' + suffix)
    await first.page.getByRole('button', { name: 'Find friend' }).click()
    await first.page.getByRole('button', { name: 'Add friend' }).click()
    await expect(second.page.locator('.header-response bdi')).toHaveText('١', { timeout: 10_000 })
    await expect(first.page.getByLabel('Friend', { exact: true })).toHaveCount(0)
    await second.page.locator('.connection-sections a[href="/connections?view=friends"]').click()
    await second.page.getByRole('button', { name: 'قبول', exact: true }).click()
    await expect(second.page.locator('.header-response bdi')).toHaveText('٠', { timeout: 10_000 })
    await expect(second.page.getByText('اتعمل.', { exact: true })).toBeVisible()
    for (const page of [first.page, second.page]) {
      await page.locator('.connection-sections a[href="/connections"]').click()
    }
    await first.page.goto('/debts?direction=owed')
    const compose = first.page.getByRole('button', { name: 'Add debt', exact: true })
    await expect(compose).toBeEnabled({ timeout: 10_000 })
    await compose.click()
    await first.page.getByLabel('Contact name').fill('b_' + suffix)
    await first.page.locator('.debt-friend-options').getByRole('button', { name: new RegExp('b_' + suffix) }).click()
    await first.page.getByLabel('Total amount (EGP)').fill('٥٠٠')
    await first.page.getByLabel('Request reason').fill('نص حساب العشا')
    await first.page.getByRole('button', { name: 'Send request' }).click()
    await second.page.getByRole('link', { name: /نص حساب العشا/ }).click()
    await second.page.getByRole('button', { name: 'قبول', exact: true }).click()
    await expect(first.page.locator('.debt-list').getByRole('link', { name: /نص حساب العشا/ })).toBeVisible()
    await expect(second.page).toHaveURL(/\/debts\?request=/)
    await second.page.getByLabel('المبلغ المدفوع بالجنيه').fill('٢٠٠')
    // The server commits, but the first response is lost. Retrying must reuse its operation key.
    await second.page.route('**/rpc/record_request_payment', async route => {
      await route.fetch()
      await route.abort('failed')
    }, { times: 1 })
    await second.page.getByRole('button', { name: 'تسجيل دفعة' }).click()
    await expect(second.page.getByRole('alert')).toHaveText('محصلش المطلوب. جرّب تاني.')
    await second.page.getByRole('button', { name: 'تسجيل دفعة' }).click()
    await expect(second.page.getByText('في انتظار التأكيد', { exact: true }).first()).toBeVisible()
    await expect(second.page.locator('.payment-section .ledger').first().locator('li')).toHaveCount(1)
    await first.page.locator('.debt-list').getByRole('link', { name: /نص حساب العشا/ }).click()
    await first.page.getByRole('button', { name: 'Confirm receipt' }).click()
    await expect(first.page.getByText('Payment confirmed', { exact: true }).first()).toBeVisible()
    await expect(second.page.getByText('الدفعة اتأكدت', { exact: true }).first()).toBeVisible({ timeout: 10_000 })
    await expect(first.page.locator('.payment-totals')).toContainText('300')
    await expect(second.page.locator('.payment-totals')).toContainText('٣٠٠')

    await second.page.getByText('اقترح تعديل').click()
    await second.page.getByLabel('عايز تعدّل إيه؟').selectOption('payment_cancel')
    await second.page.getByLabel('اختار دفعة مؤكدة').selectOption({ index: 1 })
    await second.page.getByLabel('سبب التعديل').fill('تم التسجيل بالخطأ')
    await second.page.getByRole('button', { name: 'ابعت اقتراح التعديل' }).click()
    await first.page.getByRole('button', { name: 'Approve correction' }).click({ timeout: 10_000 })
    await expect(first.page.locator('.payment-totals')).toContainText('500')
    await expect(second.page.locator('.payment-totals')).toContainText('٥٠٠', { timeout: 10_000 })
    for (const { page } of [first, second]) {
      expect(await page.evaluate(() => document.documentElement.scrollWidth <= innerWidth)).toBe(true)
      expect((await new AxeBuilder({ page }).analyze()).violations.map(item => item.id)).toEqual([])
    }
    const requestId = new URL(second.page.url()).searchParams.get('request')
    expect(requestId).toBeTruthy()
    const simultaneous = await second.page.evaluate(async id => {
      const modulePath = '/src/data/supabase.ts'
      const { supabase } = await import(/* @vite-ignore */ modulePath)
      const responses = await Promise.all([0, 1].map(() => supabase.rpc('record_request_payment', {
        p_request: id, p_amount: 30000, p_key: crypto.randomUUID(),
      })))
      return responses.map(response => response.error === null)
    }, requestId)
    expect(simultaneous.filter(Boolean)).toHaveLength(1)
    await third.page.goto(second.page.url())
    await expect(third.page.getByText('This request is unavailable.')).toBeVisible()
  } finally {
    await Promise.all([first.context.close(), second.context.close(), third.context.close()])
  }
})
