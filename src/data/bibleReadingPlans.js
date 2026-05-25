/**
 * Bible Reading Plan Presets
 * Add new plans here — no other code changes needed.
 * Each preset with chapterOrder: null uses canonical book order from BIBLE_BOOKS.
 * Presets with chapterOrder: [...] override with a custom sequence.
 */

export const READING_PLANS = [
  {
    id: 'whole-canonical',
    label: 'Whole Bible',
    description: 'All 1,189 chapters in canonical order (Genesis → Revelation)',
    scope: 'whole',
    chapterOrder: null, // computed from BIBLE_BOOKS
  },
  {
    id: 'ot-only',
    label: 'Old Testament',
    description: 'All 929 OT chapters in canonical order',
    scope: 'ot',
    chapterOrder: null,
  },
  {
    id: 'nt-only',
    label: 'New Testament',
    description: 'All 260 NT chapters in canonical order',
    scope: 'nt',
    chapterOrder: null,
  },
  {
    id: 'custom',
    label: 'Custom Range',
    description: 'Pick any start and end point in the Bible',
    scope: 'custom',
    chapterOrder: null,
  },
  // Future plans — uncomment and add chapterOrder arrays:
  // {
  //   id: 'chronological',
  //   label: 'Chronological',
  //   description: 'Read the Bible in the order events occurred',
  //   scope: 'custom-order',
  //   chapterOrder: [ 'Job 1', 'Job 2', ... ],
  // },
  // {
  //   id: 'mcheyne',
  //   label: "M'Cheyne One-Year",
  //   description: 'Robert Murray M\'Cheyne\'s classic 4-column reading plan',
  //   scope: 'custom-order',
  //   chaptersPerDay: 4,
  //   chapterOrder: [ ... ],
  // },
]

export const PLAN_BY_ID = Object.fromEntries(READING_PLANS.map(p => [p.id, p]))
