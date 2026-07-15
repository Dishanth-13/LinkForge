import React from 'react'
import { Link, useLocation } from 'react-router-dom'
import { SearchButton } from './SearchButton'
import { Avatar } from '../ui/Avatar'
import { Bell, Menu, ChevronRight } from 'lucide-react'

interface NavbarProps {
  onOpenMobile?: () => void
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenMobile }) => {
  const location = useLocation()
  const pathParts = location.pathname.split('/').filter(Boolean)

  const formatBreadcrumb = (part: string) => {
    return part.charAt(0).toUpperCase() + part.slice(1)
  }

  return (
    <header className="sticky top-0 z-20 flex items-center justify-between h-14 px-4 border-b border-brand-border bg-brand-bg/80 backdrop-blur-md select-none">
      {/* Breadcrumb section */}
      <div className="flex items-center gap-2">
        <button
          onClick={onOpenMobile}
          className="md:hidden p-1.5 rounded-md text-brand-text-secondary hover:text-brand-text-primary hover:bg-white/5 transition-colors cursor-pointer"
          aria-label="Open navigation menu"
        >
          <Menu className="w-4.5 h-4.5" />
        </button>

        <nav className="flex items-center gap-1.5 text-xs font-medium text-brand-text-secondary" aria-label="Breadcrumb">
          <Link to="/" className="hover:text-brand-text-primary transition-colors">
            Workspace
          </Link>
          {pathParts.map((part, index) => {
            const path = `/${pathParts.slice(0, index + 1).join('/')}`
            const isLast = index === pathParts.length - 1

            return (
              <React.Fragment key={path}>
                <ChevronRight className="w-3.5 h-3.5 text-brand-text-secondary/40 shrink-0" />
                {isLast ? (
                  <span className="text-brand-text-primary font-semibold select-none">
                    {formatBreadcrumb(part)}
                  </span>
                ) : (
                  <Link to={path} className="hover:text-brand-text-primary transition-colors">
                    {formatBreadcrumb(part)}
                  </Link>
                )}
              </React.Fragment>
            )
          })}
        </nav>
      </div>

      {/* Right actions */}
      <div className="flex items-center gap-4">
        <SearchButton className="hidden sm:flex" />

        <div className="flex items-center gap-1.5">
          <button
            className="p-2 rounded-md text-brand-text-secondary hover:text-brand-text-primary hover:bg-white/5 transition-all cursor-pointer relative"
            aria-label="Notifications"
          >
            <Bell className="w-4 h-4" />
            <span className="absolute top-2 right-2 w-1.5 h-1.5 rounded-full bg-brand-accent animate-pulse" />
          </button>

          <div className="pl-1 border-l border-brand-border h-4 hidden xs:block" />

          <button
            className="flex items-center gap-2 pl-1 cursor-pointer group focus:outline-none"
            aria-label="User Profile"
          >
            <Avatar initials="JD" size="sm" className="group-hover:opacity-90 transition-opacity" />
          </button>
        </div>
      </div>
    </header>
  )
}
