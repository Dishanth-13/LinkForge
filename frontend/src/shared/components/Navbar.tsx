import React, { useEffect, useMemo, useRef, useState } from 'react'
import { Link, useLocation, useNavigate } from 'react-router-dom'
import { SearchButton } from './SearchButton'
import { Avatar } from '../ui/Avatar'
import { Bell, Menu, ChevronRight, LogOut, ChevronDown, ShieldUser } from 'lucide-react'
import { motion, AnimatePresence } from 'framer-motion'
import { useAuth } from '../../features/auth/AuthContext'
import { useToast } from '../ui/Toast'

interface NavbarProps {
  onOpenMobile?: () => void
}

export const Navbar: React.FC<NavbarProps> = ({ onOpenMobile }) => {
  const location = useLocation()
  const navigate = useNavigate()
  const { currentUser, logout } = useAuth()
  const { toast } = useToast()
  const [menuOpen, setMenuOpen] = useState(false)
  const menuRef = useRef<HTMLDivElement | null>(null)
  const pathParts = location.pathname.split('/').filter(Boolean)
  const initials = useMemo(() => {
    const source = currentUser?.email?.split('@')[0] ?? 'User'
    const parts = source.split(/[._-]+/).filter(Boolean)
    const combined = parts.length > 1 ? `${parts[0][0]}${parts[1][0]}` : source.slice(0, 2)
    return combined.toUpperCase()
  }, [currentUser])

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setMenuOpen(false)
      }
    }

    const handleEscape = (event: KeyboardEvent) => {
      if (event.key === 'Escape') setMenuOpen(false)
    }

    window.addEventListener('mousedown', handleClickOutside)
    window.addEventListener('keydown', handleEscape)

    return () => {
      window.removeEventListener('mousedown', handleClickOutside)
      window.removeEventListener('keydown', handleEscape)
    }
  }, [])

  const handleLogout = async () => {
    setMenuOpen(false)
    await logout()
    toast('Signed out successfully.', 'success')
    navigate('/login', { replace: true })
  }

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

          <div className="relative" ref={menuRef}>
            <button
              onClick={() => setMenuOpen((value) => !value)}
              className="flex items-center gap-2 pl-1 cursor-pointer group focus:outline-none"
              aria-label="User profile menu"
            >
              <Avatar initials={initials} size="sm" className="group-hover:opacity-90 transition-opacity" />
              <ChevronDown className="w-3.5 h-3.5 text-brand-text-secondary/60 hidden sm:block" />
            </button>

            <AnimatePresence>
              {menuOpen && (
                <motion.div
                  initial={{ opacity: 0, y: 6, scale: 0.98 }}
                  animate={{ opacity: 1, y: 0, scale: 1 }}
                  exit={{ opacity: 0, y: 4, scale: 0.98 }}
                  transition={{ duration: 0.14 }}
                  className="absolute right-0 top-full mt-2 w-64 rounded-xl border border-brand-border bg-brand-surface shadow-2xl shadow-black/50 overflow-hidden"
                >
                  <div className="px-4 py-3 border-b border-brand-border bg-white/[0.02]">
                    <div className="flex items-center gap-3">
                      <Avatar initials={initials} size="sm" />
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-semibold text-brand-text-primary truncate">
                          {currentUser?.email ?? 'Signed in user'}
                        </p>
                        <p className="text-[11px] text-brand-text-secondary truncate">
                          {currentUser?.role ?? 'member'} · {currentUser?.organization_id?.slice(0, 8) ?? 'workspace'}
                        </p>
                      </div>
                    </div>
                  </div>

                  <div className="p-2">
                    <button
                      onClick={handleLogout}
                      className="w-full flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-medium text-brand-text-secondary hover:text-brand-text-primary hover:bg-white/5 transition-colors"
                    >
                      <LogOut className="w-3.5 h-3.5" />
                      Logout
                    </button>
                  </div>

                  <div className="px-4 py-2 border-t border-brand-border bg-white/[0.015] text-[10px] text-brand-text-secondary/60 flex items-center gap-1.5">
                    <ShieldUser className="w-3 h-3" />
                    Protected session
                  </div>
                </motion.div>
              )}
            </AnimatePresence>
          </div>
        </div>
      </div>
    </header>
  )
}
