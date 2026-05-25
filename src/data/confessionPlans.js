/**
 * Confession Reading Plan definitions.
 * Items are assembled dynamically from the source data files.
 */

export const CONF_PLANS = [
  {
    id: 'all',
    label: 'All Confessions',
    description: 'All 4 in order: 2LBCF, Baptist Catechism, 1LBCF, Orthodox Catechism',
    cyclic: false,   // read through once
  },
  {
    id: '2lbcf',
    label: '2nd London Confession',
    short: '2LBCF',
    description: '32 chapters · 160 sections',
    cyclic: true,    // supports yearly cycling
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
    description: '148 Q&As',
    cyclic: true,
  },
]

export const CONF_PLAN_BY_ID = Object.fromEntries(CONF_PLANS.map(p => [p.id, p]))
