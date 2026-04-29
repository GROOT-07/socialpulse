import React from 'react'
import Link from 'next/link'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// Per BRAND_GUIDELINES §7.10
// Supports two action shapes:
//   - Legacy: { label, onClick?, href? }
//   - New: React.ReactNode (any button/link)

interface EmptyStateProps {
  icon?: React.ReactNode
  /** Primary text. Also aliased as `title` for backwards compat. */
  heading?: string
  title?: string
  description?: string
  action?:
    | React.ReactNode
    | { label: string; onClick?: () => void; href?: string }
  className?: string
}

function isActionObject(
  a: NonNullable<EmptyStateProps['action']>,
): a is { label: string; onClick?: () => void; href?: string } {
  return typeof a === 'object' && !React.isValidElement(a) && 'label' in (a as object)
}

export function EmptyState({ icon, heading, title, description, action, className }: EmptyStateProps) {
  const headingText = heading ?? title ?? ''

  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-8 text-center', className)}>
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center text-[var(--color-text-4)]">
          {icon}
        </div>
      )}
      {headingText && (
        <h3 className="mb-1 text-base font-semibold text-[var(--color-text-2)]">{headingText}</h3>
      )}
      {description && (
        <p className="mb-6 max-w-xs text-sm text-[var(--color-text-4)]">{description}</p>
      )}
      {action && (
        <div className="mt-4">
          {isActionObject(action) ? (
            action.href ? (
              <Button size="sm" asChild>
                <Link href={action.href}>{action.label}</Link>
              </Button>
            ) : (
              <Button size="sm" onClick={action.onClick}>
                {action.label}
              </Button>
            )
          ) : (
            action
          )}
        </div>
      )}
    </div>
  )
}
