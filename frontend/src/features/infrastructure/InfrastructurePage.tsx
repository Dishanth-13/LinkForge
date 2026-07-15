import React from 'react'
import { PageHeader } from '../../shared/components/PageHeader'
import { ContentContainer } from '../../shared/components/ContentContainer'
import { Card } from '../../shared/ui/Card'
import { StatusBadge } from '../../shared/ui/StatusBadge'
import { Database, Zap, Cpu } from 'lucide-react'

export const InfrastructurePage: React.FC = () => {
  return (
    <ContentContainer>
      <PageHeader
        title="Infrastructure"
        description="Backing service configurations and ready probe status checks."
      />

      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <Card className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-md bg-white/5 border border-brand-border text-brand-text-secondary">
                <Database className="w-4.5 h-4.5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-brand-text-primary">PostgreSQL</span>
                <span className="text-[10px] text-brand-text-secondary/50">Relational Database</span>
              </div>
            </div>
            <StatusBadge variant="success">Healthy</StatusBadge>
          </div>
          <div className="border-t border-brand-border pt-3 space-y-1.5 text-xs text-brand-text-secondary">
            <div className="flex justify-between">
              <span>Pool Size Limit</span>
              <span className="font-mono text-brand-text-primary">20 Connections</span>
            </div>
            <div className="flex justify-between">
              <span>Current Latency</span>
              <span className="font-mono text-brand-success">4.2ms</span>
            </div>
          </div>
        </Card>

        <Card className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-md bg-white/5 border border-brand-border text-brand-text-secondary">
                <Zap className="w-4.5 h-4.5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-brand-text-primary">Redis Client</span>
                <span className="text-[10px] text-brand-text-secondary/50">In-Memory Cache</span>
              </div>
            </div>
            <StatusBadge variant="success">Healthy</StatusBadge>
          </div>
          <div className="border-t border-brand-border pt-3 space-y-1.5 text-xs text-brand-text-secondary">
            <div className="flex justify-between">
              <span>Key Prefix Version</span>
              <span className="font-mono text-brand-text-primary">v1</span>
            </div>
            <div className="flex justify-between">
              <span>Socket Timeout</span>
              <span className="font-mono text-brand-text-primary">5.0s</span>
            </div>
          </div>
        </Card>

        <Card className="flex flex-col gap-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              <div className="flex items-center justify-center w-9 h-9 rounded-md bg-white/5 border border-brand-border text-brand-text-secondary">
                <Cpu className="w-4.5 h-4.5" />
              </div>
              <div className="flex flex-col">
                <span className="text-sm font-semibold text-brand-text-primary">Celery Workers</span>
                <span className="text-[10px] text-brand-text-secondary/50">Task Queue Agent</span>
              </div>
            </div>
            <StatusBadge variant="success">Active</StatusBadge>
          </div>
          <div className="border-t border-brand-border pt-3 space-y-1.5 text-xs text-brand-text-secondary">
            <div className="flex justify-between">
              <span>Acknowledgment Mode</span>
              <span className="font-mono text-brand-text-primary">acks_late=True</span>
            </div>
            <div className="flex justify-between">
              <span>Concurrency</span>
              <span className="font-mono text-brand-text-primary">solo</span>
            </div>
          </div>
        </Card>
      </div>
    </ContentContainer>
  )
}
