import React from 'react'

export function netrScoreColor(s: number): string {
  if (s >= 9.5) return '#C40010'
  if (s >= 9.0) return '#FF3B30'
  if (s >= 8.0) return '#FF7A00'
  if (s >= 7.0) return '#FFC247'
  if (s >= 6.0) return '#39FF14'
  if (s >= 5.0) return '#2ECC71'
  if (s >= 4.0) return '#2DA8FF'
  if (s >= 3.0) return '#7B9FFF'
  return '#9B8BFF'
}

// fontSize scales the badge to match the surrounding player name size.
// onInfoClick is optional — pass a handler to make the badge clickable.
export function NetrBadge({
  score,
  fontSize = 12,
  onInfoClick,
}: {
  score: number | null | undefined
  fontSize?: number
  onInfoClick?: () => void
}) {
  if (score == null) return null
  const c = netrScoreColor(score)
  const pad = fontSize <= 10 ? '2px 5px' : '3px 8px'
  return (
    <span
      onClick={e => { e.stopPropagation(); onInfoClick?.() }}
      style={{
        display: 'inline-flex',
        alignItems: 'center',
        gap: 3,
        background: `${c}1F`,
        border: `1px solid ${c}66`,
        borderRadius: 5,
        color: c,
        fontFamily: "'DM Mono',monospace",
        fontSize,
        fontWeight: 700,
        padding: pad,
        letterSpacing: 0.4,
        flexShrink: 0,
        cursor: onInfoClick ? 'pointer' : 'default',
        userSelect: 'none',
        lineHeight: 1.4,
        boxShadow: `0 0 8px ${c}22`,
      }}
    >
      <span style={{ fontSize: fontSize * 0.75, letterSpacing: 1.5, opacity: 0.75 }}>NETR</span>
      {score.toFixed(2)}
    </span>
  )
}
