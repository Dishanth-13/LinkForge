import React from 'react'
import { NavLink } from 'react-router-dom'
import { cn } from '../lib/utils'
import type { LucideIcon } from 'lucide-react'

interface SidebarItemProps {
  to: string
  label: string
  icon: LucideIcon
  collapsed?: boolean
  onClick?: () => void
}

export const SidebarItem: React.FC<SidebarItemProps> = ({
  to,
  label,
  icon: Icon,
  collapsed = false,
  onClick
}) => {
  return (
    <NavLink
      to={to}
      onClick={onClick}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 px-3 py-2 rounded-md text-sm font-medium transition-all duration-150 select-none group",
          isActive
            ? "bg-white/5 text-brand-text-primary border-l-2 border-brand-accent rounded-l-none pl-2.5"
            : "text-brand-text-secondary hover:text-brand-text-primary hover:bg-white/[0.02]"
        )
      }
    >
      <Icon className="w-4 h-4 shrink-0 transition-transform duration-200 group-hover:scale-105" />
      {!collapsed && (
        <span className="truncate">{label}</span>
      )}
    </NavLink>
  )
}
