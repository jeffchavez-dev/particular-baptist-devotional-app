/**
 * seed-1cor-xrefs.mjs
 *
 * Parses the 1 Corinthians cross-reference data and upserts it into
 * the author_cross_refs table.
 *
 * Usage (service role key — bypasses RLS, no login needed):
 *   node scripts/seed-1cor-xrefs.mjs <service-role-key>
 *
 * Get it from: Supabase dashboard → Project Settings → API → service_role key
 */

import { createClient } from '@supabase/supabase-js'

const SUPABASE_URL = 'https://bhnfugknhwhuqxsqopgj.supabase.co'

// ── Book abbreviation → full canonical name ──────────────────────────────────
const BOOK_MAP = {
  '1 Thess.': '1 Thessalonians',
  '2 Thess.': '2 Thessalonians',
  '1 Cor.':   '1 Corinthians',
  '2 Cor.':   '2 Corinthians',
  '1 Chr.':   '1 Chronicles',
  '2 Chr.':   '2 Chronicles',
  '1 Sam.':   '1 Samuel',
  '2 Sam.':   '2 Samuel',
  '1 Tim.':   '1 Timothy',
  '2 Tim.':   '2 Timothy',
  '1 Pet.':   '1 Peter',
  '2 Pet.':   '2 Peter',
  '1 John':   '1 John',
  '2 John':   '2 John',
  '3 John':   '3 John',
  'Eccles.':  'Ecclesiastes',
  'Philem.':  'Philemon',
  'Zeph.':    'Zephaniah',
  'Deut.':    'Deuteronomy',
  'Ezek.':    'Ezekiel',
  'Matt.':    'Matthew',
  'Prov.':    'Proverbs',
  'Zech.':    'Zechariah',
  'Obad.':    'Obadiah',
  'Phil.':    'Philippians',
  'Acts':     'Acts',
  'Amos':     'Amos',
  'Col.':     'Colossians',
  'Dan.':     'Daniel',
  'Eph.':     'Ephesians',
  'Ex.':      'Exodus',
  'Gal.':     'Galatians',
  'Gen.':     'Genesis',
  'Hab.':     'Habakkuk',
  'Hag.':     'Haggai',
  'Heb.':     'Hebrews',
  'Hos.':     'Hosea',
  'Isa.':     'Isaiah',
  'James':    'James',
  'Jer.':     'Jeremiah',
  'Job':      'Job',
  'Joel':     'Joel',
  'John':     'John',
  'Jon.':     'Jonah',
  'Josh.':    'Joshua',
  'Judg.':    'Judges',
  'Jude':     'Jude',
  'Lam.':     'Lamentations',
  'Lev.':     'Leviticus',
  'Luke':     'Luke',
  'Mal.':     'Malachi',
  'Mark':     'Mark',
  'Mic.':     'Micah',
  'Nah.':     'Nahum',
  'Neh.':     'Nehemiah',
  'Num.':     'Numbers',
  'Ps.':      'Psalms',
  'Rev.':     'Revelation',
  'Rom.':     'Romans',
  'Ruth':     'Ruth',
  'Song':     'Song of Solomon',
  'Titus':    'Titus',
}

// Sort longest-first so "1 Thess." is tried before "1 Tim." etc.
const ABBR_SORTED = Object.keys(BOOK_MAP).sort((a, b) => b.length - a.length)

