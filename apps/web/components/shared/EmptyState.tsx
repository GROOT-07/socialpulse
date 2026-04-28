import React from 'react'
import { cn } from '@/lib/utils'
import { Button } from '@/components/ui/button'

// Per BRAND_GUIDELINES §7.10
interface EmptyStateProps {
  icon?: React.ReactNode
  heading: string
  description?: string
  action?: {
    label: string
    onClick?: () => void
    href?: string
  }
  className?: string
}

export function EmptyState({ icon, heading, description, action, className }: EmptyStateProps) {
  return (
    <div className={cn('flex flex-col items-center justify-center py-16 px-8 text-center', className)}>
      {icon && (
        <div className="mb-4 flex h-12 w-12 items-center justify-center text-[var(--color-text-4)]">
          {icon}
        </div>
      )}
      <h3 className="mb-1 text-md font-semibold text-[var(--color-text-2)]">{heading}</h3>
      {description && (
        <p className="mb-6 max-w-xs text-sm text-[var(--color-text-4)]">{description}</p>
      )}
      {action && (
        <Button
          variant="primary"
          size="sm"
          onClick={action.onClick}
          {...(action.href ? { asChild: true } : {})}
        >
          {action.label}
        </Button>
      )}
    </div>
  )
}
