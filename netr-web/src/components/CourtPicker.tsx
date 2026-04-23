import { useState, useRef, useEffect } from 'react'

export type CourtOption = { id: string; name: string; city: string }

interface Props {
  courts: CourtOption[]
  courtId: string
  onChange: (courtId: string, courtName: string) => void
  placeholder?: string
}

export function CourtPicker({ courts, courtId, onChange, placeholder = 'Search NETR courts…' }: Props) {
  const selected = courts.find(c => c.id === courtId)
  const [query, setQuery] = useState(selected ? `${selected.name} · ${selected.city}` : '')
  const [open, setOpen] = useState(false)
  const containerRef = useRef<HTMLDivElement>(null)

  // Keep display text in sync when external courtId changes
  useEffect(() => {
    const c = courts.find(c => c.id === courtId)
    setQuery(c ? `${c.name} · ${c.city}` : '')
  }, [courtId, courts])

  // Close on outside click
  useEffect(() => {
    function handler(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false)
        // If user typed but didn't select, restore previous selection label
        const c = courts.find(c => c.id === courtId)
        setQuery(c ? `${c.name} · ${c.city}` : '')
      }
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [courtId, courts])

  const filtered = query.trim()
    ? courts.filter(c =>
        `${c.name} ${c.city}`.toLowerCase().includes(query.toLowerCase())
      ).slice(0, 8)
    : courts.slice(0, 8)

  function select(c: CourtOption) {
    setQuery(`${c.name} · ${c.city}`)
    setOpen(false)
    onChange(c.id, c.name)
  }

  function clear() {
    setQuery('')
    setOpen(false)
    onChange('', '')
  }

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          type="text"
          value={query}
          placeholder={placeholder}
          onChange={e => { setQuery(e.target.value); setOpen(true) }}
          onFocus={() => setOpen(true)}
          style={{
            width: '100%',
            background: '#10101A',
            border: '1px solid #2A2A38',
            borderRadius: 8,
            color: '#EEEEF5',
            fontFamily: "'DM Sans', sans-serif",
            fontSize: 14,
            padding: '10px 36px 10px 12px',
            outline: 'none',
            boxSizing: 'border-box',
          }}
        />
        {courtId && (
          <button
            type="button"
            onClick={clear}
            style={{
              position: 'absolute',
              right: 10,
              background: 'none',
              border: 'none',
              color: '#6A6A82',
              cursor: 'pointer',
              fontSize: 16,
              lineHeight: 1,
              padding: 0,
            }}
            title="Clear court"
          >
            ×
          </button>
        )}
      </div>

      {open && filtered.length > 0 && (
        <div style={{
          position: 'absolute',
          top: '100%',
          left: 0,
          right: 0,
          zIndex: 100,
          background: '#1A1A28',
          border: '1px solid #2A2A38',
          borderRadius: 8,
          marginTop: 4,
          overflow: 'hidden',
          boxShadow: '0 8px 24px rgba(0,0,0,0.5)',
        }}>
          {filtered.map(c => (
            <button
              key={c.id}
              type="button"
              onMouseDown={() => select(c)}
              style={{
                display: 'block',
                width: '100%',
                textAlign: 'left',
                padding: '10px 14px',
                background: c.id === courtId ? '#2A2A38' : 'none',
                border: 'none',
                borderBottom: '1px solid #2A2A38',
                color: '#EEEEF5',
                fontFamily: "'DM Sans', sans-serif",
                fontSize: 14,
                cursor: 'pointer',
              }}
              onMouseEnter={e => (e.currentTarget.style.background = '#2A2A38')}
              onMouseLeave={e => (e.currentTarget.style.background = c.id === courtId ? '#2A2A38' : 'none')}
            >
              <span style={{ fontWeight: 600 }}>{c.name}</span>
              <span style={{ color: '#6A6A82', marginLeft: 8, fontSize: 12 }}>{c.city}</span>
            </button>
          ))}
        </div>
      )}
    </div>
  )
}
