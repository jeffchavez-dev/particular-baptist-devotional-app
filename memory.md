# Memory — Vocab Feature + Flashcard Enhancement

Last updated: 2026-09-01

## What was built

**v1.10.0 — Vocab feature (prior session, already pushed):**
- `src/lib/vocab.js` — localStorage-backed vocab store (`pb-vocab` key). Word shape: `{ id, lang, lemma, translit, pronun, gloss, def, savedFrom, morph, reviewCount, status, savedAt }`. Exports: `loadVocab`, `getVocabList(lang)`, `isVocabSaved`, `saveVocabWord`, `removeVocabWord`, `toggleVocabWord`, `incrementReviewCount`, `setVocabStatus`. `VOCAB_STATUSES = [new, learning, mastered]`. Auto-promotes new→learning on first review.
- `src/components/StrongsModal.jsx` — Save word button in lexicon footer. Captures `savedFrom` (book/chapter/verse) and `morph` string at save time. Imports `parseMorphDetails` from greek.js and `parseHebrewMorphDetails` from hebrew.js.
- `src/components/KjvReader.jsx` — passes `currentChapter`, `currentVerse`, `currentMorph` to StrongsModal. All four word-tap `setStrongsModal` calls include `verseNum: verse` and `morph: wd.r`.
- `src/pages/LibraryPage.jsx` — Vocab tab in My Library showing Greek and Hebrew as separate collapsible `VocabBox` components. `VocabReviewScreen` full-screen flashcard review.

**v1.10.1 — VocabBox + status tags (this session, pushed):**
- `VocabBox` component: collapsible card per language, word list with lemma, translit, gloss, Strong's badge, review count badge (`×N`), tappable status tag cycling New→Learning→Mastered, savedFrom passage, remove button, Review button.
- `VocabReviewScreen`: review count increments on reveal (once per word per session); savedFrom shown on card back.

**v1.10.2 — Flashcard back enhancement (this session, pushed):**
- Flashcard back now shows: morph tag (e.g. "Verb · Qal · Perfect · 3ms"), translit, gloss, definition, KJV verse text (gold left border), reference with verse number (e.g. "Zechariah 1:3").
- `VocabReviewScreen` loads KJV data on mount, looks up verse by `savedFrom.book/chapter/verse`.
- `vr.cardMorph` and `vr.cardVerse` styles added.
- GitHub push now works via token embedded in remote URL — token stored in macOS Keychain after first use.

## Decisions made

- **Vocab storage**: localStorage only (`pb-vocab`), keyed by Strong's ID. No Supabase sync.
- **Status system**: 3 states — New / Learning / Mastered. Tapping cycles forward. Auto-promotes New→Learning on first review.
- **Verse text on card**: KJV only, plain text (no highlighting). No original-language verse line — lemma on front already serves that purpose.
- **Morph stored at save time**: formatted string stored in vocab entry, not looked up at review time.
- **No word highlighting in verse text**: tagged KJV not available in the app.
- **VocabBox collapsed by default**: `open` state starts `true` (expanded) — reconsider if list grows long.

## Problems solved

- GitHub HTTPS push was failing due to expired token. Fixed by embedding token in remote URL: `git remote set-url origin https://jeffchavez-dev:TOKEN@github.com/...`. Token now cached in macOS Keychain.
- `KGS2_XREFS` import error (prior session): fixed by adding alias export to `2kgsCrossRefs.js`.

## Current state

- v1.10.2 is live on Vercel.
- Vocab feature fully working: save from interlinear panel, review as flashcards, status tags, review counts, verse context, morph parsing.
- **Note**: existing saved words (saved before v1.10.2) won't have `verse` or `morph` — they show definition + chapter-level reference only. Any word re-saved after v1.10.2 gets full data.
- `src/lib/planEngine.js` is untracked — not part of vocab work, leave it.

## Next session starts with

No specific pending tasks from this session. Possible next items:
- Psalm cross-references (BSB data was pasted in a prior-prior session but never processed — use the `add-xrefs` skill)
- Search scope step for Find-in-HOT/GNT/LXX (architect session was done, blueprint ready — not yet built)
- Confession page proof text chip navigation fix (architect session done — not yet built)

## Open questions

- Should VocabBox default to collapsed (`open: false`) once word lists get long?
- LSB licensing: no public API or pricing page found. User would need to email lsbible.org directly for personal/non-commercial use.