// ── Raw cross-reference data ─────────────────────────────────────────────────
const RAW = `\
1:1 a See Rom. 1:1 b 2 Cor. 1:1; Eph. 1:1; Col. 1:1; 2 Tim. 1:1
1:2 c ch. 6:11; [ver. 30]; See John 17:19 d See Rom. 1:7 e See Acts 9:14
1:3 d [See ver. 2 above]
1:4 f See Rom. 1:8
1:5 g 2 Cor. 9:11; [2 Cor. 6:10] h 2 Cor. 8:7; [ch. 12:8]; See Rom. 15:14; 1 John 2:20
1:6 i 2 Tim. 1:8; [2 Thess. 1:10; 1 Tim. 2:6; Rev. 1:2]
1:7 j Rom. 8:19; Phil. 3:20; Heb. 9:28; See Luke 17:30; 2 Pet. 3:12
1:8 k [Phil. 1:6; 1 Thess. 3:13] l Col. 1:22 m ch. 5:5; 2 Cor. 1:14; Phil. 2:16; [Luke 17:24]
1:9 n ch. 10:13; Deut. 7:9; Isa. 49:7; 2 Cor. 1:18 o 1 John 1:3
1:10 p ch. 11:18 q [Phil. 1:27]
1:11 r ch. 3:3
1:12 s ch. 3:4; [Matt. 23:9, 10] t See Acts 18:24 u See John 1:42
1:13 v [ch. 12:5; 2 Cor. 11:4; Eph. 4:5] w See Acts 8:16
1:14 x Acts 18:8 y See Rom. 16:23
1:16 z ch. 16:15, 17
1:17 a ch. 2:1, 4, 13; [2 Cor. 10:10; 11:6; 2 Pet. 1:16]
1:18 b ver. 21, 23, 25; ch. 2:14 c 2 Cor. 2:15; 4:3; 2 Thess. 2:10 d ch. 15:2; [Acts 2:47] e Rom. 1:16; [ver. 24]
1:19 f Cited from Isa. 29:14; [Job 5:12, 13; Jer. 8:9; Matt. 11:25]
1:20 g Isa. 19:12 h ch. 2:6; 3:19; Isa. 44:25; Rom. 1:22; [ver. 26]
1:22 i See Matt. 12:38
1:23 j Gal. 5:11; See 1 Pet. 2:8
1:24 k [ver. 18] l ver. 30; Col. 2:3; [Luke 11:49]
1:26 m ch. 2:8; John 7:48; [ver. 20]; See Matt. 11:25
1:27 n James 2:5 o Ps. 8:2
1:28 p Rom. 4:17 q ch. 2:6; [Job 34:19, 24]
1:29 r Eph. 2:9; [Judg. 7:2]
1:30 s [ver. 24] t Jer. 23:5, 6; 33:16; 2 Cor. 5:21; Phil. 3:9 u [ver. 2] v Eph. 1:7; Col. 1:14; [Rom. 3:24]
1:31 w 2 Cor. 10:17; [Jer. 9:23, 24]
2:1 x ver. 4, 13; [2 Cor. 1:12]; See ch. 1:17 y See Rom. 16:25
2:2 z Gal. 6:14
2:3 a Acts 18:1, 6, 12 b 2 Cor. 11:30; 12:5, 9; 13:4, 9; Gal. 4:13
2:4 c ch. 4:20; Rom. 15:13, 19; 1 Thess. 1:5; 2 Pet. 1:16
2:5 d 2 Cor. 4:7; 6:7; [Zech. 4:6; 2 Cor. 10:4; 12:9]
2:6 e Phil. 3:15; [ch. 3:1] f [James 3:15] g ch. 1:28
2:7 h Rom. 16:25, 26; Eph. 3:5, 9; Col. 1:26; 2 Tim. 1:9
2:8 i Acts 13:27; See Luke 24:20 j See Acts 3:17 k James 2:1; [Ps. 24:7-10; Acts 7:2]
2:9 l [Isa. 64:4] m See Matt. 25:34 n James 1:12
2:10 o Matt. 16:17; Gal. 1:12, 16; Eph. 3:3, 5; See John 14:26 p [Rev. 2:24]
2:11 q Prov. 20:27
2:12 r Rom. 8:15 s [1 John 4:4]
2:13 t ver. 1, 4; See ch. 1:17 u 2 Cor. 10:12
2:14 v ch. 1:18 w Rom. 8:7
2:15 x ch. 3:1; 14:37; Gal. 6:1; [Prov. 28:5]
2:16 y Cited from Isa. 40:13; See Rom. 11:34 z [John 15:15]
3:1 a ch. 2:15; Rom. 7:14 b [ch. 2:14] c Heb. 5:13; [ch. 2:6]
3:2 d Heb. 5:12, 13; 1 Pet. 2:2 e John 16:12
3:3 f Gal. 5:19, 20; [ch. 1:11; 11:18; Rom. 13:13]
3:4 g See ch. 1:12 h [ver. 3]
3:5 i 2 Cor. 6:4; Eph. 3:7; Col. 1:25; [2 Cor. 3:3] j See Rom. 12:6
3:6 k ch. 4:15; 9:1; 15:1; Acts 18:4-11; 2 Cor. 10:14, 15 l Acts 18:27 m [ch. 15:10; Col. 1:18]
3:7 n 2 Cor. 12:11; Gal. 6:3; [Gal. 2:6]
3:8 o ver. 14; ch. 15:58; 2 John 8; [ch. 4:5; Gal. 6:4, 5]; See Matt. 16:27; Rom. 2:6
3:9 p Mark 16:20; 2 Cor. 6:1 q Eph. 2:20-22; Col. 2:7; [ver. 16; Ps. 127:1]
3:10 r [2 Pet. 3:15]; See Rom. 12:3 s ver. 11, 12; Rom. 15:20; [Rev. 21:14] t [ch. 4:15]
3:11 u Isa. 28:16 v [2 Cor. 11:4; Gal. 1:6, 7] w [Eph. 2:20]
3:13 x ch. 4:5 y ver. 15; 2 Thess. 1:8 z 1 Pet. 1:7
3:14 a See ver. 8
3:15 b [Ps. 66:12; Isa. 43:2; Jude 23]
3:16 c ch. 6:19; 2 Cor. 6:16; Eph. 2:21
3:17 d [2 Cor. 7:1]
3:18 e [Isa. 5:21; Gal. 6:3] f [ch. 8:2; Jer. 8:8, 9]
3:19 g See ch. 1:20 h Cited from Job 5:13
3:20 i Cited from Ps. 94:11
3:21 j ver. 4-6; ch. 1:12; 4:6 k Rom. 8:28
3:23 l 2 Cor. 10:7; Gal. 3:29 m [ch. 11:3]
4:1 n [ch. 9:17]; See 1 Pet. 4:10
4:4 o See Acts 23:1 p Job 9:2, 15; Ps. 130:3; 143:2; [1 John 3:21]
4:5 q Matt. 7:1; Rom. 2:1; [Matt. 13:29] r See John 21:22; Rom. 2:16 s ch. 3:13 t 2 Cor. 10:18; See ch. 3:8
4:6 u ver. 18, 19; ch. 5:2; 13:4
4:7 v John 3:27; [1 Chr. 29:14; James 1:17; 1 Pet. 4:10]
4:9 w See Rom. 8:36 x Heb. 10:33; [Isa. 20:3]
4:10 y [Acts 17:18]; See ch. 1:18; Acts 26:24 z 2 Cor. 11:19 a ch. 2:3; 2 Cor. 13:9
4:11 b Rom. 8:35; 2 Cor. 11:27; Phil. 4:12 c 2 Cor. 11:20, 23 d [Matt. 8:20]
4:12 e See Acts 18:3 f See 1 Pet. 3:9 g See John 15:20
4:13 h [Isa. 30:22; 64:6] i Lam. 3:45
4:14 j [ch. 6:5; 15:34] k 2 Cor. 6:13; 1 Thess. 2:11; 3 John 4
4:15 l [ch. 3:10] m Philem. 10; [Gal. 4:19]
4:16 n ch. 11:1; Phil. 3:17; 1 Thess. 1:6; [Phil. 4:9; 2 Thess. 3:9]
4:17 o ch. 16:10 p 1 Tim. 1:2; 2 Tim. 1:2 q ch. 7:17
4:18 r See ver. 6 s ver. 21; [2 Cor. 10:2]
4:19 t ch. 11:34; 16:5, 6; Acts 19:21; 20:2; 2 Cor. 1:15, 16
4:20 u See ch. 2:4
4:21 v 2 Cor. 1:23; 2:1, 3; 12:20; 13:2, 10
5:1 w 2 Cor. 12:21 x Lev. 18:8; Deut. 22:30; 27:20
5:2 y See ch. 4:6 z [2 Cor. 7:7-10]
5:3 a Col. 2:5; [1 Thess. 2:17]
5:4 b 2 Thess. 3:6; [Matt. 16:19; 18:18; John 20:23; 2 Cor. 13:3, 10; 1 Tim. 5:20]
5:5 c 1 Tim. 1:20; [Job 2:6; Acts 26:18] d [Prov. 23:14] e See ch. 1:8
5:6 f James 4:16; [ver. 2] g Gal. 5:9; [ch. 15:33]
5:8 h Ex. 12:15; Deut. 16:3 i [Matt. 16:6, 12; Mark 8:15; Luke 12:1]
5:9 j [2 Cor. 6:14; Eph. 5:11; 2 Thess. 3:6, 14]
5:10 k [ch. 10:27] l Eph. 5:5; Col. 3:5; [ch. 6:9] m [John 17:15]
5:11 n 2 Thess. 3:6
5:12 o See Mark 4:11 p [ch. 6:1-4]
5:13 q [Deut. 13:5; 17:7, 12; 21:21; 22:21, 22, 24; Judg. 20:13]
6:1 r [Matt. 18:17]
6:2 s Dan. 7:22; [Matt. 19:28; Rev. 20:4]
6:4 t [ch. 5:12]
6:5 u ch. 15:34; [ch. 4:14]
6:7 v [Matt. 5:39, 40]
6:8 w 1 Thess. 4:6
6:9 x ch. 15:50; Gal. 5:21; Eph. 5:5; 1 Tim. 1:9; Heb. 12:14; 13:4; Rev. 21:8; 22:15
6:11 y ch. 12:2; Eph. 2:2, 3; 4:22; 5:8; Col. 3:7; Titus 3:3 z Acts 22:16; Heb. 10:22; [Titus 3:5] a See ch. 1:2 b Rom. 8:30
6:12 c ch. 10:23
6:13 d [Matt. 15:17] e Col. 2:22 f ver. 15, 19 g [Eph. 5:23]
6:14 h See Acts 2:24 i ch. 15:22, 23; [John 6:39, 40] j Matt. 22:29; [Eph. 1:19, 20]
6:15 k ver. 13; Eph. 5:30; [ch. 12:27; Rom. 12:5]
6:16 l Matt. 19:5; Mark 10:8; Eph. 5:31; Cited from Gen. 2:24
6:17 m Eph. 4:4; [John 17:21-23]
6:18 n 2 Cor. 12:21; Eph. 5:3 o [Prov. 5:11]
6:19 p [John 2:21]; See ch. 3:16 q See Rom. 14:7
6:20 r ch. 7:23; [Acts 20:28; Heb. 9:12, 14]; See 2 Pet. 2:1 s [Phil. 1:20]
7:1 t ver. 8, 26
7:3 u Ex. 21:10
7:5 v [Ex. 19:15; 1 Sam. 21:4; Eccles. 3:5; Zech. 12:12-14] w 1 Thess. 3:5
7:6 x ver. 12, 25; 2 Cor. 8:8; [ver. 10, 40]
7:7 y [Acts 26:29] z ver. 8; [ch. 9:5] a ch. 12:4, 11; 1 Pet. 4:10; [Rom. 12:6] b Matt. 19:11, 12
7:8 c ver. 1, 26 d ver. 7
7:9 e [1 Tim. 5:14]
7:10 f See ver. 6 g Mal. 2:16; See Matt. 5:32
7:11 h Mark 10:12 g [See ver. 10 above]
7:14 i Ezra 9:2; Mal. 2:15
7:15 j Col. 3:15; See Rom. 14:19
7:16 k 1 Pet. 3:1; See Rom. 11:14
7:17 l See Rom. 12:3 m ch. 4:17 n 2 Cor. 8:18; 11:28
7:18 o Acts 15:1, 5, 19, 24, 28; Gal. 5:2
7:19 p Gal. 3:28; 5:6; 6:15; Col. 3:11 q See 1 John 2:3
7:20 r ver. 24
7:22 s [Col. 3:24; Philem. 16]; See John 8:36 t [ch. 9:21; 1 Pet. 2:16]
7:23 u See ch. 6:20 v Lev. 25:42, 55
7:24 w ver. 20
7:25 x See ver. 6 y 2 Cor. 4:1; 1 Tim. 1:13, 16 z ch. 4:2
7:26 a ver. 1, 8
7:29 b See Rom. 13:11
7:30 c 2 Cor. 6:10
7:31 d Ps. 39:6; James 1:10; 1 Pet. 1:24; 4:7; 1 John 2:17
7:32 e See Matt. 6:25; Luke 10:41 f [1 Tim. 5:5]
7:35 g [Prov. 22:25]
7:38 h Heb. 13:4
7:39 i Rom. 7:2 j [2 Cor. 6:14]
7:40 k See ver. 6 l [Acts 15:28]
8:1 m ver. 4, 7, 10; See Acts 15:29 n See Rom. 15:14 o Rom. 14:3 p ch. 13:4-13
8:2 q Gal. 6:3; [ch. 3:18] r [ch. 13:8, 9, 12; 1 Tim. 6:3, 4]
8:3 s Gal. 4:9; [Ex. 33:12, 17; Jer. 1:5; Nah. 1:7; 2 Tim. 2:19]
8:4 t ch. 10:19; Isa. 41:24; [Acts 14:15] u ver. 6; See Deut. 4:35, 39
8:5 v 2 Thess. 2:4
8:6 w ver. 4; Mal. 2:10; Eph. 4:6 x See Rom. 11:36 y Eph. 4:5; [ch. 1:2; 1 Tim. 2:5]; See John 13:13 z John 1:3; Col. 1:16
8:7 a [Rom. 14:14, 22, 23] b ch. 10:25, 28, 29
8:8 c Rom. 14:17
8:9 d [ch. 10:23; Rom. 14:21; Gal. 5:13] e Rom. 14:1, 2
8:11 f Rom. 14:15, 20
8:12 g [Zech. 2:8; Matt. 18:6] h [Matt. 25:45]
8:13 i Rom. 14:13, 21; [2 Cor. 6:3; 11:29]
9:1 j ver. 19 k Acts 14:14; 2 Cor. 12:12; 1 Thess. 2:6; [2 Cor. 10:7; Rev. 2:2] l ch. 15:8; Acts 9:3, 17; 18:9; 22:14, 18; 23:11 m See ch. 3:6
9:2 n [2 Cor. 3:2]
9:4 o ver. 14; 1 Thess. 2:6, 9; 2 Thess. 3:8, 9
9:5 p [ch. 7:7] q See Matt. 12:46 r Matt. 8:14; See John 1:42
9:7 s 2 Cor. 10:4; 1 Tim. 1:18; 2 Tim. 2:3, 4 t [ch. 3:6-8; Deut. 20:6; Prov. 27:18; Song 8:12]
9:9 u 1 Tim. 5:18; Cited from Deut. 25:4
9:10 v See Rom. 4:24 w 2 Tim. 2:6
9:11 x [Rom. 15:27; Gal. 6:6]
9:12 y ver. 15, 18; See Acts 20:33 z [2 Cor. 6:3; 11:12]
9:13 a Lev. 6:16, 26; 7:6; Num. 5:9, 10; 18:8-20; Deut. 18:1
9:14 b ver. 4; Matt. 10:10
9:15 c See Acts 18:3 d 2 Cor. 11:10
9:16 e [Acts 4:20; 9:6; Rom. 1:14]
9:17 f ch. 4:1; Gal. 2:7; [Phil. 1:16]
9:18 g 2 Cor. 11:7; 12:13
9:19 h ver. 1; [ch. 10:29] i [Gal. 5:13] j Matt. 18:15; 1 Pet. 3:1
9:20 k Acts 16:3; 21:23-26
9:21 l Rom. 2:12, 14 m [Gal. 2:3; 3:2] n See ch. 7:22
9:22 o 2 Cor. 11:29 p ch. 10:33 q ch. 7:16; Rom. 11:14
9:23 r [ch. 10:24]
9:24 s Phil. 3:14; Col. 2:18 t Gal. 2:2; 5:7; Phil. 2:16; Heb. 12:1; [2 Tim. 4:7]
9:25 u 1 Tim. 6:12; 2 Tim. 2:5; 4:7; [Jude 3] v See James 1:12
9:26 w [Heb. 12:4] x [ch. 14:9]
9:27 y [Rom. 6:19] z [Song 1:6] a [Jer. 6:30; Rom. 1:28; Heb. 6:8]
10:1 b See Ex. 13:21 c See Ex. 14:22
10:3 d Ex. 16:15, 35; Deut. 8:3; Neh. 9:15, 20; Ps. 78:24 e Ps. 78:25; 105:40; John 6:31
10:4 f See Ex. 17:6
10:5 g Num. 14:29, 37; 26:64, 65; Ps. 106:26; Heb. 3:17; Jude 5
10:6 h Num. 11:4, 33, 34; Ps. 78:18; 106:14
10:7 i ver. 14 j Ex. 32:4 k Cited from Ex. 32:6
10:8 l See ch. 6:18; Acts 15:20 m Num. 25:1 n [Num. 25:9; Ps. 106:29]
10:9 o Num. 21:5; [Ex. 17:2, 7]; See Ps. 78:18 p See Num. 21:6
10:10 q See Num. 14:2 r Num. 14:29-37 s Ex. 12:23; 2 Sam. 24:16; 1 Chr. 21:15; Ps. 78:49
10:11 t See Rom. 4:23 u See Rom. 13:11
10:12 v Rom. 11:20; [2 Pet. 3:17]
10:13 w See ch. 1:9 x [Dan. 3:17]; See 2 Pet. 2:9
10:14 y ver. 7
10:15 z [ch. 8:1]
10:16 a ch. 11:25; Matt. 26:27, 28 b ch. 11:23, 24; Matt. 26:26; See Acts 2:42; 20:7
10:17 c ch. 12:12, 13, 20; Rom. 12:5; Eph. 4:4, 16; Col. 3:15
10:18 d Rom. 1:3; 4:1; 9:5; 2 Cor. 11:18 e Lev. 3:3; 7:15; [Heb. 13:10]
10:19 f See ch. 8:4
10:20 g Deut. 32:17
10:21 h [2 Cor. 6:15, 16] i [Deut. 32:38] j [Isa. 65:11]
10:22 k Deut. 32:21 l Eccles. 6:10; Ezek. 22:14
10:23 m ch. 6:12; See ch. 8:9
10:24 n ver. 33; ch. 13:5; Phil. 2:21; [ch. 9:23; 2 Cor. 12:14]; See Rom. 15:1
10:25 o ch. 8:7
10:26 p Cited from Ps. 24:1; [Ex. 9:29; 19:5; Deut. 10:14; Job 41:11; Ps. 50:12]
10:27 q Luke 10:8
10:29 r [ch. 8:9-12] s [ch. 9:19; Rom. 14:16]
10:30 t Rom. 14:6; 1 Tim. 4:3, 4
10:31 u Col. 3:17; 1 Pet. 4:11
10:32 v ch. 8:13; Rom. 14:13; 2 Cor. 6:3 w [ch. 11:16]; See Acts 20:28
10:33 x ch. 9:22; [Gal. 1:10] y See ver. 24
11:1 z See ch. 4:16
11:2 a [ch. 4:17; 1 Thess. 3:6] b 2 Thess. 2:15; 3:6 c [1 Thess. 4:1, 2]
11:3 d Eph. 1:22; 4:15; 5:23; Col. 1:18 e See Gen. 3:16 f [ch. 3:23]
11:5 g Luke 2:36; Acts 21:9; [ch. 14:34] h [Num. 5:18] i Deut. 21:12
11:7 j See Gen. 1:26 k [Prov. 12:4]
11:8 l Gen. 2:21-23; [1 Tim. 2:13]
11:9 m Gen. 2:18
11:11 n Gal. 3:28
11:12 o See Rom. 11:36
11:16 p 1 Tim. 6:3, 4 q 2 Thess. 1:4; [1 Thess. 2:14]; See ch. 7:17; 10:32
11:18 r ch. 1:10-12; [ch. 3:3]
11:19 s [Matt. 18:7; Luke 17:1; Acts 20:30; 1 Tim. 4:1; 2 Pet. 2:1] t 1 John 2:19; [Deut. 13:3]
11:21 u [2 Pet. 2:13; Jude 12]
11:22 v See Acts 20:28 w [Prov. 17:5; James 2:6]
11:23 x ch. 15:3; Gal. 1:12 y For ver. 23-25, see Matt. 26:26-28; Mark 14:22-24; Luke 22:19, 20
11:26 z See John 21:22
11:27 a [Num. 9:10, 13] b [John 13:27] c John 6:51, 53-56
11:28 d [2 Cor. 13:5; Gal. 6:4]
11:30 e See Matt. 27:52
11:31 f See 1 John 1:9
11:32 g See Prov. 3:11 h Rom. 5:16
11:34 i ver. 21 j ver. 22 k ch. 7:17; Titus 1:5 l See ch. 4:19
12:1 m ch. 14:1
12:2 n Eph. 2:11, 12; [1 Pet. 4:3]; See ch. 6:11 o 1 Thess. 1:9 p Hab. 2:18, 19; [Ps. 115:5; Isa. 46:7; Jer. 10:5]
12:3 q 1 John 4:2, 3 r See Rom. 9:3 s John 15:26; [Matt. 16:17]; See Rom. 10:9
12:4 t [Heb. 2:4]; See Rom. 12:6 u Eph. 4:4-6
12:5 v Rom. 12:7; [Eph. 4:11] u [See ver. 4 above]
12:6 u [See ver. 4 above]
12:7 w Eph. 4:7; [ch. 14:26; Rom. 12:3]
12:8 x ch. 2:6, 7 y See ch. 1:5
12:9 z ch. 13:2; 2 Cor. 4:13 a ver. 28, 30
12:10 b ver. 28, 29; [Gal. 3:5] c ch. 13:2, 8; 14:1 d [ch. 14:29; 1 John 4:1] e See Mark 16:17 f ver. 30; ch. 14:26
12:11 g [2 Cor. 10:13] h Heb. 2:4
12:12 i See ch. 10:17 j ver. 27
12:13 k [Rom. 6:5; Eph. 2:18] l Gal. 3:28; Col. 3:11; [Eph. 2:13-17] m [John 7:37-39]
12:18 n ver. 28 o ver. 11; [ch. 3:5; Rom. 12:3]
12:26 p Rom. 12:15
12:27 q [Eph. 1:23; 4:12; 5:30; Col. 1:24] r See Rom. 12:5
12:28 s ver. 18 t Eph. 4:11 u Eph. 2:20; 3:5 v ver. 10 w ver. 9 x [Acts 20:35] y [Rom. 12:8; 1 Tim. 5:17; Heb. 13:7, 17, 24]
12:31 z ch. 14:1, 39
13:2 a [ch. 14:1, 39; Matt. 7:22]; See Acts 2:18 b Matt. 17:20; Mark 11:23; [Luke 17:6]
13:3 c [Matt. 6:2] d Dan. 3:28
13:4 e [Prov. 10:12; 17:9; 1 Thess. 5:14; 2 Tim. 2:10; 1 Pet. 4:8] f [2 Cor. 6:6; Gal. 5:22; Eph. 4:32; Col. 3:12] g Acts 7:9 h See ch. 4:6
13:5 i See ch. 10:24 j [Rom. 4:6; 2 Cor. 5:19]
13:6 k [Rom. 1:32; 2 Thess. 2:12] l [2 John 4; 3 John 3, 4]
13:7 m ch. 9:12 e [See ver. 4 above]
13:9 n [ch. 8:2]
13:10 o [John 15:15]
13:12 p James 1:23; [Num. 12:8; Job 36:26; 2 Cor. 3:18; 5:7] q 1 John 3:2; See Matt. 5:8 r See ch. 8:3
14:1 s ch. 16:14 t ch. 12:31 u ch. 12:1 v See ch. 11:4; 13:2
14:2 w ver. 18-23, 27, 28
14:5 x [Num. 11:29]
14:6 y ver. 26; Eph. 1:17 z ver. 26; Acts 2:42; Rom. 6:17
14:8 a [Num. 10:9; Isa. 58:1; Jer. 4:19; Ezek. 33:3-6; Joel 2:1]
14:9 b [ch. 9:26]
14:11 c See Acts 28:2
14:15 d [Eph. 5:19; Col. 3:16; James 5:13] e Ps. 47:7
14:16 f 1 Chr. 16:36; Neh. 5:13; 8:6; Ps. 106:48; Jer. 11:5; 28:6; Rev. 5:14; 7:12; 19:4; [2 Cor. 1:20] g ch. 11:24
14:20 h Eph. 4:14; Heb. 5:12, 13 i [Ps. 131:2; Isa. 28:9; Rom. 16:19]; See Matt. 18:3 j ch. 2:6
14:21 k See John 10:34 l Cited from Isa. 28:11, 12; [Deut. 28:49]
14:23 m [Acts 2:13]
14:25 n [Heb. 4:12] o Luke 17:16 p Isa. 45:14; Zech. 8:23
14:26 q Eph. 5:19 r See ver. 6 s ver. 18 t ver. 5, 13, 27, 28; ch. 12:10, 30 u 2 Cor. 12:19; 13:10; [ch. 12:7]
14:27 s [See ver. 26 above]
14:29 v [ch. 12:10; Job 12:11; 1 John 4:1]
14:30 w [1 Thess. 5:19, 20]
14:33 x [ver. 40] y See ch. 7:17
14:34 z [1 Tim. 2:11, 12] a See 1 Pet. 3:1 b [ver. 21]
14:37 c [2 Cor. 10:7; 1 John 4:6]
14:39 d ch. 12:31
14:40 e [ver. 31, 33] f Col. 2:5
15:1 g [2 Tim. 2:8]; See ch. 3:6 h Rom. 5:2; [2 Cor. 1:24; 1 Pet. 5:12]
15:2 i ch. 1:18 j ch. 11:2; [Heb. 3:6, 14] k Gal. 3:4
15:3 l ch. 11:23; Gal. 1:12 m John 1:29; Gal. 1:4; Heb. 5:1, 3; 1 Pet. 2:24 n Isa. 53; Dan. 9:26; Zech. 13:7; [1 Pet. 1:11]
15:4 o [Hos. 6:2; Matt. 12:40; John 2:22] p Ps. 16:10; Isa. 53:10; [Acts 2:25-32; 13:33-35; 26:22, 23]
15:5 q Luke 24:34 r Mark 16:14; Luke 24:36; John 20:19, 26; Acts 10:41
15:7 s See Acts 12:17 t Luke 24:50; Acts 1:3, 4
15:8 u See ch. 9:1
15:9 v 2 Cor. 12:11; Eph. 3:7, 8; 1 Tim. 1:13-16 w See Acts 8:3
15:10 x 2 Cor. 11:23; 12:11; Col. 1:29 y [ch. 3:6; 2 Cor. 3:5; Phil. 2:13]; See Matt. 10:20
15:12 z [Acts 23:8; 2 Tim. 2:18]
15:13 a 1 Thess. 4:14
15:15 b See Acts 2:24
15:17 c See Rom. 4:25
15:18 d 1 Thess. 4:16; Rev. 14:13
15:19 e [ch. 4:9; 2 Tim. 3:12]
15:20 f 2 Tim. 2:8; 1 Pet. 1:3 g ver. 23; See Acts 26:23
15:21 h See Rom. 5:12 i John 11:25; Rom. 6:23
15:22 j [Rom. 5:14-18]
15:23 k See 1 Thess. 2:19 l ver. 52; 1 Thess. 4:16; See Luke 14:14
15:24 m [Dan. 7:14, 27] n Eph. 1:21
15:25 o See Ps. 110:1
15:26 p 2 Tim. 1:10; [Rev. 20:14; 21:4]
15:27 q Eph. 1:22; Cited from Ps. 8:6; See Matt. 11:27; 28:18
15:28 r Phil. 3:21 s [ch. 3:23; 11:3]
15:30 t 2 Cor. 11:26
15:31 u 1 Thess. 2:19 v Luke 9:23; See Rom. 8:36
15:32 w [2 Cor. 1:8] x Cited from Isa. 22:13; [Isa. 56:12; Luke 12:19]
15:33 y James 1:16 z [ch. 5:6]
15:34 a See Rom. 13:11 b 1 Thess. 4:5 c ch. 6:5; [ch. 4:14]
15:35 d [Ezek. 37:3]
15:36 e John 12:24
15:42 f Dan. 12:3; [Matt. 13:43]
15:43 g Phil. 3:21; Col. 3:4
15:45 h Cited from Gen. 2:7 i Rom. 5:14 j John 5:21; [John 6:33, 39, 40, 54, 57; Rom. 8:2, 10]
15:47 k John 3:31 l [Gen. 2:7; 3:19] m John 3:13, 31
15:48 n [Phil. 3:20]
15:49 o Gen. 5:3 p See Rom. 8:29
15:50 q See Matt. 16:17 r [John 3:3, 5]
15:51 s 1 Thess. 4:15, 17 t Phil. 3:21
15:52 u Matt. 24:31; 1 Thess. 4:16; [Isa. 27:13; Zech. 9:14] v John 5:25, 28; [Luke 20:36]
15:53 w [2 Cor. 5:2-4]
15:54 x Cited from Isa. 25:8; [Heb. 2:14, 15; Rev. 20:14; 21:4]
15:55 y Hos. 13:14
15:56 z Rom. 4:15; 5:13; 7:5, 8, 13
15:57 a [Rom. 8:37; 1 John 5:4]
15:58 b 2 Pet. 3:14 c ch. 16:10; Jer. 48:10; John 6:28 d [Gal. 6:9]; See ch. 3:8
16:1 e See Acts 24:17
16:2 f Acts 20:7; [Rev. 1:10] g 2 Cor. 8:3, 11 h 2 Cor. 9:3
16:3 i [2 Cor. 8:18, 19]
16:5 j See ch. 4:19 k See Acts 16:9 l Acts 19:21
16:6 m ver. 11; See Acts 15:3
16:7 n [2 Cor. 1:15, 16] o ch. 4:19; Acts 18:21; James 4:15
16:8 p See Acts 2:1
16:9 q See Acts 14:27 r Acts 19:9
16:10 s ch. 4:17; [2 Cor. 1:1] t Rom. 16:21; 1 Thess. 3:2; [Phil. 2:20, 22] u See ch. 15:58
16:11 v 1 Tim. 4:12; [Titus 2:15] w ver. 6 x Acts 15:33
16:12 y See Acts 18:24
16:13 z See Matt. 24:42 a Gal. 5:1; Phil. 1:27; 4:1; 1 Thess. 3:8; 2 Thess. 2:15; See ch. 15:1 b 1 Sam. 4:9; 2 Sam. 10:12; Isa. 46:8 c Eph. 3:16; [Eph. 6:10; Col. 1:11]
16:14 d ch. 14:1
16:15 e ch. 1:16 f [Rom. 16:5] g See Rom. 15:31
16:16 h 1 Thess. 5:12; Heb. 13:17
16:17 i Phil. 2:30; [2 Cor. 11:9; Philem. 13]
16:18 j 2 Cor. 7:13; [Rom. 15:32; Philem. 7, 20] k Phil. 2:29; 1 Thess. 5:12
16:19 l See Acts 18:2 m See Rom. 16:5
16:20 n See Rom. 16:16
16:21 o Col. 4:18; 2 Thess. 3:17; [Rom. 16:22; Gal. 6:11; Philem. 19]
16:22 p See Rom. 9:3
16:23 q Rom. 16:20`

