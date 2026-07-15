import React, { useState } from 'react'
import { cn } from '../lib/utils'

interface AvatarProps extends React.HTMLAttributes<HTMLDivElement> {
  src?: string
  alt?: string
  initials?: string
  size?: 'sm' | 'md' | 'lg'
}

export const Avatar: React.FC<AvatarProps> = ({
  src,
  alt = '',
  initials = '',
  size = 'md',
  className,
  ...props
}) => {
  const [error, setError] = useState(false)

  const sizeStyles = {
    sm: "w-7 h-7 text-xs",
    md: "w-9 h-9 text-sm",
    lg: "w-12 h-12 text-base"
  }

  return (
    <div
      className={cn(
        "relative flex items-center justify-center rounded-full overflow-hidden select-none shrink-0 border border-brand-border bg-brand-surface font-semibold text-brand-text-primary",
        sizeStyles[size],
        className
      )}
      {...props}
    >
      {src && !error ? (
        <img
          src={src}
          alt={alt}
          onError={() => setError(true)}
          className="w-full h-full object-cover"
        />
      ) : (
        <span className="tracking-wider uppercase">
          {initials.slice(0, 2)}
        </span>
      )}
    </div>
  )
}
