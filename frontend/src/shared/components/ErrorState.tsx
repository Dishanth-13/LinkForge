import React from 'react'
import { cn } from '../lib/utils'
import { AlertCircle } from 'lucide-react'

interface ErrorStateProps {
  title?: string
  message: string
  retryAction?: () => void
  retryText?: string
  className?: string
}

export const ErrorState: React.FC<ErrorStateProps> = ({
  title = "An error occurred",
  message,
  retryAction,
  retryText = "Try again",
  className
}) => {
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center text-center p-8 rounded-lg border border-brand-danger/20 bg-brand-danger/5 select-none min-h-[280px]",
        className
      )}
    >
      <div className="flex items-center justify-center w-12 h-12 rounded-full bg-brand-danger/10 border border-brand-danger/20 text-brand-danger mb-4 shrink-0">
        <AlertCircle className="w-5 h-5" />
      </div>
      <h3 className="text-sm font-semibold text-brand-text-primary">
        {title}
      </h3>
      <p className="mt-1 text-xs text-brand-text-secondary max-w-[320px]">
        {message}
      </p>
      {retryAction && (
        <button
          onClick={retryAction}
          className="mt-6 px-4 py-2 rounded-md bg-brand-accent hover:bg-brand-accent/90 text-white text-xs font-semibold shadow-md shadow-brand-accent/25 hover:shadow-lg transition-all cursor-pointer"
        >
          {retryText}
        </button>
      )}
    </div>
  )
}
