import React from 'react'
import { TrendingUp } from 'lucide-react'

/**
 * TrafficChart — Traffic Overview section.
 *
 * No time-series API exists on the backend. This component renders a polished
 * empty state that clearly communicates the absence of data without fabricating
 * any values. The SVG chart skeleton visually implies what will be here once
 * a time-series endpoint is available.
 */
export const TrafficChart: React.FC = () => {
  return (
    <div className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <div className="flex flex-col gap-0.5">
          <h2 className="text-xs font-bold text-brand-text-secondary uppercase tracking-widest select-none">
            Traffic Overview
          </h2>
          <p className="text-[11px] text-brand-text-secondary/50">
            Redirect events over time
          </p>
        </div>
      </div>

      {/* Chart placeholder */}
      <div className="relative flex flex-col items-center justify-center rounded-lg border border-dashed border-brand-border bg-white/[0.01] h-52 overflow-hidden">
        {/* SVG grid / axes skeleton for visual cue */}
        <svg
          className="absolute inset-0 w-full h-full opacity-[0.06]"
          aria-hidden="true"
          preserveAspectRatio="none"
        >
          {/* Y-axis grid lines */}
          {[0.25, 0.5, 0.75].map((y) => (
            <line
              key={y}
              x1="0"
              y1={`${y * 100}%`}
              x2="100%"
              y2={`${y * 100}%`}
              stroke="white"
              strokeWidth="1"
              strokeDasharray="4 4"
            />
          ))}
          {/* Flat baseline */}
          <line
            x1="0"
            y1="80%"
            x2="100%"
            y2="80%"
            stroke="white"
            strokeWidth="1"
          />
          {/* Ghost chart line */}
          <polyline
            points="0,200 80,200 160,200 240,200 320,200 400,200 480,200 560,200 640,200 720,200 800,200"
            fill="none"
            stroke="white"
            strokeWidth="1.5"
            strokeDasharray="6 4"
          />
        </svg>

        {/* Empty state text */}
        <div className="flex flex-col items-center gap-2 z-10">
          <div className="flex items-center justify-center w-10 h-10 rounded-full bg-white/5 border border-brand-border text-brand-text-secondary/60">
            <TrendingUp className="w-5 h-5" />
          </div>
          <p className="text-xs font-semibold text-brand-text-primary">
            No historical data yet
          </p>
          <p className="text-[11px] text-brand-text-secondary/60 text-center max-w-[200px]">
            Time-series traffic data will appear once a stats endpoint is available.
          </p>
        </div>
      </div>
    </div>
  )
}
