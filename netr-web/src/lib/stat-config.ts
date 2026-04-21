export type StatKey = 'pts' | 'reb' | 'ast' | '3pm' | 'stl' | 'blk' | 'tov' | 'ftm' | 'fg%' | '3p%' | 'ft%'

export const STAT_DEFS: { key: StatKey; label: string; fullLabel: string; isPercent: boolean }[] = [
  { key: 'pts', label: 'PTS', fullLabel: 'Points',           isPercent: false },
  { key: 'reb', label: 'REB', fullLabel: 'Rebounds',         isPercent: false },
  { key: 'ast', label: 'AST', fullLabel: 'Assists',          isPercent: false },
  { key: '3pm', label: '3PM', fullLabel: '3-Pointers Made',  isPercent: false },
  { key: 'stl', label: 'STL', fullLabel: 'Steals',           isPercent: false },
  { key: 'blk', label: 'BLK', fullLabel: 'Blocks',           isPercent: false },
  { key: 'tov', label: 'TOV', fullLabel: 'Turnovers',        isPercent: false },
  { key: 'ftm', label: 'FTM', fullLabel: 'Free Throws Made', isPercent: false },
  { key: 'fg%', label: 'FG%', fullLabel: 'Field Goal %',     isPercent: true  },
  { key: '3p%', label: '3P%', fullLabel: '3-Point %',        isPercent: true  },
  { key: 'ft%', label: 'FT%', fullLabel: 'Free Throw %',     isPercent: true  },
]

export const DEFAULT_ENABLED_STATS: StatKey[] = [
  'pts','reb','ast','3pm','stl','blk','tov','ftm','fg%','3p%','ft%',
]

// Which raw DB columns each stat key requires in the box score input
export const STAT_INPUT_COLS: {
  key: string
  label: string
  showWhen: StatKey[]
}[] = [
  { key: 'points',                   label: 'PTS', showWhen: ['pts'] },
  { key: 'rebounds',                 label: 'REB', showWhen: ['reb'] },
  { key: 'assists',                  label: 'AST', showWhen: ['ast'] },
  { key: 'three_pointers_made',      label: '3PM', showWhen: ['3pm', '3p%'] },
  { key: 'three_pointers_attempted', label: '3PA', showWhen: ['3p%'] },
  { key: 'field_goals_made',         label: 'FGM', showWhen: ['fg%'] },
  { key: 'field_goals_attempted',    label: 'FGA', showWhen: ['fg%'] },
  { key: 'steals',                   label: 'STL', showWhen: ['stl'] },
  { key: 'blocks',                   label: 'BLK', showWhen: ['blk'] },
  { key: 'turnovers',                label: 'TOV', showWhen: ['tov'] },
  { key: 'free_throws_made',         label: 'FTM', showWhen: ['ftm', 'ft%'] },
  { key: 'free_throws_attempted',    label: 'FTA', showWhen: ['ft%'] },
]

export type AggStat = {
  points: number
  rebounds: number
  assists: number
  steals: number
  blocks: number
  turnovers: number
  three_pointers_made: number
  three_pointers_attempted: number
  field_goals_made: number
  field_goals_attempted: number
  free_throws_made: number
  free_throws_attempted: number
}

export function emptyAgg(): AggStat {
  return { points:0, rebounds:0, assists:0, steals:0, blocks:0, turnovers:0,
           three_pointers_made:0, three_pointers_attempted:0,
           field_goals_made:0, field_goals_attempted:0,
           free_throws_made:0, free_throws_attempted:0 }
}

export function getStatValue(agg: AggStat, gp: number, key: StatKey): number {
  if (gp === 0) return 0
  switch (key) {
    case 'pts':  return agg.points / gp
    case 'reb':  return agg.rebounds / gp
    case 'ast':  return agg.assists / gp
    case '3pm':  return agg.three_pointers_made / gp
    case 'stl':  return agg.steals / gp
    case 'blk':  return agg.blocks / gp
    case 'tov':  return agg.turnovers / gp
    case 'ftm':  return agg.free_throws_made / gp
    case 'fg%':  return agg.field_goals_attempted > 0 ? agg.field_goals_made / agg.field_goals_attempted : 0
    case '3p%':  return agg.three_pointers_attempted > 0 ? agg.three_pointers_made / agg.three_pointers_attempted : 0
    case 'ft%':  return agg.free_throws_attempted > 0 ? agg.free_throws_made / agg.free_throws_attempted : 0
  }
}

export function fmtStat(value: number, key: StatKey): string {
  const def = STAT_DEFS.find(d => d.key === key)!
  if (def.isPercent) return (value * 100).toFixed(1) + '%'
  return value.toFixed(1)
}
