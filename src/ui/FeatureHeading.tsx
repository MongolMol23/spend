import type { ReactNode } from 'react'
import type { LucideIcon } from 'lucide-react'

export function FeatureHeading({ title, icon: Icon, accent, children }: {
  title: string
  icon: LucideIcon
  accent: 'amber' | 'mint' | 'peach' | 'lavender'
  children?: ReactNode
}) {
  return <header className="feature-heading" data-accent={accent}>
    <span className="feature-heading-icon" aria-hidden="true"><Icon size={22} /></span>
    <h1>{title}</h1>
    {children}
  </header>
}
