import React from 'react'
import { cn } from '../lib/utils'

interface StatusBadgeProps extends React.HTMLAttributes<HTMLSpanElement> {
  variant?: 'success' | 'warning' | 'danger' | 'neutral'
  children: React.ReactNode
}

export const StatusBadge: React.FC<StatusBadgeProps> = ({
  variant = 'neutral',
  children,
  className,
  ...props
}) => {
  const styles = {
    success: "bg-brand-success/10 text-brand-success border-brand-success/20",
    warning: "bg-brand-warning/10 text-brand-warning border-brand-warning/20",
    danger: "bg-brand-danger/10 text-brand-danger border-brand-danger/20",
    neutral: "bg-white/5 text-brand-text-secondary border-brand-border"
  }

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-medium border leading-none tracking-wide select-none",
        styles[variant],
        className
      )}
      {...props}
    >
      <span className="w-1.5 h-1.5 rounded-full bg-current opacity-80" />
      {children}
    </span>
  )
}
