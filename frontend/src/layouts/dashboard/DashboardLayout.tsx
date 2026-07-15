import React, { useEffect, useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Sidebar } from '../../shared/components/Sidebar'
import { Navbar } from '../../shared/components/Navbar'
import { motion } from 'framer-motion'

export const DashboardLayout: React.FC = () => {
  const [mobileOpen, setMobileOpen] = useState(false)
  const [isDesktop, setIsDesktop] = useState(false)
  const [collapsed, setCollapsed] = useState<boolean>(() => {
    const saved = localStorage.getItem("linkforge:sidebar-collapsed")
    return saved === "true"
  })

  useEffect(() => {
    localStorage.setItem("linkforge:sidebar-collapsed", String(collapsed))
  }, [collapsed])

  useEffect(() => {
    const media = window.matchMedia("(min-width: 768px)")
    setIsDesktop(media.matches)
    const listener = (e: MediaQueryListEvent) => setIsDesktop(e.matches)
    media.addEventListener("change", listener)
    return () => media.removeEventListener("change", listener)
  }, [])

  const handleOpenMobile = () => setMobileOpen(true)
  const handleCloseMobile = () => setMobileOpen(false)
  const handleToggleCollapse = () => setCollapsed(!collapsed)

  return (
    <div className="flex w-screen h-screen overflow-hidden bg-brand-bg text-brand-text-primary">
      {/* Sidebar controlled layout */}
      <Sidebar
        mobileOpen={mobileOpen}
        onCloseMobile={handleCloseMobile}
        collapsed={collapsed}
        onToggleCollapse={handleToggleCollapse}
      />

      {/* Main Content Area */}
      <motion.div
        animate={{ paddingLeft: isDesktop ? (collapsed ? 64 : 240) : 0 }}
        transition={{ duration: 0.2, ease: "easeInOut" }}
        className="flex-1 flex flex-col min-w-0 h-full overflow-hidden"
      >
        <Navbar onOpenMobile={handleOpenMobile} />
        <main className="flex-1 flex flex-col overflow-y-auto">
          <Outlet />
        </main>
      </motion.div>
    </div>
  )
}
