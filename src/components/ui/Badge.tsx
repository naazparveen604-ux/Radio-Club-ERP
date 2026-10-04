import * as React from "react"
import { cn } from "../../lib/utils"

export interface BadgeProps extends React.HTMLAttributes<HTMLDivElement> {
  variant?: 'default' | 'secondary' | 'outline' | 'destructive' | 'success' | 'warning' | 'info'
}

function Badge({ className, variant = 'default', ...props }: BadgeProps) {
  return (
    <div
      className={cn(
        "inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold transition-colors focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2",
        {
          'border-transparent bg-primary text-primary-foreground': variant === 'default',
          'border-transparent bg-secondary text-secondary-foreground': variant === 'secondary',
          'border-transparent bg-error text-error-foreground': variant === 'destructive',
          'border-transparent bg-success text-success-foreground': variant === 'success',
          'border-transparent bg-warning text-warning-foreground': variant === 'warning',
          'border-transparent bg-info text-info-foreground': variant === 'info',
          'text-text': variant === 'outline',
        },
        className
      )}
      {...props}
    />
  )
}

export { Badge }
