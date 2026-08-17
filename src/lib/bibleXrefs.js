/**
 * Bible-to-Bible cross-reference lookup.
 *
 * Returns parsed cross-references for a given verse from bundled static data.
 * Fully offline — no network requests.
 *
 * Usage:
 *   import { getBibleXrefs, getBibleBackRefs } from '../lib/bibleXrefs'
 *
 *   // Forward: which passages does Matthew 1:2 reference?
 *   const refs = getBibleXrefs('Matthew', 1, 2)
 *   // → [{ book, chapter, verse, display }, ...]
 *
 *   // Backward: which Matthew verses reference Genesis 21:3?
 *   const backRefs = getBibleBackRefs('Genesis', 21, 3)
 *   // → [{ book: 'Matthew', chapter: 1, verse: 2 }, ...]
 */

import { MATTHEW_XREFS }   from '../data/matthewCrossRefs'
import { ROMANS_XREFS }    from '../data/romansCrossRefs'
import { JOHN_XREFS }      from '../data/johnCrossRefs'
import { ZECHARIAH_XREFS }   from '../data/zechariahCrossRefs'
import { REVELATION_XREFS } from '../data/revelationCrossRefs'
import { GENESIS_XREFS }    from '../data/genesisCrossRefs'
import { MARK_XREFS }      from '../data/markCrossRefs'
import { LUKE_XREFS }      from '../data/lukeCrossRefs'
import { ACTS_XREFS }      from '../data/actsCrossRefs'
import { COR1_XREFS }      from '../data/1corCrossRefs'
import { COR2_XREFS }      from '../data/2corCrossRefs'
import { GAL_XREFS }       from '../data/galatiansCrossRefs'
import { EPH_XREFS }       from '../data/ephesiansCrossRefs'
import { PHIL_XREFS }      from '../data/philippiansCrossRefs'
import { COL_XREFS }       from '../data/colossiansCrossRefs'
import { THESS1_XREFS }    from '../data/1thessCrossRefs'
import { THESS2_XREFS }    from '../data/2thessCrossRefs'
import { TIM1_XREFS }      from '../data/1timCrossRefs'
import { TIM2_XREFS }      from '../data/2timCrossRefs'
import { TITUS_XREFS }     from '../data/titusCrossRefs'
import { PHILEMON_XREFS }  from '../data/philemonCrossRefs'
import { HEBREWS_XREFS }  from '../data/hebrewsCrossRefs'
import { JAMES_XREFS }    from '../data/jamesCrossRefs'
import { PET1_XREFS }     from '../data/1petCrossRefs'
import { PET2_XREFS }     from '../data/2petCrossRefs'
import { JOHN1_XREFS }    from '../data/1johnCrossRefs'
import { JOHN2_XREFS }    from '../data/2johnCrossRefs'
import { JOHN3_XREFS }    from '../data/3johnCrossRefs'
import { JUDE_XREFS }     from '../data/judeCrossRefs'
import { EXODUS_XREFS }     from '../data/exodusCrossRefs'
import { LEVITICUS_XREFS }  from '../data/leviticusCrossRefs'
import { NUMBERS_XREFS }       from '../data/numbersCrossRefs'
import { DEUTERONOMY_XREFS }   from '../data/deuteronomyCrossRefs'
import { JOSHUA_XREFS }        from '../data/joshuaCrossRefs'
import { JUDGES_XREFS }        from '../data/judgesCrossRefs'
import { RUTH_XREFS }          from '../data/ruthCrossRefs'
import { SAM1_XREFS }          from '../data/1samCrossRefs'
import { SAM2_XREFS }          from '../data/2samCrossRefs'
import { KGS1_XREFS }          from '../data/1kgsCrossRefs'
import { KGS2_XREFS }          from '../data/2kgsCrossRefs'
import { CHR1_XREFS }          from '../data/1chrCrossRefs'
import { CHR2_XREFS }          from '../data/2chrCrossRefs'
import { EZRA_XREFS }          from '../data/ezraCrossRefs'
import { NEH_XREFS }           from '../data/nehCrossRefs'
import { ESTH_XREFS }          from '../data/esthCrossRefs'
import { JOB_XREFS }           from '../data/jobCrossRefs'
import { parseRefs } from './parseRefs'

