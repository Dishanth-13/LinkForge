import React from 'react'
import { PageHeader } from '../../shared/components/PageHeader'
import { ContentContainer } from '../../shared/components/ContentContainer'
import { EmptyState } from '../../shared/components/EmptyState'
import { BarChart3 } from 'lucide-react'

export const AnalyticsPage: React.FC = () => {
  return (
    <ContentContainer>
      <PageHeader
        title="Analytics"
        description="Detailed link redirection analysis, browser distributions, and operating system metrics."
      />

      <EmptyState
        title="No Click Analytics Data"
        description="Visual charts for browsers, devices, referrers, and geo-locations will appear once redirection events occur."
        icon={<BarChart3 className="w-5 h-5" />}
      />
    </ContentContainer>
  )
}
