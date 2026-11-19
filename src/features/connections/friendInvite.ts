import { profileSchema } from '../accounts/validation'

export function inviteUsername(value: string | null) {
  return profileSchema.shape.username.safeParse(value).data
}

export function friendInvitePath(username: string) {
  return '/connections?' + new URLSearchParams({ view: 'add', friend: username })
}

export function friendInviteAccountPath(username: string | undefined, signup = false) {
  const path = signup ? '/account/signup' : '/account'
  return username ? path + '?' + new URLSearchParams({ friend: username }) : path
}
