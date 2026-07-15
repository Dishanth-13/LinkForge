import React from 'react'
import { PageHeader } from '../../shared/components/PageHeader'
import { ContentContainer } from '../../shared/components/ContentContainer'
import { EmptyState } from '../../shared/components/EmptyState'
import { Users, UserPlus } from 'lucide-react'

export const TeamPage: React.FC = () => {
  return (
    <ContentContainer>
      <PageHeader
        title="Team Members"
        description="Invite and manage users belonging to this organization."
        actions={
          <button className="flex items-center gap-1.5 px-3 py-1.5 rounded-md bg-brand-accent hover:bg-brand-accent/90 text-white text-xs font-semibold shadow-md shadow-brand-accent/25 hover:shadow-lg transition-all cursor-pointer">
            <UserPlus className="w-3.5 h-3.5" />
            <span>Add Member</span>
          </button>
        }
      />

      <EmptyState
        title="No members added"
        description="Collaborate with other developers by inviting them to join your organization scope."
        icon={<Users className="w-5 h-5" />}
        action={
          <button className="flex items-center gap-1.5 px-4 py-2 rounded-md bg-brand-accent hover:bg-brand-accent/90 text-white text-xs font-semibold shadow-md shadow-brand-accent/25 hover:shadow-lg transition-all cursor-pointer">
            <UserPlus className="w-4 h-4" />
            <span>Invite Team Members</span>
          </button>
        }
      />
    </ContentContainer>
  )
}
