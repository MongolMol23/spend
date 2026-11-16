import { useRef, type ComponentProps } from 'react'

export function Modal({ busy = false, onDismiss, ...props }: ComponentProps<'dialog'> & {
  busy?: boolean
  onDismiss?: () => void
}) {
  const startedOutside = useRef(false)

  return <dialog {...props}
    onPointerDown={event => {
      startedOutside.current = event.target === event.currentTarget
    }}
    onClick={event => {
      const startedOnBackdrop = startedOutside.current
      startedOutside.current = false
      if (busy || !startedOnBackdrop || event.target !== event.currentTarget) return

      const { left, right, top, bottom } = event.currentTarget.getBoundingClientRect()
      if (event.clientX >= left && event.clientX < right && event.clientY >= top && event.clientY < bottom) return

      if (onDismiss) onDismiss()
      else event.currentTarget.close()
    }}
    onCancel={event => {
      if (busy || onDismiss) event.preventDefault()
      if (!busy) onDismiss?.()
    }}
  />
}
