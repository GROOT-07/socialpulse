import React from 'react'

interface PageHeaderProps {
  title: string
  description?: string
  /** Optional icon displayed left of the title */
  icon?: React.ReactNode
  /** Optional action buttons rendered right of the header */
  actions?: React.ReactNode
}

export function PageHeader({ title, description, icon, actions }: PageHeaderProps) {
  return (
    <div className="flex items-start justify-between gap-4">
      <div className="flex items-start gap-3">
        {icon && (
          <div className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-[var(--color-accent-light)] text-[var(--color-accent)]">
            {icon}
          </div>
        )}
        <div>
          <h1 className="text-2xl font-bold text-[var(--color-text)]">{title}</h1>
          {description && (
            <p className="mt-1 text-sm text-[var(--color-text-3)]">{description}</p>
          )}
        </div>
      </div>
      {actions && <div className="flex shrink-0 items-center gap-2">{actions}</div>}
    </div>
  )
}
