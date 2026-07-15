import React, { useState } from 'react'
import { Copy, Check } from 'lucide-react'
import { cn } from '../lib/utils'

interface CopyButtonProps {
  text: string
  label?: string
  className?: string
}

export const CopyButton: React.FC<CopyButtonProps> = ({ text, label, className }) => {
  const [copied, setCopied] = useState(false)

  const handleCopy = async (e: React.MouseEvent) => {
    e.stopPropagation()
    try {
      await navigator.clipboard.writeText(text)
      setCopied(true)
      setTimeout(() => setCopied(false), 1800)
    } catch {
      // Clipboard not available in insecure context
    }
  }

  return (
    <button
      onClick={handleCopy}
      title={`Copy ${text}`}
      className={cn(
        'inline-flex items-center gap-1.5 text-brand-text-secondary hover:text-brand-text-primary transition-colors cursor-pointer select-none',
        className
      )}
    >
      {copied ? (
        <Check className="w-3.5 h-3.5 text-brand-success shrink-0" />
      ) : (
        <Copy className="w-3.5 h-3.5 shrink-0" />
      )}
      {label && <span className="text-xs">{copied ? 'Copied!' : label}</span>}
    </button>
  )
}
