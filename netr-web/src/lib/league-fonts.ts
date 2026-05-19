export const LEAGUE_FONTS: Record<string, { label: string; family: string; gf: string; preview: string }> = {
  barlow:     { label: 'Barlow Condensed', family: "'Barlow Condensed', sans-serif", gf: 'Barlow+Condensed:wght@700;900',  preview: 'LEAGUE NIGHT' },
  bebas:      { label: 'Bebas Neue',       family: "'Bebas Neue', sans-serif",       gf: 'Bebas+Neue',                     preview: 'LEAGUE NIGHT' },
  oswald:     { label: 'Oswald',           family: "'Oswald', sans-serif",           gf: 'Oswald:wght@600;700',            preview: 'League Night' },
  russo:      { label: 'Russo One',        family: "'Russo One', sans-serif",        gf: 'Russo+One',                      preview: 'League Night' },
  rajdhani:   { label: 'Rajdhani',         family: "'Rajdhani', sans-serif",         gf: 'Rajdhani:wght@600;700',          preview: 'League Night' },
  montserrat: { label: 'Montserrat',       family: "'Montserrat', sans-serif",       gf: 'Montserrat:wght@700;900',        preview: 'League Night' },
  inter:      { label: 'Inter',            family: "'Inter', sans-serif",            gf: 'Inter:wght@700;800',             preview: 'League Night' },
  anton:      { label: 'Anton',            family: "'Anton', sans-serif",            gf: 'Anton',                          preview: 'LEAGUE NIGHT' },
  teko:       { label: 'Teko',             family: "'Teko', sans-serif",             gf: 'Teko:wght@600;700',              preview: 'LEAGUE NIGHT' },
  blackops:   { label: 'Black Ops One',    family: "'Black Ops One', sans-serif",    gf: 'Black+Ops+One',                  preview: 'League Night' },
  orbitron:   { label: 'Orbitron',         family: "'Orbitron', sans-serif",         gf: 'Orbitron:wght@700;900',          preview: 'League Night' },
  fjalla:     { label: 'Fjalla One',       family: "'Fjalla One', sans-serif",       gf: 'Fjalla+One',                     preview: 'League Night' },
  exo2:       { label: 'Exo 2',           family: "'Exo 2', sans-serif",            gf: 'Exo+2:wght@700;900',             preview: 'League Night' },
  saira:      { label: 'Saira Condensed', family: "'Saira Condensed', sans-serif",  gf: 'Saira+Condensed:wght@700;800',  preview: 'LEAGUE NIGHT' },
  changa:     { label: 'Changa',           family: "'Changa', sans-serif",           gf: 'Changa:wght@600;700',            preview: 'League Night' },
}

export function getFontFamily(key: string | null | undefined): string {
  return LEAGUE_FONTS[key ?? 'barlow']?.family ?? LEAGUE_FONTS.barlow.family
}

export function getFontGF(key: string | null | undefined): string {
  return LEAGUE_FONTS[key ?? 'barlow']?.gf ?? LEAGUE_FONTS.barlow.gf
}
