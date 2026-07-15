import React from 'react'
import { PageHeader } from '../../shared/components/PageHeader'
import { ContentContainer } from '../../shared/components/ContentContainer'
import { Card } from '../../shared/ui/Card'

export const ObservabilityPage: React.FC = () => {
  const metricsList = [
    { name: "linkforge_http_requests_total", type: "Counter", desc: "Monitors HTTP traffic grouped by route path and status code." },
    { name: "linkforge_http_request_duration_seconds", type: "Histogram", desc: "Tracks request latency distribution profile timing." },
    { name: "linkforge_cache_hits_total", type: "Counter", desc: "Counts read-through cache hits resolved in Redis." },
    { name: "linkforge_cache_misses_total", type: "Counter", desc: "Counts read-through cache misses triggering database lookup." },
    { name: "linkforge_redirects_total", type: "Counter", desc: "Tracks resolved redirections scoped by cache (hit/miss) status." },
    { name: "linkforge_rate_limit_blocked_total", type: "Counter", desc: "Counts denied requests blocked by Token Bucket rules." }
  ]

  return (
    <ContentContainer>
      <PageHeader
        title="Observability"
        description="Core instrumentation metrics exposed to Prometheus scrapes."
      />

      <div className="flex flex-col gap-4">
        <h2 className="text-sm font-semibold text-brand-text-primary select-none">
          Registered Prometheus Metrics
        </h2>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {metricsList.map((metric) => (
            <Card key={metric.name} className="flex flex-col gap-2">
              <div className="flex items-center justify-between">
                <span className="font-mono text-xs font-bold text-brand-accent truncate">
                  {metric.name}
                </span>
                <span className="text-[10px] uppercase font-bold tracking-widest text-brand-text-secondary/60 bg-white/5 border border-brand-border px-2 py-0.5 rounded">
                  {metric.type}
                </span>
              </div>
              <p className="text-xs text-brand-text-secondary leading-normal">
                {metric.desc}
              </p>
            </Card>
          ))}
        </div>
      </div>
    </ContentContainer>
  )
}
