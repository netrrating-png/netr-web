export const LEAGUE_FONTS: Record<string, { label: string; family: string; gf: string; preview: string }> = {
  barlow:     { label: 'Barlow Condensed', family: "'Barlow Condensed', sans-serif", gf: 'Barlow+Condensed:wght@700;900',  preview: 'LEAGUE NIGHT' },
  bebas:      { label: 'Bebas Neue',       family: "'Bebas Neue', sans-serif",       gf: 'Bebas+Neue',                     preview: 'LEAGUE NIGHT' },
  oswald:     { label: 'Oswald',           family: "'Oswald', sans-serif",           gf: 'Oswald:wght@600;700',            preview: 'League Night' },
  russo:      { label: 'Russo One',        family: "'Russo One', sans-serif",        gf: 'Russo+One',                      preview: 'League Night' },
  rajdhani:   { label: 'Rajdhani',         family: "'Rajdhani', sans-serif",         gf: 'Rajdhani:wght@600;700',          preview: 'League Night' },
  montserrat: { label: 'Montserrat',       family: "'Montserrat', sans-serif",       gf: 'Montserrat:wght@700;900',        preview: 'League Night' },
  inter:      { label: 'Inter',            family: "'Inter', sans-serif",            gf: 'Inter:wght@700;800',             preview: 'League Night' },
}

export function getFontFamily(key: string | null | undefined): string {
  return LEAGUE_FONTS[key ?? 'barlow']?.family ?? LEAGUE_FONTS.barlow.family
}

export function getFontGF(key: string | null | undefined): string {
  return LEAGUE_FONTS[key ?? 'barlow']?.gf ?? LEAGUE_FONTS.barlow.gf
}
