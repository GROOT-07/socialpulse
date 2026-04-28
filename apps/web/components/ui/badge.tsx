import * as React from 'react'
import { cva, type VariantProps } from 'class-variance-authority'
import { cn } from '@/lib/utils'

const badgeVariants = cva(
  'inline-flex items-center gap-1 rounded-full px-2 font-semibold uppercase tracking-wide transition-colors',
  {
    variants: {
      variant: {
        default: 'bg-surface-2 text-[var(--color-text-3)]',
        outline: 'border border-brand-border bg-transparent text-[var(--color-text-3)]',
        accent:  'bg-accent-light text-accent',
        success: 'bg-success/10 text-success',
        warning: 'bg-warning/10 text-warning',
        danger:  'bg-danger/10 text-danger',
      },
      size: {
        default: 'h-5 text-[10px]',
        sm:      'h-4 text-[10px]',
      },
    },
    defaultVariants: {
      variant: 'default',
      size: 'default',
    },
  },
)

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

function Badge({ className, variant, size, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant, size }), className)} {...props} />
}

export { Badge, badgeVariants }
