import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { useLocation, useNavigate } from 'react-router'

const excluded = 'a, button, input, select, textarea, label, summary, dialog, [contenteditable], [role="slider"], [data-no-swipe]'

export function useNavigationSwipe(header: RefObject<HTMLDivElement | null>, enabled: boolean) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const swipeDestination = useRef<string | null>(null)

  useLayoutEffect(() => {
    if (swipeDestination.current !== pathname) return
    swipeDestination.current = null
    document.getElementById('main')?.focus({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: 'instant' })
  }, [pathname])

  useEffect(() => {
    const nav = header.current?.querySelector(':scope > .site-nav')
    const more = nav?.querySelector('.nav-more')
    if (!enabled || !nav || !more) return

    let start: { id: number; x: number; y: number; time: number } | undefined
    function onStart(event: TouchEvent) {
      start = undefined
      const target = event.target
      const touch = event.touches[0]
      if (event.touches.length !== 1 || !(target instanceof Element) || !target.closest('main#main')
        || target.closest(excluded) || !more?.getClientRects().length || document.querySelector('dialog[open]')
        || touch.clientX < 24 || touch.clientX > window.innerWidth - 24) return

      // Leave horizontal carousels and scrollable content in control of their own gestures.
      for (let element: Element | null = target; element && element !== document.body; element = element.parentElement) {
        if (element.scrollWidth > element.clientWidth && /auto|scroll/.test(getComputedStyle(element).overflowX)) return
      }
      start = { id: touch.identifier, x: touch.clientX, y: touch.clientY, time: event.timeStamp }
    }

    function onMove(event: TouchEvent) {
      if (!start) return
      const touch = event.touches[0]
      if (event.touches.length !== 1 || (Math.abs(touch.clientY - start.y) > 18
        && Math.abs(touch.clientY - start.y) >= Math.abs(touch.clientX - start.x))) start = undefined
    }

    const onEnd = (event: TouchEvent) => {
      const origin = start
      start = undefined
      const touch = Array.from(event.changedTouches).find(point => point.identifier === origin?.id)
      if (!origin || !touch || event.touches.length || event.timeStamp - origin.time > 700
        || document.getSelection()?.toString() || document.querySelector('dialog[open]')) return

      const dx = touch.clientX - origin.x
      const dy = touch.clientY - origin.y
      if (Math.abs(dx) < 65 || Math.abs(dx) < Math.abs(dy) * 1.6) return

      // Read the visible links in navbar order. The More button is not a route.
      const routes = Array.from(nav.querySelectorAll<HTMLAnchorElement>('a[href]'))
        .filter(link => link.getClientRects().length > 0)
        .map(link => link.pathname)
      const current = routes.indexOf(pathname)
      const forward = document.documentElement.dir === 'rtl' ? dx > 0 : dx < 0
      const next = current < 0 ? undefined : routes[current + (forward ? 1 : -1)]
      if (!next) return
      swipeDestination.current = next
      void navigate(next)
    }

    function onCancel() { start = undefined }

    const options = { passive: true }
    document.addEventListener('touchstart', onStart, options)
    document.addEventListener('touchmove', onMove, options)
    document.addEventListener('touchend', onEnd, options)
    document.addEventListener('touchcancel', onCancel, options)
    return () => {
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
      document.removeEventListener('touchcancel', onCancel)
    }
  }, [enabled, header, navigate, pathname])
}
