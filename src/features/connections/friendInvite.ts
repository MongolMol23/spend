import { profileSchema } from '../accounts/validation'

export function inviteUsername(value: string | null) {
  return profileSchema.shape.username.safeParse(value).data
}

export function friendInvitePath(username: string) {
  return '/connections?' + new URLSearchParams({ view: 'add', friend: username })
}

export function scannedInviteUsername(value: string, origin: string) {
  try {
    const url = new URL(value)
    if (url.origin === origin && url.pathname === '/connections' && url.searchParams.get('view') === 'add') {
      return inviteUsername(url.searchParams.get('friend'))
    }
  } catch {
    // A QR code can contain arbitrary text.
  }
}

export function friendInviteAccountPath(username: string | undefined, signup = false) {
  const path = signup ? '/account/signup' : '/account'
  return username ? path + '?' + new URLSearchParams({ friend: username }) : path
}
