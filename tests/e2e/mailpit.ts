import { expect, type APIRequestContext } from '@playwright/test'

const mailpit = 'http://127.0.0.1:54324'

export async function mailLink(request: APIRequestContext, email: string, path: string) {
  let link = ''
  await expect.poll(async () => {
    const inbox = await request.get(mailpit + '/api/v1/messages')
    if (!inbox.ok()) return ''
    const data = await inbox.json() as { messages?: { ID: string; To: { Address: string }[] }[] }
    for (const message of data.messages ?? []) {
      if (!message.To.some(recipient => recipient.Address === email)) continue
      const response = await request.get(mailpit + '/api/v1/message/' + message.ID)
      if (!response.ok()) continue
      const detail = await response.json() as { HTML?: string }
      const match = [...(detail.HTML ?? '').matchAll(/href="([^"]+)"/g)]
        .find(([, href]) => new URL(href).pathname === path)
      if (match) {
        link = match[1]
        return link
      }
    }
    return ''
  }, { timeout: 15_000 }).not.toBe('')
  return link
}


