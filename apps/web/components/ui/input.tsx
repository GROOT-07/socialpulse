import * as React from 'react'
import { cn } from '@/lib/utils'

// Per BRAND_GUIDELINES §7.3
export interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  error?: boolean
}

const Input = React.forwardRef<HTMLInputElement, InputProps>(
  ({ className, error, type, ...props }, ref) => {
    return (
      <input
        type={type}
        className={cn(
          'flex h-9 w-full rounded border bg-surface px-3 py-0 text-base text-[var(--color-text)] placeholder:text-[var(--color-text-4)] transition-shadow duration-fast',
          'border-brand-border-2',
          'focus-visible:outline-none focus-visible:border-accent focus-visible:shadow-accent',
          'disabled:cursor-not-allowed disabled:opacity-45',
          error && 'border-danger shadow-[0_0_0_3px_rgba(239,68,68,0.2)]',
          className,
        )}
        ref={ref}
        {...props}
      />
    )
  },
)
Input.displayName = 'Input'

export { Input }
