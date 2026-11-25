import { useLayoutEffect, useRef } from 'react'
import { useTranslation } from 'react-i18next'

export function ActiveLinkIndicator({ selection }: { selection: string }) {
  const indicator = useRef<HTMLSpanElement>(null)
  const { i18n } = useTranslation()

  useLayoutEffect(() => {
    const highlight = indicator.current
    const container = highlight?.parentElement
    if (!highlight || !container) return

    const position = () => {
      const active = container.querySelector(':scope > a[aria-current], :scope > button[aria-pressed="true"]')
      if (!active?.getClientRects().length) {
        highlight.hidden = true
        return
      }

      const bounds = container.getBoundingClientRect()
      const tab = active.getBoundingClientRect()
      highlight.style.transform = `translate(${tab.left - bounds.left - container.clientLeft}px, ${tab.top - bounds.top - container.clientTop}px)`
      highlight.style.width = `${tab.width}px`
      highlight.style.height = `${tab.height}px`
      highlight.hidden = false
    }

    position()
    if (typeof ResizeObserver === 'undefined') return
    // Translations and count badges can change link dimensions between selections.
    const observer = new ResizeObserver(position)
    observer.observe(container)
    for (const control of container.querySelectorAll(':scope > a, :scope > button')) observer.observe(control)
    return () => observer.disconnect()
  }, [selection, i18n.language])

  return <span ref={indicator} className="nav-indicator" aria-hidden="true" hidden />
}
