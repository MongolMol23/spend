import { useRef, type PointerEvent, type RefObject } from 'react'

type Gesture = {
  pointerId: number
  startX: number
  startY: number
  direction: number
  width: number
  dragging: boolean
  lastX: number
  lastTime: number
  velocity: number
}

export function useSidebarSwipe(sidebar: RefObject<HTMLDialogElement | null>) {
  const gesture = useRef<Gesture | null>(null)

  function settle(close = false) {
    const dialog = sidebar.current
    gesture.current = null
    if (!dialog?.hasAttribute('data-dragging')) return
    // Commit the dragged position before the drawer transitions to its destination.
    getComputedStyle(dialog).getPropertyValue('translate')
    dialog.removeAttribute('data-dragging')
    dialog.style.removeProperty('--sidebar-drag-x')
    dialog.style.removeProperty('--sidebar-drag-opacity')
    if (close) dialog.close()
  }

  function onPointerDown(event: PointerEvent<HTMLDivElement>) {
    if (event.pointerType !== 'touch' && event.pointerType !== 'pen') return
    const dialog = sidebar.current
    settle()
    if (!event.isPrimary || !dialog?.open) return
    gesture.current = {
      pointerId: event.pointerId,
      startX: event.clientX,
      startY: event.clientY,
      direction: getComputedStyle(dialog).direction === 'rtl' ? 1 : -1,
      width: dialog.offsetWidth,
      dragging: false,
      lastX: event.clientX,
      lastTime: event.timeStamp,
      velocity: 0,
    }
  }

  function onPointerMove(event: PointerEvent<HTMLDivElement>) {
    const active = gesture.current
    const dialog = sidebar.current
    if (!dialog?.open || active?.pointerId !== event.pointerId) return
    const dx = event.clientX - active.startX
    const dy = event.clientY - active.startY
    if (!active.dragging) {
      if (Math.abs(dy) >= 10 && Math.abs(dy) >= Math.abs(dx)) { settle(); return }
      if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.35) return
      active.dragging = true
      event.currentTarget.setPointerCapture(event.pointerId)
      dialog.setAttribute('data-pointer', 'true')
      dialog.setAttribute('data-dragging', '')
    }
    const distance = Math.min(active.width, Math.max(0, dx * active.direction))
    dialog.style.setProperty('--sidebar-drag-x', distance * active.direction + 'px')
    dialog.style.setProperty('--sidebar-drag-opacity', String(1 - distance / active.width))
    const elapsed = event.timeStamp - active.lastTime
    if (elapsed > 0) active.velocity = (event.clientX - active.lastX) * active.direction / elapsed
    active.lastX = event.clientX
    active.lastTime = event.timeStamp
  }

  function onPointerUp(event: PointerEvent<HTMLDivElement>) {
    const active = gesture.current
    if (active?.pointerId !== event.pointerId) return
    const distance = (event.clientX - active.startX) * active.direction
    const flick = distance >= 30 && active.velocity > .5 && event.timeStamp - active.lastTime < 85
    settle(active.dragging && (distance >= active.width * .27 || flick))
  }

  function onPointerCancel(event: PointerEvent<HTMLDivElement>) {
    if (gesture.current?.pointerId === event.pointerId) settle()
  }

  function onLostPointerCapture(event: PointerEvent<HTMLDivElement>) {
    if (event.target === event.currentTarget) onPointerCancel(event)
  }

  return { onPointerDown, onPointerMove, onPointerUp, onPointerCancel, onLostPointerCapture }
}
