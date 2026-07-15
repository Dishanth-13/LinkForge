import React from 'react'
import { PageHeader } from '../../shared/components/PageHeader'
import { ContentContainer } from '../../shared/components/ContentContainer'
import { Card } from '../../shared/ui/Card'
import { Settings, Shield, Building2, User } from 'lucide-react'

export const SettingsPage: React.FC = () => {
  return (
    <ContentContainer>
      <PageHeader
        title="Settings"
        description="Configure account details, organization parameters, and API configuration."
      />

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6 select-none">
        <Card className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-md bg-white/5 border border-brand-border text-brand-text-secondary">
              <User className="w-4.5 h-4.5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-brand-text-primary">Profile Info</span>
              <span className="text-[10px] text-brand-text-secondary/50">Personal account settings</span>
            </div>
          </div>
          <div className="border-t border-brand-border pt-4 text-xs text-brand-text-secondary">
            Profile updates and password change actions are disabled during the foundation phase.
          </div>
        </Card>

        <Card className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-md bg-white/5 border border-brand-border text-brand-text-secondary">
              <Building2 className="w-4.5 h-4.5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-brand-text-primary">Organization</span>
              <span className="text-[10px] text-brand-text-secondary/50">Workspace parameters</span>
            </div>
          </div>
          <div className="border-t border-brand-border pt-4 text-xs text-brand-text-secondary">
            Organization plan boundaries and brand names configuration are disabled.
          </div>
        </Card>

        <Card className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-md bg-white/5 border border-brand-border text-brand-text-secondary">
              <Shield className="w-4.5 h-4.5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-brand-text-primary">Security & Auth</span>
              <span className="text-[10px] text-brand-text-secondary/50">Session keys rotation policies</span>
            </div>
          </div>
          <div className="border-t border-brand-border pt-4 text-xs text-brand-text-secondary">
            Sliding Token Rotation and refresh token expiry durations can be modified here.
          </div>
        </Card>

        <Card className="flex flex-col gap-4">
          <div className="flex items-center gap-3">
            <div className="flex items-center justify-center w-9 h-9 rounded-md bg-white/5 border border-brand-border text-brand-text-secondary">
              <Settings className="w-4.5 h-4.5" />
            </div>
            <div className="flex flex-col">
              <span className="text-sm font-semibold text-brand-text-primary">Developer APIs</span>
              <span className="text-[10px] text-brand-text-secondary/50">Programmatic access scopes</span>
            </div>
          </div>
          <div className="border-t border-brand-border pt-4 text-xs text-brand-text-secondary">
            API Keys generation and role credentials verification (Milestone 8) will be loaded here.
          </div>
        </Card>
      </div>
    </ContentContainer>
  )
}
