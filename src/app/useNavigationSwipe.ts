import { useEffect, useLayoutEffect, useRef, type RefObject } from 'react'
import { useLocation, useNavigate } from 'react-router'

const excluded = 'button, input, select, textarea, label, summary, dialog, [contenteditable], [role="slider"], [data-no-swipe]'
const swipeEase = 'cubic-bezier(.22, 1, .36, 1)'

function swipeGutter(main: HTMLElement) {
  return Math.max(0, (window.innerWidth - main.offsetWidth) / 2 - 4)
}

function swipeSurface(main: HTMLElement, group: string | undefined) {
  if (group === undefined) return main
  return Array.from(main.querySelectorAll<HTMLElement>('[data-page-swipe-panel]'))
    .find(panel => panel.dataset.pageSwipePanel === group && panel.getClientRects().length > 0) ?? main
}

export function useNavigationSwipe(header: RefObject<HTMLDivElement | null>, enabled: boolean) {
  const navigate = useNavigate()
  const { pathname, search } = useLocation()
  const swipeDestination = useRef<{ path: string; offset: number; group?: string; nested: boolean } | null>(null)

  useLayoutEffect(() => {
    const destination = swipeDestination.current
    if (destination?.path !== pathname + search) return
    swipeDestination.current = null
    const main = document.getElementById('main')
    if (!destination.nested) window.scrollTo({ top: 0, behavior: 'instant' })
    if (main && !window.matchMedia('(prefers-reduced-motion: reduce)').matches) {
      const entrance = Math.sign(destination.offset) * Math.min(Math.abs(destination.offset), swipeGutter(main))
      swipeSurface(main, destination.group).animate([{ translate: entrance + 'px' }, { translate: '0px' }], { duration: 220, easing: swipeEase })
    }
  }, [pathname, search])

  useEffect(() => {
    const headerNav = header.current?.querySelector(':scope > .header-nav')
    const nav = headerNav?.querySelector('.site-nav')
    const more = header.current?.querySelector('.nav-more')
    if (!enabled || !nav || !more) return

    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)')
    let start: { id: number; x: number; y: number; main: HTMLElement; surface: HTMLElement; links: Element; group?: string; nested: boolean; horizontal: boolean } | undefined
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
      if (start) resetDrag(start.surface, true)
      start = undefined
    }

    const onStart = (event: TouchEvent) => {
      onCancel()
      const target = event.target
      const touch = event.touches[0]
      const main = document.getElementById('main')
      const scope = target instanceof Element ? target.closest('[data-page-swipe-scope]') : null
      const localNav = scope?.querySelector<HTMLElement>('[data-page-swipe-nav]')
        ?? main?.querySelector<HTMLElement>('[data-page-swipe-nav]')
      const group = localNav?.dataset.pageSwipeNav
      const links = localNav ?? nav
      const limit = localNav ?? more
      if (event.touches.length !== 1 || !(target instanceof Element) || !main
        || !(main.contains(target) || target === document.body || target === document.documentElement || target.id === 'root')
        || (target.closest(excluded) && !target.closest('button[data-swipe-control]'))
        || !limit.getClientRects().length || document.querySelector('dialog[open]')
        || (localNav?.hasAttribute('data-compact-swipe') && !more.getClientRects().length)
        || touch.clientX < 18 || touch.clientX > window.innerWidth - 18
        || !links.querySelector('a[aria-current]')?.getClientRects().length) return

      // Leave horizontal carousels and scrollable content in control of their own gestures.
      for (let element: Element | null = target; element && element !== document.body; element = element.parentElement) {
        if (element.scrollWidth > element.clientWidth && /auto|scroll/.test(getComputedStyle(element).overflowX)) return
      }
      settle?.cancel()
      start = { id: touch.identifier, x: touch.clientX, y: touch.clientY, main, surface: swipeSurface(main, group), links, group, nested: scope !== null, horizontal: false }
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
        start.surface.style.translate = offset + 'px'
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

      const routes = Array.from(origin.links.querySelectorAll<HTMLAnchorElement>('a[href]'))
        .filter(link => link.getClientRects().length > 0)
      const current = routes.findIndex(link => link.hasAttribute('aria-current'))
      const forward = document.documentElement.dir === 'rtl' ? dx > 0 : dx < 0
      const next = current < 0 ? undefined : routes[current + (forward ? 1 : -1)]
      if (!next) { onCancel(); return }
      resetDrag(origin.surface, false)
      start = undefined
      const path = next.pathname + next.search
      swipeDestination.current = { path, offset: dx < 0 ? 26 : -26, group: origin.group, nested: origin.nested }
      void navigate(path)
    }

    const options = { passive: true }
    document.addEventListener('touchstart', onStart, options)
    document.addEventListener('touchmove', onMove, options)
    document.addEventListener('touchend', onEnd, options)
    document.addEventListener('touchcancel', onCancel, options)
    return () => {
      if (start) resetDrag(start.surface, false)
      settle?.cancel()
      document.removeEventListener('touchstart', onStart)
      document.removeEventListener('touchmove', onMove)
      document.removeEventListener('touchend', onEnd)
      document.removeEventListener('touchcancel', onCancel)
    }
  }, [enabled, header, navigate, pathname, search])
}
