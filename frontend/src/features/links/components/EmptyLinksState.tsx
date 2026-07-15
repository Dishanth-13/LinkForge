import React from 'react'
import { Link2, Plus } from 'lucide-react'

interface EmptyLinksStateProps {
  onCreateClick: () => void
}

export const EmptyLinksState: React.FC<EmptyLinksStateProps> = ({ onCreateClick }) => (
  <div className="flex flex-col items-center justify-center text-center rounded-lg border border-dashed border-brand-border bg-white/[0.01] py-20 px-8 select-none">
    <div className="flex items-center justify-center w-14 h-14 rounded-full bg-white/5 border border-brand-border text-brand-text-secondary/60 mb-5">
      <Link2 className="w-6 h-6" />
    </div>
    <h3 className="text-sm font-bold text-brand-text-primary">No links created yet</h3>
    <p className="mt-1.5 text-xs text-brand-text-secondary max-w-[280px] leading-relaxed">
      Create your first branded short link to begin collecting redirect analytics.
    </p>
    <button
      onClick={onCreateClick}
      className="mt-6 flex items-center gap-1.5 px-4 py-2 rounded-md bg-brand-accent hover:bg-brand-accent/90 text-white text-xs font-semibold shadow-md shadow-brand-accent/20 hover:shadow-lg hover:shadow-brand-accent/25 transition-all cursor-pointer"
    >
      <Plus className="w-4 h-4" />
      Create Link
    </button>
  </div>
)
