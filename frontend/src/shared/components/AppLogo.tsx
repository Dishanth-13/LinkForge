import React from 'react'
import { cn } from '../lib/utils'
import { Link } from 'react-router-dom'
import { Link2 } from 'lucide-react'

interface AppLogoProps {
  className?: string
  collapsed?: boolean
}

export const AppLogo: React.FC<AppLogoProps> = ({ className, collapsed = false }) => {
  return (
    <Link
      to="/"
      className={cn("flex items-center gap-2.5 font-semibold text-brand-text-primary tracking-tight transition-opacity hover:opacity-90 select-none", className)}
    >
      <div className="flex items-center justify-center w-7 h-7 bg-brand-accent rounded-md text-white shadow-md shadow-brand-accent/25">
        <Link2 className="w-4 h-4 transform -rotate-45" />
      </div>
      {!collapsed && (
        <span className="text-base font-bold tracking-tight">
          Link<span className="text-brand-accent">Forge</span>
        </span>
      )}
    </Link>
  )
}
