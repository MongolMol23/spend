import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { useLocation, useNavigate } from 'react-router'

const excluded = 'a, button, input, select, textarea, label, summary, dialog, [contenteditable], [role="slider"], [data-no-swipe]'
const swipeEase = 'cubic-bezier(.22, 1, .36, 1)'

function swipeGutter(main: HTMLElement) {
  return Math.max(0, (window.innerWidth - main.offsetWidth) / 2 - 4)
}

export function useNavigationSwipe(header: RefObject<HTMLDivElement | null>, enabled: boolean) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const swipeDestination = useRef<{ path: string; offset: number } | null>(null)

  useLayoutEffect(() => {
    const destination = swipeDestination.current
    if (destination?.path !== pathname) return
    swipeDestination.current = null
    const main = document.getElementById('main')
    main?.focus({ preventScroll: true })
    window.scrollTo({ top: 0, behavior: 'instant' })
    if (main && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const entrance = Math.sign(destination.offset) * Math.min(Math.abs(destination.offset), swipeGutter(main))
      main.animate([{ translate: entrance + 'px' }, { translate: '0px' }], { duration: 220, easing: swipeEase })
    }
  }, [pathname])

  useEffect(() => {
    const nav = header.current?.querySelector(':scope > .site-nav')
    const more = nav?.querySelector('.nav-more')
    if (!enabled || !nav || !more) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let start: { id: number; x: number; y: number; main: HTMLElement; horizontal: boolean } | undefined
    let offset = 0
    let settle: Animation | undefined
    function resetDrag(main: HTMLElement, animate: boolean) {
      main.style.removeProperty('translate')
      if (offset && animate && !reducedMotion.matches) {
        settle?.cancel()
        settle = main.animate([{ translate: offset + 'px' }, { translate: '0px' }], { duration: 180, easing: swipeEase })
      }
      offset = 0
    }

    function onCancel() {
      if (start) resetDrag(start.main, true)
      start = undefined
    }

    const onStart = (event: TouchEvent) => {
      onCancel()
      const target = event.target
      const touch = event.touches[0]
      const main = target instanceof Element ? target.closest<HTMLElement>('main#main') : null
      if (event.touches.length !== 1 || !(target instanceof Element) || !main
        || target.closest(excluded) || !more?.getClientRects().length || document.querySelector('dialog[open]')
        || touch.clientX < 18 || touch.clientX > window.innerWidth - 18
        || !nav.querySelector('a[aria-current]')?.getClientRects().length) return

      // Leave horizontal carousels and scrollable content in control of their own gestures.
      for (let element: Element | null = target; element && element !== document.body; element = element.parentElement) {
        if (element.scrollWidth > element.clientWidth && /auto|scroll/.test(getComputedStyle(element).overflowX)) return
      }
      settle?.cancel()
      start = { id: touch.identifier, x: touch.clientX, y: touch.clientY, main, horizontal: false }
    }

    function onMove(event: TouchEvent) {
      if (!start) return
      const touch = event.touches[0]
      if (event.touches.length !== 1) { onCancel(); return }
      const dx = touch.clientX - start.x
      const dy = touch.clientY - start.y
      if (!start.horizontal) {
        if (Math.abs(dy) > 14 && Math.abs(dy) >= Math.abs(dx)) { onCancel(); return }
        if (Math.abs(dx) < 10 || Math.abs(dx) < Math.abs(dy) * 1.35) return
        start.horizontal = true
      }
      if (!reducedMotion.matches) {
        offset = Math.sign(dx) * Math.min(Math.abs(dx) * .25, swipeGutter(start.main), 24)
        start.main.style.translate = offset + 'px'
      }
    }

    const onEnd = (event: TouchEvent) => {
      const origin = start
      const touch = Array.from(event.changedTouches).find(point => point.identifier === origin?.id)
      if (!origin || !touch || event.touches.length
        || document.getSelection()?.toString() || document.querySelector('dialog[open]')) { onCancel(); return }

      const dx = touch.clientX - origin.x
      const dy = touch.clientY - origin.y
      if (Math.abs(dx) < 44 || Math.abs(dx) < Math.abs(dy) * 1.35) { onCancel(); return }

      // Read the visible links in navbar order. The More button is not a route.
      const routes = Array.from(nav.querySelectorAll<HTMLAnchorElement>('a[href]'))
        .filter(link => link.getClientRects().length > 0)
        .map(link => link.pathname)
      const current = routes.indexOf(pathname)
      const forward = document.documentElement.dir === 'rtl' ? dx > 0 : dx < 0
      const next = current < 0 ? undefined : routes[current + (forward ? 1 : -1)]
      if (!next) { onCancel(); return }
      resetDrag(origin.main, false)
      start = undefined
      swipeDestination.current = { path: next, offset: dx < 0 ? 26 : -26 }
      void navigate(next)
    }

    const options = { passive: true }
    document.addEventListener('touchstart', onStart, options)
    document.addEventListener('touchmove', onMove, options)
    document.addEventListener('touchend', onEnd, options)
    document.addEventListener('touchcancel', onCancel, options)
    return () => {
      if (start) resetDrag(start.main, false)
      settle?.cancel()
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
      document.removeEventListener('touchcancel', onCancel)
    }
  }, [enabled, header, navigate, pathname])
}
