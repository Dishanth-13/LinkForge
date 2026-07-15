import React from 'react'
import { cn } from '../lib/utils'

interface PageHeaderProps {
  title: string
  description?: string
  actions?: React.ReactNode
  className?: string
}

export const PageHeader: React.FC<PageHeaderProps> = ({
  title,
  description,
  actions,
  className
}) => {
  return (
    <div className={cn("flex flex-col gap-1 md:flex-row md:items-center md:justify-between pb-5 border-b border-brand-border select-none", className)}>
      <div className="flex flex-col gap-1">
        <h1 className="text-xl font-bold tracking-tight text-brand-text-primary">
          {title}
        </h1>
        {description && (
          <p className="text-xs text-brand-text-secondary">
            {description}
          </p>
        )}
      </div>
      {actions && (
        <div className="flex items-center gap-2 mt-3 md:mt-0 shrink-0">
          {actions}
        </div>
      )}
    </div>
  )
}
