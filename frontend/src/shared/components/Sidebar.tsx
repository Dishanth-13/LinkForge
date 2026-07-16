import React from 'react'
import { AppLogo } from './AppLogo'
import { SidebarSection } from './SidebarSection'
import { SidebarItem } from './SidebarItem'
import { cn } from '../lib/utils'
import { motion } from 'framer-motion'
import {
  LayoutDashboard,
  Link2,
  BarChart3,
  ListTodo,
  Server,
  Activity,
  Users,
  Settings,
  ChevronLeft,
  ChevronRight,
  Building,
  Key
} from 'lucide-react'

interface SidebarProps {
  mobileOpen?: boolean
  onCloseMobile?: () => void
  collapsed: boolean
  onToggleCollapse: () => void
}

export const Sidebar: React.FC<SidebarProps> = ({
  mobileOpen = false,
  onCloseMobile,
  collapsed,
  onToggleCollapse
}) => {
  const navGroups = [
    {
      title: "Workspace",
      items: [
        { to: "/dashboard", label: "Overview", icon: LayoutDashboard }
      ]
    },
    {
      title: "Link Management",
      items: [
        { to: "/links", label: "Links", icon: Link2 }
      ]
    },
    {
      title: "Insights",
      items: [
        { to: "/analytics", label: "Analytics", icon: BarChart3 },
        { to: "/events", label: "Events", icon: ListTodo }
      ]
    },
    {
      title: "Infrastructure",
      items: [
        { to: "/infrastructure", label: "Infrastructure", icon: Server },
        { to: "/observability", label: "Observability", icon: Activity }
      ]
    },
    {
      title: "Settings",
      items: [
        { to: "/team", label: "Team", icon: Users },
        { to: "/settings/api-keys", label: "API Keys", icon: Key },
        { to: "/settings", label: "Settings", icon: Settings }
      ]
    }
  ]

  const sidebarContent = (
    <div className="flex flex-col h-full bg-brand-surface border-r border-brand-border select-none">
      {/* Sidebar Header */}
      <div className="flex items-center justify-between h-14 px-4 border-b border-brand-border shrink-0">
        <AppLogo collapsed={collapsed} />
        {!mobileOpen && (
          <button
            onClick={onToggleCollapse}
            className="p-1 rounded-md text-brand-text-secondary hover:text-brand-text-primary hover:bg-white/5 transition-colors cursor-pointer md:block hidden font-medium"
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
          >
            {collapsed ? (
              <ChevronRight className="w-4 h-4" />
            ) : (
              <ChevronLeft className="w-4 h-4" />
            )}
          </button>
        )}
      </div>

      {/* Navigation Groups */}
      <div className="flex-1 overflow-y-auto px-3 py-4 space-y-2">
        {navGroups.map((group) => (
          <SidebarSection key={group.title} title={group.title} collapsed={collapsed}>
            {group.items.map((item) => (
              <SidebarItem
                key={item.to}
                to={item.to}
                label={item.label}
                icon={item.icon}
                collapsed={collapsed}
                onClick={onCloseMobile}
              />
            ))}
          </SidebarSection>
        ))}
      </div>

      {/* Sidebar Footer */}
      <div className="p-3 border-t border-brand-border bg-black/10 shrink-0">
        <div className={cn("flex items-center gap-3", collapsed ? "justify-center" : "px-1")}>
          <div className="flex items-center justify-center w-8 h-8 rounded-full bg-white/5 border border-brand-border text-brand-text-secondary">
            <Building className="w-4 h-4" />
          </div>
          {!collapsed && (
            <div className="flex flex-col min-w-0 flex-1">
              <span className="text-xs font-semibold text-brand-text-primary truncate">
                Acme Corporation
              </span>
              <span className="text-[10px] text-brand-text-secondary/60 truncate">
                Enterprise Plan
              </span>
            </div>
          )}
        </div>
      </div>
    </div>
  )

  return (
    <>
      {/* Desktop Sidebar */}
      <motion.aside
        animate={{ width: collapsed ? 64 : 240 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="hidden md:block fixed top-0 bottom-0 left-0 z-30 shrink-0 overflow-hidden"
      >
        <div className="h-full w-full">{sidebarContent}</div>
      </motion.aside>

      {/* Mobile Drawer Backdrop */}
      {mobileOpen && (
        <div
          onClick={onCloseMobile}
          className="md:hidden fixed inset-0 z-40 bg-black/60 backdrop-blur-sm transition-opacity duration-300"
        />
      )}

      {/* Mobile Drawer Content */}
      <aside
        className={cn(
          "md:hidden fixed top-0 bottom-0 left-0 z-50 w-60 h-full transition-transform duration-300 ease-in-out transform",
          mobileOpen ? "translate-x-0" : "-translate-x-full"
        )}
      >
        <div className="h-full w-full">{sidebarContent}</div>
      </aside>
    </>
  )
}