/* ── Source books with bundled xref data ── */
const XREF_SOURCES = [
  { book: 'Genesis',    data: GENESIS_XREFS    },
  { book: 'Exodus',    data: EXODUS_XREFS    },
  { book: 'Leviticus', data: LEVITICUS_XREFS },
  { book: 'Numbers',      data: NUMBERS_XREFS      },
  { book: 'Deuteronomy', data: DEUTERONOMY_XREFS  },
  { book: 'Joshua',      data: JOSHUA_XREFS       },
  { book: 'Judges',      data: JUDGES_XREFS       },
  { book: 'Ruth',        data: RUTH_XREFS         },
  { book: '1 Samuel',   data: SAM1_XREFS         },
  { book: '2 Samuel',   data: SAM2_XREFS         },
  { book: '1 Kings',   data: KGS1_XREFS         },
  { book: '2 Kings',       data: KGS2_XREFS         },
  { book: '1 Chronicles', data: CHR1_XREFS         },
  { book: '2 Chronicles', data: CHR2_XREFS         },
  { book: 'Ezra',         data: EZRA_XREFS         },
  { book: 'Nehemiah',     data: NEH_XREFS          },
  { book: 'Esther',       data: ESTH_XREFS         },
  { book: 'Job',          data: JOB_XREFS          },
  { book: 'Mark',      data: MARK_XREFS      },
  { book: 'Luke',      data: LUKE_XREFS      },
  { book: 'Acts',           data: ACTS_XREFS  },
  { book: '1 Corinthians', data: COR1_XREFS  },
  { book: '2 Corinthians', data: COR2_XREFS  },
  { book: 'Galatians',    data: GAL_XREFS   },
  { book: 'Ephesians',    data: EPH_XREFS   },
  { book: 'Philippians',  data: PHIL_XREFS  },
  { book: 'Colossians',       data: COL_XREFS    },
  { book: '1 Thessalonians', data: THESS1_XREFS },
  { book: '2 Thessalonians', data: THESS2_XREFS },
  { book: '1 Timothy',       data: TIM1_XREFS   },
  { book: '2 Timothy',       data: TIM2_XREFS   },
  { book: 'Titus',           data: TITUS_XREFS  },
  { book: 'Philemon',        data: PHILEMON_XREFS },
  { book: 'Hebrews',        data: HEBREWS_XREFS  },
  { book: 'James',          data: JAMES_XREFS    },
  { book: '1 Peter',        data: PET1_XREFS     },
  { book: '2 Peter',        data: PET2_XREFS     },
  { book: '1 John',         data: JOHN1_XREFS    },
  { book: '2 John',         data: JOHN2_XREFS    },
  { book: '3 John',         data: JOHN3_XREFS    },
  { book: 'Jude',           data: JUDE_XREFS     },
  { book: 'Matthew',   data: MATTHEW_XREFS   },
  { book: 'Romans',    data: ROMANS_XREFS    },
  { book: 'John',      data: JOHN_XREFS      },
  { book: 'Zechariah',   data: ZECHARIAH_XREFS   },
  { book: 'Revelation',  data: REVELATION_XREFS  },
]

/* ── Forward cache: 'book:ch:v' → parsed ref array ── */
const _fwdCache = {}

/**
 * Forward lookup — which passages does a verse reference?
 * Currently covers Matthew, Romans, and John.
 */
export function getBibleXrefs(book, chapter, verse) {
  const source = XREF_SOURCES.find(s => s.book === book)
  if (!source) return []

  const key = `${chapter}:${verse}`
  if (!source.data[key]) return []

  const cacheKey = `${book}:${key}`
  if (_fwdCache[cacheKey]) return _fwdCache[cacheKey]

  const parsed = parseRefs(source.data[key])
  _fwdCache[cacheKey] = parsed
  return parsed
}

/* ── Reverse index: 'Book:ch:v' → [{ book, chapter, verse }, ...] ── */
let _reverseIndex = null

function buildReverseIndex() {
  if (_reverseIndex) return _reverseIndex
  _reverseIndex = {}

  for (const { book: srcBook, data } of XREF_SOURCES) {
    for (const [key, refStr] of Object.entries(data)) {
      const [chStr, vStr] = key.split(':')
      const srcChapter = parseInt(chStr, 10)
      const srcVerse   = parseInt(vStr,  10)

      const refs = parseRefs(refStr)
      for (const ref of refs) {
        // Only index verse-exact back-refs (skip chapter-only refs to avoid noise)
        if (!ref.book || !ref.chapter || !ref.verse) continue
        const tgtKey = `${ref.book}:${ref.chapter}:${ref.verse}`
        if (!_reverseIndex[tgtKey]) _reverseIndex[tgtKey] = []
        _reverseIndex[tgtKey].push({ book: srcBook, chapter: srcChapter, verse: srcVerse })
      }
    }
  }

  return _reverseIndex
}

/**
 * Reverse lookup — which static Bible xref passages point TO a given verse?
 * (Currently covers Matthew, Romans, and John → rest of Bible.)
 *
 * @param {string} book    - book name, e.g. 'Genesis'
 * @param {number} chapter - chapter number
 * @param {number} verse   - verse number
 * @returns {{ book: string, chapter: number, verse: number }[]}
 */
export function getBibleBackRefs(book, chapter, verse) {
  if (!verse) return []
  const idx = buildReverseIndex()
  return idx[`${book}:${chapter}:${verse}`] || []
}
