import React from 'react'
import { useNavigate } from 'react-router-dom'
import { Link2, KeyRound } from 'lucide-react'

function getGreeting(): string {
  const hour = new Date().getHours()
  if (hour < 12) return 'Good morning'
  if (hour < 17) return 'Good afternoon'
  return 'Good evening'
}

interface DashboardGreetingProps {
  orgName?: string
}

export const DashboardGreeting: React.FC<DashboardGreetingProps> = ({
  orgName = 'Your Workspace',
}) => {
  const navigate = useNavigate()

  return (
    <div className="flex flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
      {/* Left — Greeting text */}
      <div className="flex flex-col gap-1">
        <p className="text-xs font-medium text-brand-text-secondary tracking-wide uppercase select-none">
          {getGreeting()}
        </p>
        <h1 className="text-2xl font-bold tracking-tight text-brand-text-primary leading-tight">
          {orgName}
        </h1>
        <p className="text-sm text-brand-text-secondary mt-0.5">
          Everything is operating normally.
        </p>
      </div>

      {/* Right — Quick Actions */}
      <div className="flex items-center gap-2 shrink-0">
        <button
          onClick={() => navigate('/links')}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-accent hover:bg-brand-accent/90 text-white text-xs font-semibold shadow-sm shadow-brand-accent/20 hover:shadow-md hover:shadow-brand-accent/25 transition-all cursor-pointer select-none"
        >
          <Link2 className="w-3.5 h-3.5" />
          Create Link
        </button>
        <button
          disabled
          title="API key generation is not yet implemented"
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-white/5 border border-brand-border text-brand-text-secondary text-xs font-semibold opacity-50 cursor-not-allowed select-none"
        >
          <KeyRound className="w-3.5 h-3.5" />
          Generate API Key
        </button>
      </div>
    </div>
  )
}
