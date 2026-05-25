/**
 * Confession Reading Plan definitions.
 * Items are assembled dynamically from the source data files.
 */

export const CONF_PLANS = [
  {
    id: 'three',
    label: 'Three Confessions',
    short: '3 Conf.',
    description: '2LBCF · Baptist Catechism · 1LBCF — ~1 year companion plan',
    cyclic: true,
    defaultMode: 'year',  // spread evenly over 365 days by default
  },
  {
    id: '2lbcf',
    label: '2nd London Confession',
    short: '2LBCF',
    description: '32 chapters · 160 sections',
    cyclic: true,
  },
  {
    id: 'catechism',
    label: 'Baptist Catechism',
    short: 'Catechism',
    description: '114 Q&As',
    cyclic: true,
  },
  {
    id: '1lbcf',
    label: '1st London Confession',
    short: '1LBCF',
    description: '52 articles',
    cyclic: true,
  },
  {
    id: 'orthodox',
    label: 'Orthodox Catechism',
    short: 'Orthodox',
    description: '148 Q&As — An Orthodox Catechism by Hercules Collins',
    cyclic: true,
  },
]

// Legacy 'all' entry kept for backward-compat (users who had it saved)
const LEGACY_ALL = {
  id: 'all',
  label: 'All Four Confessions',
  short: 'All',
  description: '2LBCF · Catechism · 1LBCF · Orthodox — read through once',
  cyclic: false,
}

export const CONF_PLAN_BY_ID = {
  ...Object.fromEntries(CONF_PLANS.map(p => [p.id, p])),
  all: LEGACY_ALL,
}
