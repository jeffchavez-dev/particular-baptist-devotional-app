/**
 * noteShare.js — Shareable note links via Supabase.
 *
 * Required Supabase SQL (run once in the SQL editor):
 *
 *   create table pb_shared_notes (
 *     token       text primary key,
 *     note_data   jsonb not null,
 *     book_title  text,
 *     book_author text,
 *     owner_id    uuid references auth.users(id) on delete cascade,
 *     created_at  timestamptz default now(),
 *     updated_at  timestamptz default now()
 *   );
 *   alter table pb_shared_notes enable row level security;
 *   create policy "public read shared notes"
 *     on pb_shared_notes for select using (true);
 *   create policy "owner manage shared notes"
 *     on pb_shared_notes for all using (auth.uid() = owner_id);
 */

import { supabase } from './supabase'

export function generateShareToken() {
  return Date.now().toString(36) + Math.random().toString(36).slice(2, 10)
}

/**
 * Create or refresh a share for a note.
 * Returns the token string.
 */
export async function shareNote({ note, book, userId }) {
  const token = note.shareToken || generateShareToken()
  const { error } = await supabase.from('pb_shared_notes').upsert(
    {
      token,
      note_data:   note,
      book_title:  book.title  || '',
      book_author: book.author || '',
      owner_id:    userId,
      updated_at:  new Date().toISOString(),
    },
    { onConflict: 'token' }
  )
  if (error) throw error
  return token
}

/**
 * Push updated note content to Supabase (called after every note edit).
 * No-op if the note has no shareToken.
 */
export async function syncSharedNote({ note, book, userId }) {
  if (!note.shareToken) return
  const { error } = await supabase.from('pb_shared_notes').update({
    note_data:   note,
    book_title:  book.title  || '',
    book_author: book.author || '',
    updated_at:  new Date().toISOString(),
  })
    .eq('token', note.shareToken)
    .eq('owner_id', userId)
  if (error) console.warn('[noteShare] syncSharedNote:', error.message)
}

/**
 * Remove a shared note from Supabase. The link will 404 after this.
 */
export async function unshareNote({ token, userId }) {
  const { error } = await supabase.from('pb_shared_notes').delete()
    .eq('token', token)
    .eq('owner_id', userId)
  if (error) throw error
}

/**
 * Fetch a shared note by token (public — no auth needed).
 * Returns { note_data, book_title, book_author, updated_at } or throws.
 */
export async function getSharedNote(token) {
  const { data, error } = await supabase
    .from('pb_shared_notes')
    .select('note_data,book_title,book_author,updated_at')
    .eq('token', token)
    .single()
  if (error) throw error
  return data
}

/** Build the full shareable URL for a token */
export function noteShareUrl(token) {
  return `${window.location.origin}/share/note/${token}`
}
