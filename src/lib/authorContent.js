/**
 * authorContent.js
 *
 * Supabase CRUD for author-curated scripture content:
 *   • author_scripture_notes  — verse-level commentary visible to all users
 *   • author_cross_refs       — author-defined passage links (e.g. John 3:16 → Num 15)
 *
 * RLS: all authenticated and anonymous users can SELECT.
 *      Only the author account (by email) can INSERT / UPDATE / DELETE.
 *
 * Required SQL (run once in Supabase dashboard — see bottom of this file).
 */

import { supabase } from './supabase'

export const AUTHOR_EMAIL = 'jeffchavez0828@gmail.com'

/** Returns true when the current session belongs to the author. */
export function isAuthor(session) {
  return session?.user?.email === AUTHOR_EMAIL
}

// ─────────────────────────────────────────────
//  Author Scripture Notes
// ─────────────────────────────────────────────

/**
 * Fetch all author notes for a given book + chapter.
 * Returns an array of { id, book, chapter, verse, note, updated_at }
 */
export async function fetchAuthorNotes(book, chapter) {
  try {
    const { data, error } = await supabase
      .from('author_scripture_notes')
      .select('*')
      .eq('book', book)
      .eq('chapter', Number(chapter))
      .order('verse', { ascending: true })
    if (error) throw error
    return data || []
  } catch (e) {
    console.warn('[authorContent] fetchAuthorNotes:', e?.message)
    return []
  }
}

/**
 * Create or update an author note.
 * Conflict key: (book, chapter, verse)
 */
export async function upsertAuthorNote({ book, chapter, verse, note }) {
  const { error } = await supabase
    .from('author_scripture_notes')
    .upsert(
      { book, chapter: Number(chapter), verse: Number(verse), note, updated_at: new Date().toISOString() },
      { onConflict: 'book,chapter,verse' }
    )
  if (error) throw error
}

/**
 * Delete an author note by its primary key id.
 */
export async function deleteAuthorNote(id) {
  const { error } = await supabase
    .from('author_scripture_notes')
    .delete()
    .eq('id', id)
  if (error) throw error
}

// ─────────────────────────────────────────────
//  Author Cross-References
// ─────────────────────────────────────────────

/**
 * Fetch all author cross-refs where the SOURCE is the given book + chapter.
 * Returns an array of:
 *   { id, src_book, src_chapter, src_verse,
 *       tgt_book, tgt_chapter, tgt_verse, label, updated_at }
 */
export async function fetchAuthorCrossRefs(book, chapter) {
  try {
    const { data, error } = await supabase
      .from('author_cross_refs')
      .select('*')
      .eq('src_book', book)
      .eq('src_chapter', Number(chapter))
      .order('src_verse', { ascending: true })
    if (error) throw error
    return data || []
  } catch (e) {
    console.warn('[authorContent] fetchAuthorCrossRefs:', e?.message)
    return []
  }
}

/**
 * Create or update an author cross-ref.
 * Conflict key: (src_book, src_chapter, src_verse, tgt_book, tgt_chapter, tgt_verse)
 */
export async function upsertAuthorCrossRef({ src_book, src_chapter, src_verse, tgt_book, tgt_chapter, tgt_verse, label }) {
  const { error } = await supabase
    .from('author_cross_refs')
    .upsert(
      {
        src_book,
        src_chapter: Number(src_chapter),
        src_verse:   Number(src_verse),
        tgt_book,
        tgt_chapter: Number(tgt_chapter),
        tgt_verse:   tgt_verse != null ? Number(tgt_verse) : null,
        label:       label || null,
        updated_at:  new Date().toISOString(),
      },
      { onConflict: 'src_book,src_chapter,src_verse,tgt_book,tgt_chapter,tgt_verse' }
    )
  if (error) throw error
}

/**
 * Delete an author cross-ref by its primary key id.
 */
export async function deleteAuthorCrossRef(id) {
  const { error } = await supabase
    .from('author_cross_refs')
    .delete()
    .eq('id', id)
  if (error) throw error
}

/* ──────────────────────────────────────────────────────────────────────────────
   SQL MIGRATION — run once in the Supabase SQL editor
   ──────────────────────────────────────────────────────────────────────────────

-- 1) Author scripture notes (verse-level commentary)
create table if not exists author_scripture_notes (
  id          uuid        default gen_random_uuid() primary key,
  book        text        not null,
  chapter     int         not null,
  verse       int         not null,
  note        text        not null default '',
  updated_at  timestamptz default now(),
  unique(book, chapter, verse)
);
alter table author_scripture_notes enable row level security;

-- Everyone can read
create policy "public read author notes"
  on author_scripture_notes for select using (true);

-- Only the author can write (insert / update / delete)
create policy "author write notes"
  on author_scripture_notes for all
  using  (auth.jwt() ->> 'email' = 'jeffchavez0828@gmail.com')
  with check (auth.jwt() ->> 'email' = 'jeffchavez0828@gmail.com');

-- 2) Author cross-references (passage links)
create table if not exists author_cross_refs (
  id          uuid        default gen_random_uuid() primary key,
  src_book    text        not null,
  src_chapter int         not null,
  src_verse   int         not null,
  tgt_book    text        not null,
  tgt_chapter int         not null,
  tgt_verse   int,
  label       text,
  updated_at  timestamptz default now(),
  unique(src_book, src_chapter, src_verse, tgt_book, tgt_chapter, tgt_verse)
);
alter table author_cross_refs enable row level security;

-- Everyone can read
create policy "public read author xrefs"
  on author_cross_refs for select using (true);

-- Only the author can write
create policy "author write xrefs"
  on author_cross_refs for all
  using  (auth.jwt() ->> 'email' = 'jeffchavez0828@gmail.com')
  with check (auth.jwt() ->> 'email' = 'jeffchavez0828@gmail.com');

   ────────────────────────────────────────────────────────────────────────────── */
