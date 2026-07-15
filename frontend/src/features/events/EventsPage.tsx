import React from 'react'
import { PageHeader } from '../../shared/components/PageHeader'
import { ContentContainer } from '../../shared/components/ContentContainer'
import { EmptyState } from '../../shared/components/EmptyState'
import { ListTodo } from 'lucide-react'

export const EventsPage: React.FC = () => {
  return (
    <ContentContainer>
      <PageHeader
        title="Events Log"
        description="Real-time timeline of incoming redirection click events."
      />

      <EmptyState
        title="Events Log Empty"
        description="Audit events and client redirection hits will populate this live stream feed in real-time."
        icon={<ListTodo className="w-5 h-5" />}
      />
    </ContentContainer>
  )
}
