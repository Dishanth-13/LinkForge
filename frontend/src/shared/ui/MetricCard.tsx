import React from 'react'
import { Card } from './Card'
import { cn } from '../lib/utils'
import { ArrowUpRight, ArrowDownRight } from 'lucide-react'

interface MetricCardProps extends React.HTMLAttributes<HTMLDivElement> {
  title: string
  value: string | number
  change?: string | number
  changeType?: 'increase' | 'decrease' | 'neutral'
  icon?: React.ReactNode
  loading?: boolean
}

export const MetricCard: React.FC<MetricCardProps> = ({
  title,
  value,
  change,
  changeType = 'neutral',
  icon,
  loading = false,
  className,
  ...props
}) => {
  return (
    <Card className={cn("flex flex-col gap-2 p-5", className)} {...props}>
      <div className="flex items-center justify-between text-xs font-medium text-brand-text-secondary">
        <span>{title}</span>
        {icon && <div className="text-brand-text-secondary/80">{icon}</div>}
      </div>

      {loading ? (
        <div className="flex flex-col gap-2 mt-1">
          <div className="h-8 w-24 bg-white/5 animate-pulse rounded-md" />
          {change && <div className="h-4 w-16 bg-white/5 animate-pulse rounded-md" />}
        </div>
      ) : (
        <div className="flex flex-col mt-1">
          <span className="font-mono text-2xl font-bold text-brand-text-primary tracking-tight">
            {value}
          </span>
          {change !== undefined && (
            <div className="flex items-center gap-1 mt-1 text-xs font-medium">
              {changeType === 'increase' && (
                <span className="flex items-center gap-0.5 text-brand-success">
                  <ArrowUpRight className="w-3.5 h-3.5" />
                  {change}
                </span>
              )}
              {changeType === 'decrease' && (
                <span className="flex items-center gap-0.5 text-brand-danger">
                  <ArrowDownRight className="w-3.5 h-3.5" />
                  {change}
                </span>
              )}
              {changeType === 'neutral' && (
                <span className="text-brand-text-secondary">
                  {change}
                </span>
              )}
            </div>
          )}
        </div>
      )}
    </Card>
  )
}
