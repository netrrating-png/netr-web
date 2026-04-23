import { useState, useRef, useEffect, useCallback } from 'react'
import { createPortal } from 'react-dom'

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
  const [dropdownRect, setDropdownRect] = useState<{ top: number; left: number; width: number } | null>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const containerRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const c = courts.find(c => c.id === courtId)
    setQuery(c ? `${c.name} · ${c.city}` : '')
  }, [courtId, courts])

  const updateRect = useCallback(() => {
    if (inputRef.current) {
      const r = inputRef.current.getBoundingClientRect()
      setDropdownRect({ top: r.bottom + 4, left: r.left, width: r.width })
    }
  }, [])

  function openDropdown() {
    updateRect()
    setOpen(true)
  }

  useEffect(() => {
    if (!open) return
    function onScroll() { updateRect() }
    function onMouseDown(e: MouseEvent) {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        const target = e.target as Element
        if (target.closest('[data-court-dropdown]')) return
        setOpen(false)
        const c = courts.find(c => c.id === courtId)
        setQuery(c ? `${c.name} · ${c.city}` : '')
      }
    }
    window.addEventListener('scroll', onScroll, true)
    document.addEventListener('mousedown', onMouseDown)
    return () => {
      window.removeEventListener('scroll', onScroll, true)
      document.removeEventListener('mousedown', onMouseDown)
    }
  }, [open, courtId, courts, updateRect])

  const filtered = query.trim()
    ? courts.filter(c => `${c.name} ${c.city}`.toLowerCase().includes(query.toLowerCase()))
    : courts

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

  const dropdown = open && filtered.length > 0 && dropdownRect ? createPortal(
    <div
      data-court-dropdown
      style={{
        position: 'fixed',
        top: dropdownRect.top,
        left: dropdownRect.left,
        width: dropdownRect.width,
        zIndex: 9999,
        background: '#1A1A28',
        border: '1px solid #2A2A38',
        borderRadius: 8,
        overflowY: 'auto',
        maxHeight: 300,
        boxShadow: '0 8px 24px rgba(0,0,0,0.7)',
      }}
    >
      {filtered.map(c => (
        <button
          key={c.id}
          type="button"
          onMouseDown={e => { e.preventDefault(); select(c) }}
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
    </div>,
    document.body
  ) : null

  return (
    <div ref={containerRef} style={{ position: 'relative' }}>
      <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
        <input
          ref={inputRef}
          type="text"
          value={query}
          placeholder={placeholder}
          onChange={e => { setQuery(e.target.value); openDropdown() }}
          onFocus={openDropdown}
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
              fontSize: 18,
              lineHeight: 1,
              padding: 0,
            }}
            title="Clear court"
          >
            ×
          </button>
        )}
      </div>
      {dropdown}
    </div>
  )
}
