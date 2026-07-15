import React from 'react'
import { cn } from '../lib/utils'
import { Inbox } from 'lucide-react'

interface EmptyStateProps {
  title: string
  description?: string
  action?: React.ReactNode
  icon?: React.ReactNode
  className?: string
}

export const EmptyState: React.FC<EmptyStateProps> = ({
  title,
  description,
  action,
  icon,
  className
}) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 rounded-lg border border-dashed border-brand-border bg-white/[0.01] select-none min-h-[320px]",
        className
      )}
    >
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-white/5 border border-brand-border text-brand-text-secondary/80 mb-4 shrink-0">
        {icon || <Inbox className="w-5 h-5" />}
      </div>
      <h3 className="text-sm font-semibold text-brand-text-primary">
        {title}
      </h3>
      {description && (
        <p className="mt-1 text-xs text-brand-text-secondary max-w-[280px]">
          {description}
        </p>
      )}
      {action && (
        <div className="mt-6">
          {action}
        </div>
      )}
    </div>
  )
}
