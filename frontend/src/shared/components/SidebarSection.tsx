import React from 'react'

interface SidebarSectionProps {
  title: string
  collapsed?: boolean
  children: React.ReactNode
}

export const SidebarSection: React.FC<SidebarSectionProps> = ({
  title,
  collapsed = false,
  children
}) => {
  return (
    <div className="flex flex-col gap-1.5 mt-5 first:mt-0">
      {!collapsed && (
        <span className="px-3 text-[10px] font-bold tracking-widest text-brand-text-secondary/50 uppercase select-none">
          {title}
        </span>
      )}
      <div className="flex flex-col gap-0.5">
        {children}
      </div>
    </div>
  )
}