// ── Parser ───────────────────────────────────────────────────────────────────

function splitIntoGroups(text) {
  // Prepend a space so the first marker matches the same pattern as inner ones.
  // Split on: (space)(single lowercase letter)(space)(lookahead for ref start)
  // Ref starts: uppercase letter, '[', digit, 'ch.', 'ver.'
  const parts = (' ' + text).split(/ ([a-z]) (?=[A-Z\[0-9]|ch\.|ver\.)/)
  // Result: ['', 'a', 'content...', 'b', 'content...', ...]
  const groups = []
  for (let i = 1; i < parts.length; i += 2) {
    const content = (parts[i + 1] || '').trim()
    if (content) groups.push(content)
  }
  return groups
}

function parseVerseList(s) {
  // "30" → [30], "21, 23, 25" → [21,23,25], "21-25" → [21], "4-6" → [4]
  return s.split(',').map(t => {
    const m = t.trim().match(/^(\d+)/)
    return m ? parseInt(m[1]) : null
  }).filter(v => v !== null)
}

function parseChapterVerse(book, rest) {
  if (!rest || !/\d/.test(rest)) return [{ tgt_book: book, tgt_chapter: null, tgt_verse: null }]
  const colon = rest.indexOf(':')
  if (colon === -1) {
    const m = rest.match(/^(\d+)/)
    return m ? [{ tgt_book: book, tgt_chapter: parseInt(m[1]), tgt_verse: null }] : []
  }
  const ch = parseInt(rest.slice(0, colon))
  const vPart = rest.slice(colon + 1)
  const verses = parseVerseList(vPart)
  if (!verses.length) return [{ tgt_book: book, tgt_chapter: ch, tgt_verse: null }]
  return verses.map(v => ({ tgt_book: book, tgt_chapter: ch, tgt_verse: v }))
}

function parseOneRef(s, srcChapter, lastBook) {
  s = s.trim()
  if (!s) return []

  // Strip "For ver. X-Y, " prefix (e.g. "For ver. 23-25, see Matt...")
  s = s.replace(/^For\s+ver\.\s*[\d,\s-]+,?\s*/i, '')

  // Strip leading qualifier words
  s = s.replace(/^(Cited from|Cited|See)\s+/i, '')

  // Strip surrounding brackets (may be partial after semicolon split)
  s = s.replace(/^\[/, '').replace(/\]$/, '').trim()

  // Strip Greek annotation
  s = s.replace(/\s*\(Gk\.\)\s*/g, '')

  // Strip trailing position words
  s = s.replace(/\s+(above|below)\s*$/i, '').trim()

  if (!s) return []

  // ver. N → same chapter in 1 Corinthians
  if (/^ver\.\s*/i.test(s)) {
    const rest = s.replace(/^ver\.\s*/i, '')
    const verses = parseVerseList(rest)
    return verses.map(v => ({ tgt_book: '1 Corinthians', tgt_chapter: srcChapter, tgt_verse: v }))
  }

  // ch. N:V → 1 Corinthians
  if (/^ch\.\s*/i.test(s)) {
    return parseChapterVerse('1 Corinthians', s.replace(/^ch\.\s*/i, ''))
  }

  // Standalone chapter:verse (e.g. "105:40" continuing Psalms)
  if (/^\d+:\d+/.test(s) && lastBook) {
    return parseChapterVerse(lastBook, s)
  }

  // Book reference — try longest abbreviations first
  for (const abbr of ABBR_SORTED) {
    if (s.startsWith(abbr + ' ') || s === abbr) {
      const rest = s.slice(abbr.length).trim()
      return parseChapterVerse(BOOK_MAP[abbr], rest)
    }
  }

  if (s && s.length > 1) {
    process.stderr.write(`WARN: unparsed ref: "${s}"\n`)
  }
  return []
}

function parseLine(line) {
  const m = line.trim().match(/^(\d+):(\d+)\s+(.+)/)
  if (!m) return []
  const srcChapter = parseInt(m[1])
  const srcVerse   = parseInt(m[2])
  const text       = m[3]

  const groups = splitIntoGroups(text)
  const rows   = []

  for (const groupContent of groups) {
    const refs    = groupContent.split(';')
    let lastBook  = null

    for (const ref of refs) {
      const parsed = parseOneRef(ref, srcChapter, lastBook)
      for (const r of parsed) {
        if (!r.tgt_book || !r.tgt_chapter) continue
        rows.push({
          src_book:    '1 Corinthians',
          src_chapter: srcChapter,
          src_verse:   srcVerse,
          tgt_book:    r.tgt_book,
          tgt_chapter: r.tgt_chapter,
          tgt_verse:   r.tgt_verse ?? null,
        })
        // Track last explicitly named (non-1Cor) book for shorthand refs
        if (r.tgt_book !== '1 Corinthians') lastBook = r.tgt_book
      }
    }
  }

  return rows
}

// ── Build rows ───────────────────────────────────────────────────────────────

const lines   = RAW.split('\n').map(l => l.trim()).filter(l => /^\d+:\d+\s+\S/.test(l))
const allRows = []
for (const line of lines) allRows.push(...parseLine(line))

// Deduplicate
const seen = new Set()
const deduped = []
for (const r of allRows) {
  const key = `${r.src_chapter}:${r.src_verse}|${r.tgt_book}|${r.tgt_chapter}|${r.tgt_verse}`
  if (!seen.has(key)) { seen.add(key); deduped.push(r) }
}

console.log(`Parsed ${deduped.length} unique cross-refs from ${lines.length} source verses.`)

// ── Main ─────────────────────────────────────────────────────────────────────

const serviceRoleKey = process.argv[2]
if (!serviceRoleKey) {
  console.error('\nUsage: node scripts/seed-1cor-xrefs.mjs <service-role-key>')
  console.error('  Get key: Supabase dashboard → Project Settings → API → service_role')
  process.exit(1)
}

const supabase = createClient(SUPABASE_URL, serviceRoleKey, {
  auth: { autoRefreshToken: false, persistSession: false },
})

let inserted = 0
let failed   = 0
const BATCH  = 50

console.log(`Upserting to author_cross_refs in batches of ${BATCH}…\n`)

for (let i = 0; i < deduped.length; i += BATCH) {
  const batch = deduped.slice(i, i + BATCH).map(r => ({
    ...r,
    label:      null,
    updated_at: new Date().toISOString(),
  }))

  const { error } = await supabase
    .from('author_cross_refs')
    .upsert(batch, {
      onConflict:       'src_book,src_chapter,src_verse,tgt_book,tgt_chapter,tgt_verse',
      ignoreDuplicates: false,
    })

  if (error) {
    console.error(`  ✗ batch ${i + 1}–${i + batch.length}: ${error.message}`)
    failed += batch.length
  } else {
    process.stdout.write(`  ✓ ${i + 1}–${i + batch.length}\n`)
    inserted += batch.length
  }
}

console.log(`\nDone. ${inserted} upserted, ${failed} failed.`)
