/**
 * BSB Book Outlines — New Testament (27 books)
 * Source: Berean Study Bible, public domain since April 30, 2023
 *
 * Each entry: { level, title, startCh, startV, endCh, endV }
 *   level 1 = major section (bold, left-aligned)
 *   level 2 = subsection (center-line italic, existing style)
 *   level 3 = sub-subsection (smaller, indented)
 *   level 4 = detail (smallest, indented italic)
 *
 * Inline headings fire at the (startCh, startV) of each entry.
 * The outline page shows all entries in order, indented by level.
 */

export const BIBLE_OUTLINES = {

  // ── Matthew ───────────────────────────────────────────────────
  'Matthew': [
    { level: 1, title: 'The Genealogy and Birth of Jesus',       startCh: 1,  startV: 1,  endCh: 2,  endV: 23 },
    { level: 2, title: 'The Genealogy of Jesus the Messiah',     startCh: 1,  startV: 1,  endCh: 1,  endV: 17 },
    { level: 2, title: 'The Birth of Jesus',                     startCh: 1,  startV: 18, endCh: 1,  endV: 25 },
    { level: 2, title: 'The Visit of the Magi',                  startCh: 2,  startV: 1,  endCh: 2,  endV: 12 },
    { level: 2, title: 'The Flight to Egypt and Return to Nazareth', startCh: 2, startV: 13, endCh: 2, endV: 23 },
    { level: 1, title: 'Preparation for Ministry',               startCh: 3,  startV: 1,  endCh: 4,  endV: 11 },
    { level: 2, title: 'The Ministry of John the Baptist',       startCh: 3,  startV: 1,  endCh: 3,  endV: 12 },
    { level: 2, title: 'The Baptism of Jesus',                   startCh: 3,  startV: 13, endCh: 3,  endV: 17 },
    { level: 2, title: 'The Temptation of Jesus',                startCh: 4,  startV: 1,  endCh: 4,  endV: 11 },
    { level: 1, title: 'Ministry in Galilee',                    startCh: 4,  startV: 12, endCh: 18, endV: 35 },
    { level: 2, title: 'The Beginning of Jesus\' Ministry',      startCh: 4,  startV: 12, endCh: 4,  endV: 25 },
    { level: 2, title: 'The Sermon on the Mount',                startCh: 5,  startV: 1,  endCh: 7,  endV: 29 },
    { level: 3, title: 'The Beatitudes',                         startCh: 5,  startV: 3,  endCh: 5,  endV: 12 },
    { level: 3, title: 'Salt and Light',                         startCh: 5,  startV: 13, endCh: 5,  endV: 16 },
    { level: 3, title: 'The Fulfillment of the Law',             startCh: 5,  startV: 17, endCh: 5,  endV: 48 },
    { level: 3, title: 'Giving, Prayer, and Fasting',            startCh: 6,  startV: 1,  endCh: 6,  endV: 18 },
    { level: 3, title: 'Treasure in Heaven',                     startCh: 6,  startV: 19, endCh: 6,  endV: 34 },
    { level: 3, title: 'Judging Others',                         startCh: 7,  startV: 1,  endCh: 7,  endV: 6  },
    { level: 3, title: 'Ask, Seek, Knock',                       startCh: 7,  startV: 7,  endCh: 7,  endV: 12 },
    { level: 3, title: 'The Narrow and Wide Gates',              startCh: 7,  startV: 13, endCh: 7,  endV: 29 },
    { level: 2, title: 'Miracles and Growing Opposition',        startCh: 8,  startV: 1,  endCh: 12, endV: 50 },
    { level: 3, title: 'Healing the Sick and Casting Out Demons',startCh: 8,  startV: 1,  endCh: 9,  endV: 34 },
    { level: 3, title: 'The Call and Sending of the Twelve',     startCh: 9,  startV: 35, endCh: 10, endV: 42 },
    { level: 3, title: 'John the Baptist and Unbelieving Cities',startCh: 11, startV: 1,  endCh: 11, endV: 30 },
    { level: 3, title: 'Controversies with the Pharisees',       startCh: 12, startV: 1,  endCh: 12, endV: 50 },
    { level: 2, title: 'The Parables of the Kingdom',            startCh: 13, startV: 1,  endCh: 13, endV: 58 },
    { level: 2, title: 'Further Ministry and Teaching',          startCh: 14, startV: 1,  endCh: 18, endV: 35 },
    { level: 3, title: 'Death of John the Baptist; Feeding the Five Thousand', startCh: 14, startV: 1, endCh: 14, endV: 36 },
    { level: 3, title: 'Traditions and True Defilement',         startCh: 15, startV: 1,  endCh: 15, endV: 39 },
    { level: 3, title: 'Confession at Caesarea Philippi',        startCh: 16, startV: 1,  endCh: 16, endV: 28 },
    { level: 3, title: 'The Transfiguration',                    startCh: 17, startV: 1,  endCh: 17, endV: 27 },
    { level: 3, title: 'Teaching on Greatness and Forgiveness',  startCh: 18, startV: 1,  endCh: 18, endV: 35 },
    { level: 1, title: 'Journey to Jerusalem',                   startCh: 19, startV: 1,  endCh: 20, endV: 34 },
    { level: 2, title: 'Teaching on Marriage and Wealth',        startCh: 19, startV: 1,  endCh: 19, endV: 30 },
    { level: 2, title: 'Laborers in the Vineyard and Blind Men', startCh: 20, startV: 1,  endCh: 20, endV: 34 },
    { level: 1, title: 'Passion Week in Jerusalem',              startCh: 21, startV: 1,  endCh: 27, endV: 66 },
    { level: 2, title: 'Triumphal Entry and Temple Cleansing',   startCh: 21, startV: 1,  endCh: 21, endV: 22 },
    { level: 2, title: 'Authority Questioned; Parables of Judgment', startCh: 21, startV: 23, endCh: 22, endV: 46 },
    { level: 2, title: 'Woes to the Scribes and Pharisees',      startCh: 23, startV: 1,  endCh: 23, endV: 39 },
    { level: 2, title: 'The Olivet Discourse',                   startCh: 24, startV: 1,  endCh: 25, endV: 46 },
    { level: 3, title: 'Signs of the End of the Age',            startCh: 24, startV: 1,  endCh: 24, endV: 35 },
    { level: 3, title: 'The Unknown Hour',                       startCh: 24, startV: 36, endCh: 24, endV: 51 },
    { level: 3, title: 'Parables of Readiness and Judgment',     startCh: 25, startV: 1,  endCh: 25, endV: 46 },
    { level: 2, title: 'The Arrest, Trial, and Crucifixion',     startCh: 26, startV: 1,  endCh: 27, endV: 66 },
    { level: 3, title: 'The Plot to Kill Jesus; Anointing at Bethany', startCh: 26, startV: 1, endCh: 26, endV: 16 },
    { level: 3, title: 'The Last Supper',                        startCh: 26, startV: 17, endCh: 26, endV: 35 },
    { level: 3, title: 'Gethsemane and the Arrest',              startCh: 26, startV: 36, endCh: 26, endV: 56 },
    { level: 3, title: 'The Trials of Jesus',                    startCh: 26, startV: 57, endCh: 27, endV: 26 },
    { level: 3, title: 'The Crucifixion and Burial',             startCh: 27, startV: 27, endCh: 27, endV: 66 },
    { level: 1, title: 'The Resurrection and Great Commission',  startCh: 28, startV: 1,  endCh: 28, endV: 20 },
    { level: 2, title: 'The Resurrection',                       startCh: 28, startV: 1,  endCh: 28, endV: 10 },
    { level: 2, title: 'The Report of the Guard',                startCh: 28, startV: 11, endCh: 28, endV: 15 },
    { level: 2, title: 'The Great Commission',                   startCh: 28, startV: 16, endCh: 28, endV: 20 },
  ],

  // ── Mark ──────────────────────────────────────────────────────
  'Mark': [
    { level: 1, title: 'Preparation for Ministry',               startCh: 1,  startV: 1,  endCh: 1,  endV: 13 },
    { level: 2, title: 'John the Baptist',                       startCh: 1,  startV: 1,  endCh: 1,  endV: 8  },
    { level: 2, title: 'Baptism and Temptation of Jesus',        startCh: 1,  startV: 9,  endCh: 1,  endV: 13 },
    { level: 1, title: 'Ministry in Galilee',                    startCh: 1,  startV: 14, endCh: 9,  endV: 50 },
    { level: 2, title: 'Early Galilean Ministry',                startCh: 1,  startV: 14, endCh: 3,  endV: 35 },
    { level: 3, title: 'The Call of the First Disciples',        startCh: 1,  startV: 14, endCh: 1,  endV: 20 },
    { level: 3, title: 'Authority in Word and Deed',             startCh: 1,  startV: 21, endCh: 1,  endV: 45 },
    { level: 3, title: 'Controversies with the Pharisees',       startCh: 2,  startV: 1,  endCh: 3,  endV: 35 },
    { level: 2, title: 'Parables and Miracles',                  startCh: 4,  startV: 1,  endCh: 5,  endV: 43 },
    { level: 3, title: 'Parables of the Kingdom',                startCh: 4,  startV: 1,  endCh: 4,  endV: 34 },
    { level: 3, title: 'Miracles of Power and Healing',          startCh: 4,  startV: 35, endCh: 5,  endV: 43 },
    { level: 2, title: 'Expanding Ministry',                     startCh: 6,  startV: 1,  endCh: 8,  endV: 26 },
    { level: 3, title: 'Rejection at Nazareth; Mission of the Twelve', startCh: 6, startV: 1, endCh: 6, endV: 30 },
    { level: 3, title: 'Feeding the Five Thousand',              startCh: 6,  startV: 31, endCh: 6,  endV: 56 },
    { level: 3, title: 'True Defilement; Gentile Ministry',      startCh: 7,  startV: 1,  endCh: 8,  endV: 26 },
    { level: 2, title: 'The Way of the Cross',                   startCh: 8,  startV: 27, endCh: 9,  endV: 50 },
    { level: 3, title: 'Peter\'s Confession at Caesarea Philippi',startCh: 8, startV: 27, endCh: 8,  endV: 38 },
    { level: 3, title: 'The Transfiguration',                    startCh: 9,  startV: 1,  endCh: 9,  endV: 29 },
    { level: 3, title: 'Teaching on Service and Temptation',     startCh: 9,  startV: 30, endCh: 9,  endV: 50 },
    { level: 1, title: 'Journey to Jerusalem',                   startCh: 10, startV: 1,  endCh: 10, endV: 52 },
    { level: 2, title: 'Teaching on Marriage, Wealth, and Greatness', startCh: 10, startV: 1, endCh: 10, endV: 45 },
    { level: 2, title: 'Healing of Blind Bartimaeus',            startCh: 10, startV: 46, endCh: 10, endV: 52 },
    { level: 1, title: 'Passion Week in Jerusalem',              startCh: 11, startV: 1,  endCh: 15, endV: 47 },
    { level: 2, title: 'Triumphal Entry and Temple Cleansing',   startCh: 11, startV: 1,  endCh: 11, endV: 26 },
    { level: 2, title: 'Controversies in the Temple',            startCh: 11, startV: 27, endCh: 12, endV: 44 },
    { level: 2, title: 'The Olivet Discourse',                   startCh: 13, startV: 1,  endCh: 13, endV: 37 },
    { level: 2, title: 'The Passion Narrative',                  startCh: 14, startV: 1,  endCh: 15, endV: 47 },
    { level: 3, title: 'The Anointing, the Last Supper, and Gethsemane', startCh: 14, startV: 1, endCh: 14, endV: 52 },
    { level: 3, title: 'Arrest, Trial, and Crucifixion',         startCh: 14, startV: 53, endCh: 15, endV: 47 },
    { level: 1, title: 'The Resurrection',                       startCh: 16, startV: 1,  endCh: 16, endV: 20 },
  ],

  // ── Luke ──────────────────────────────────────────────────────
  'Luke': [
    { level: 1, title: 'Prologue',                               startCh: 1,  startV: 1,  endCh: 1,  endV: 4  },
    { level: 1, title: 'The Birth Narrative',                    startCh: 1,  startV: 5,  endCh: 2,  endV: 52 },
    { level: 2, title: 'The Annunciations',                      startCh: 1,  startV: 5,  endCh: 1,  endV: 56 },
    { level: 3, title: 'Announcement of John\'s Birth',          startCh: 1,  startV: 5,  endCh: 1,  endV: 25 },
    { level: 3, title: 'Announcement of Jesus\' Birth',          startCh: 1,  startV: 26, endCh: 1,  endV: 38 },
    { level: 3, title: 'Mary\'s Visit to Elizabeth; the Magnificat', startCh: 1, startV: 39, endCh: 1, endV: 56 },
    { level: 2, title: 'The Birth of John the Baptist',          startCh: 1,  startV: 57, endCh: 1,  endV: 80 },
    { level: 2, title: 'The Birth of Jesus',                     startCh: 2,  startV: 1,  endCh: 2,  endV: 20 },
    { level: 2, title: 'Presentation in the Temple',             startCh: 2,  startV: 21, endCh: 2,  endV: 40 },
    { level: 2, title: 'The Boy Jesus in the Temple',            startCh: 2,  startV: 41, endCh: 2,  endV: 52 },
    { level: 1, title: 'Preparation for Ministry',               startCh: 3,  startV: 1,  endCh: 4,  endV: 13 },
    { level: 2, title: 'The Ministry of John the Baptist',       startCh: 3,  startV: 1,  endCh: 3,  endV: 20 },
    { level: 2, title: 'The Baptism and Genealogy of Jesus',     startCh: 3,  startV: 21, endCh: 3,  endV: 38 },
    { level: 2, title: 'The Temptation of Jesus',                startCh: 4,  startV: 1,  endCh: 4,  endV: 13 },
    { level: 1, title: 'Ministry in Galilee',                    startCh: 4,  startV: 14, endCh: 9,  endV: 50 },
    { level: 2, title: 'Early Galilean Ministry',                startCh: 4,  startV: 14, endCh: 5,  endV: 39 },
    { level: 3, title: 'Rejection at Nazareth',                  startCh: 4,  startV: 14, endCh: 4,  endV: 30 },
    { level: 3, title: 'Healings and the Call of the Disciples', startCh: 4,  startV: 31, endCh: 5,  endV: 39 },
    { level: 2, title: 'Controversies and the Sermon on the Plain', startCh: 6, startV: 1, endCh: 6, endV: 49 },
    { level: 2, title: 'Miracles and Expanding Ministry',        startCh: 7,  startV: 1,  endCh: 8,  endV: 56 },
    { level: 2, title: 'The Mission of the Twelve and Peter\'s Confession', startCh: 9, startV: 1, endCh: 9, endV: 50 },
    { level: 1, title: 'The Journey to Jerusalem',               startCh: 9,  startV: 51, endCh: 19, endV: 44 },
    { level: 2, title: 'Early Teaching on Discipleship',         startCh: 9,  startV: 51, endCh: 11, endV: 54 },
    { level: 2, title: 'Teaching on Watchfulness and Repentance',startCh: 12, startV: 1,  endCh: 13, endV: 35 },
    { level: 2, title: 'Banquet Teachings and Parables of the Lost', startCh: 13, startV: 36, endCh: 15, endV: 32 },
    { level: 3, title: 'The Lost Sheep, Coin, and Son',          startCh: 15, startV: 1,  endCh: 15, endV: 32 },
    { level: 2, title: 'Teaching on Wealth and the Kingdom',     startCh: 16, startV: 1,  endCh: 17, endV: 37 },
    { level: 2, title: 'Persistent Prayer; Faith and Humility',  startCh: 18, startV: 1,  endCh: 18, endV: 43 },
    { level: 2, title: 'Zacchaeus and the Entry into Jerusalem', startCh: 19, startV: 1,  endCh: 19, endV: 44 },
    { level: 1, title: 'Ministry in Jerusalem',                  startCh: 19, startV: 45, endCh: 21, endV: 38 },
    { level: 2, title: 'Temple Cleansing and Controversies',     startCh: 19, startV: 45, endCh: 20, endV: 47 },
    { level: 2, title: 'The Olivet Discourse',                   startCh: 21, startV: 1,  endCh: 21, endV: 38 },
    { level: 1, title: 'The Passion, Death, and Resurrection',   startCh: 22, startV: 1,  endCh: 24, endV: 53 },
    { level: 2, title: 'The Last Supper and Gethsemane',         startCh: 22, startV: 1,  endCh: 22, endV: 53 },
    { level: 2, title: 'The Arrest and Trials',                  startCh: 22, startV: 54, endCh: 23, endV: 25 },
    { level: 2, title: 'The Crucifixion and Burial',             startCh: 23, startV: 26, endCh: 23, endV: 56 },
    { level: 2, title: 'The Resurrection and Appearances',       startCh: 24, startV: 1,  endCh: 24, endV: 53 },
    { level: 3, title: 'The Empty Tomb',                         startCh: 24, startV: 1,  endCh: 24, endV: 12 },
    { level: 3, title: 'The Road to Emmaus',                     startCh: 24, startV: 13, endCh: 24, endV: 35 },
    { level: 3, title: 'Jesus Appears to the Disciples; the Ascension', startCh: 24, startV: 36, endCh: 24, endV: 53 },
  ],

  // ── John ──────────────────────────────────────────────────────
  'John': [
    { level: 1, title: 'Prologue: The Word Made Flesh',          startCh: 1,  startV: 1,  endCh: 1,  endV: 18 },
    { level: 1, title: 'The Book of Signs',                      startCh: 1,  startV: 19, endCh: 12, endV: 50 },
    { level: 2, title: 'Witness and First Disciples',            startCh: 1,  startV: 19, endCh: 1,  endV: 51 },
    { level: 2, title: 'Signs and Discourse: Water to Wine and Temple Cleansing', startCh: 2, startV: 1, endCh: 2, endV: 25 },
    { level: 2, title: 'Discourse with Nicodemus',               startCh: 3,  startV: 1,  endCh: 3,  endV: 36 },
    { level: 2, title: 'The Samaritan Woman at the Well',        startCh: 4,  startV: 1,  endCh: 4,  endV: 42 },
    { level: 2, title: 'Healing and Discourse at Bethesda',      startCh: 4,  startV: 43, endCh: 5,  endV: 47 },
    { level: 2, title: 'The Bread of Life Discourse',            startCh: 6,  startV: 1,  endCh: 6,  endV: 71 },
    { level: 2, title: 'Controversy at the Feast of Tabernacles',startCh: 7,  startV: 1,  endCh: 8,  endV: 59 },
    { level: 2, title: 'The Man Born Blind',                     startCh: 9,  startV: 1,  endCh: 9,  endV: 41 },
    { level: 2, title: 'The Good Shepherd Discourse',            startCh: 10, startV: 1,  endCh: 10, endV: 42 },
    { level: 2, title: 'The Raising of Lazarus',                 startCh: 11, startV: 1,  endCh: 11, endV: 57 },
    { level: 2, title: 'The Anointing at Bethany and Triumphal Entry', startCh: 12, startV: 1, endCh: 12, endV: 50 },
    { level: 1, title: 'The Book of Glory',                      startCh: 13, startV: 1,  endCh: 20, endV: 31 },
    { level: 2, title: 'The Upper Room Discourse',               startCh: 13, startV: 1,  endCh: 17, endV: 26 },
    { level: 3, title: 'The Washing of Feet',                    startCh: 13, startV: 1,  endCh: 13, endV: 20 },
    { level: 3, title: 'The Betrayer Announced',                 startCh: 13, startV: 21, endCh: 13, endV: 38 },
    { level: 3, title: 'The Way, the Truth, and the Life',       startCh: 14, startV: 1,  endCh: 14, endV: 31 },
    { level: 3, title: 'The Vine and the Branches',              startCh: 15, startV: 1,  endCh: 15, endV: 27 },
    { level: 3, title: 'The Work of the Holy Spirit',            startCh: 16, startV: 1,  endCh: 16, endV: 33 },
    { level: 3, title: 'The High Priestly Prayer',               startCh: 17, startV: 1,  endCh: 17, endV: 26 },
    { level: 2, title: 'The Passion Narrative',                  startCh: 18, startV: 1,  endCh: 19, endV: 42 },
    { level: 3, title: 'The Arrest and Trials',                  startCh: 18, startV: 1,  endCh: 18, endV: 40 },
    { level: 3, title: 'The Sentencing',                         startCh: 19, startV: 1,  endCh: 19, endV: 16 },
    { level: 3, title: 'The Crucifixion and Burial',             startCh: 19, startV: 17, endCh: 19, endV: 42 },
    { level: 2, title: 'The Resurrection Appearances',           startCh: 20, startV: 1,  endCh: 20, endV: 31 },
    { level: 3, title: 'The Empty Tomb',                         startCh: 20, startV: 1,  endCh: 20, endV: 10 },
    { level: 3, title: 'Mary Magdalene; Thomas',                 startCh: 20, startV: 11, endCh: 20, endV: 31 },
    { level: 1, title: 'Epilogue',                               startCh: 21, startV: 1,  endCh: 21, endV: 25 },
    { level: 2, title: 'The Appearance at the Sea of Galilee',   startCh: 21, startV: 1,  endCh: 21, endV: 14 },
    { level: 2, title: 'The Restoration of Peter',               startCh: 21, startV: 15, endCh: 21, endV: 25 },
  ],

  // ── Acts ──────────────────────────────────────────────────────
  'Acts': [
    { level: 1, title: 'Prologue and Preparation',               startCh: 1,  startV: 1,  endCh: 1,  endV: 26 },
    { level: 2, title: 'The Promise of the Spirit; the Ascension',startCh: 1, startV: 1,  endCh: 1,  endV: 11 },
    { level: 2, title: 'Matthias Chosen',                        startCh: 1,  startV: 12, endCh: 1,  endV: 26 },
    { level: 1, title: 'The Church in Jerusalem',                startCh: 2,  startV: 1,  endCh: 7,  endV: 60 },
    { level: 2, title: 'Pentecost and the Birth of the Church',  startCh: 2,  startV: 1,  endCh: 2,  endV: 47 },
    { level: 2, title: 'Healing and Preaching in the Temple',    startCh: 3,  startV: 1,  endCh: 4,  endV: 31 },
    { level: 2, title: 'Community Life and Early Opposition',    startCh: 4,  startV: 32, endCh: 5,  endV: 42 },
    { level: 2, title: 'The Seven and Stephen\'s Martyrdom',     startCh: 6,  startV: 1,  endCh: 7,  endV: 60 },
    { level: 1, title: 'The Church Scattered',                   startCh: 8,  startV: 1,  endCh: 12, endV: 25 },
    { level: 2, title: 'Philip\'s Ministry in Samaria',          startCh: 8,  startV: 1,  endCh: 8,  endV: 40 },
    { level: 2, title: 'The Conversion of Saul',                 startCh: 9,  startV: 1,  endCh: 9,  endV: 31 },
    { level: 2, title: 'Peter\'s Ministry and the Gentiles',     startCh: 9,  startV: 32, endCh: 11, endV: 30 },
    { level: 3, title: 'Aeneas and Tabitha',                     startCh: 9,  startV: 32, endCh: 9,  endV: 43 },
    { level: 3, title: 'Cornelius and the Opening to the Gentiles', startCh: 10, startV: 1, endCh: 11, endV: 18 },
    { level: 3, title: 'The Church at Antioch',                  startCh: 11, startV: 19, endCh: 11, endV: 30 },
    { level: 2, title: 'Persecution and the Herodian Crisis',    startCh: 12, startV: 1,  endCh: 12, endV: 25 },
    { level: 1, title: 'The First Missionary Journey',           startCh: 13, startV: 1,  endCh: 14, endV: 28 },
    { level: 2, title: 'Cyprus and Pisidian Antioch',            startCh: 13, startV: 1,  endCh: 13, endV: 52 },
    { level: 2, title: 'Iconium, Lystra, and Return',            startCh: 14, startV: 1,  endCh: 14, endV: 28 },
    { level: 1, title: 'The Jerusalem Council',                  startCh: 15, startV: 1,  endCh: 15, endV: 35 },
    { level: 1, title: 'The Second Missionary Journey',          startCh: 15, startV: 36, endCh: 18, endV: 22 },
    { level: 2, title: 'Into Macedonia: Philippi',               startCh: 15, startV: 36, endCh: 16, endV: 40 },
    { level: 2, title: 'Thessalonica, Berea, and Athens',        startCh: 17, startV: 1,  endCh: 17, endV: 34 },
    { level: 2, title: 'Corinth and Return',                     startCh: 18, startV: 1,  endCh: 18, endV: 22 },
    { level: 1, title: 'The Third Missionary Journey',           startCh: 18, startV: 23, endCh: 21, endV: 16 },
    { level: 2, title: 'Ephesus: Revival and Riot',              startCh: 18, startV: 23, endCh: 19, endV: 41 },
    { level: 2, title: 'Macedonia, Greece, and Farewell to Ephesus', startCh: 20, startV: 1, endCh: 20, endV: 38 },
    { level: 2, title: 'The Journey to Jerusalem',               startCh: 21, startV: 1,  endCh: 21, endV: 16 },
    { level: 1, title: 'Paul in Jerusalem and Caesarea',         startCh: 21, startV: 17, endCh: 26, endV: 32 },
    { level: 2, title: 'Arrest in Jerusalem',                    startCh: 21, startV: 17, endCh: 23, endV: 22 },
    { level: 2, title: 'Transfer to Caesarea; Trials before Felix and Festus', startCh: 23, startV: 23, endCh: 25, endV: 27 },
    { level: 2, title: 'Defense before Agrippa',                 startCh: 26, startV: 1,  endCh: 26, endV: 32 },
    { level: 1, title: 'Paul\'s Journey to Rome',                startCh: 27, startV: 1,  endCh: 28, endV: 31 },
    { level: 2, title: 'The Shipwreck at Malta',                 startCh: 27, startV: 1,  endCh: 28, endV: 10 },
    { level: 2, title: 'Arrival in Rome',                        startCh: 28, startV: 11, endCh: 28, endV: 31 },
  ],

  // ── Romans ────────────────────────────────────────────────────
  'Romans': [
    { level: 1, title: 'Introduction',                           startCh: 1,  startV: 1,  endCh: 1,  endV: 17 },
    { level: 2, title: 'Salutation',                             startCh: 1,  startV: 1,  endCh: 1,  endV: 7  },
    { level: 2, title: 'Paul\'s Desire to Visit Rome',           startCh: 1,  startV: 8,  endCh: 1,  endV: 17 },
    { level: 1, title: 'The Righteousness of God in Judgment',   startCh: 1,  startV: 18, endCh: 3,  endV: 20 },
    { level: 2, title: 'The Wrath of God against the Gentiles',  startCh: 1,  startV: 18, endCh: 1,  endV: 32 },
    { level: 2, title: 'The Guilt of the Moralist',              startCh: 2,  startV: 1,  endCh: 2,  endV: 16 },
    { level: 2, title: 'The Guilt of Israel',                    startCh: 2,  startV: 17, endCh: 3,  endV: 8  },
    { level: 2, title: 'All Humanity under Sin',                 startCh: 3,  startV: 9,  endCh: 3,  endV: 20 },
    { level: 1, title: 'The Righteousness of God in the Gospel', startCh: 3,  startV: 21, endCh: 5,  endV: 21 },
    { level: 2, title: 'Justification by Faith',                 startCh: 3,  startV: 21, endCh: 3,  endV: 31 },
    { level: 2, title: 'Abraham Justified by Faith',             startCh: 4,  startV: 1,  endCh: 4,  endV: 25 },
    { level: 2, title: 'The Fruits of Justification',            startCh: 5,  startV: 1,  endCh: 5,  endV: 11 },
    { level: 2, title: 'Adam and Christ',                        startCh: 5,  startV: 12, endCh: 5,  endV: 21 },
    { level: 1, title: 'The Righteousness of God in Sanctification', startCh: 6, startV: 1, endCh: 8, endV: 39 },
    { level: 2, title: 'Dead to Sin, Alive to God',              startCh: 6,  startV: 1,  endCh: 6,  endV: 23 },
    { level: 2, title: 'Released from the Law',                  startCh: 7,  startV: 1,  endCh: 7,  endV: 25 },
    { level: 2, title: 'Life in the Spirit',                     startCh: 8,  startV: 1,  endCh: 8,  endV: 39 },
    { level: 3, title: 'No Condemnation in Christ',              startCh: 8,  startV: 1,  endCh: 8,  endV: 17 },
    { level: 3, title: 'Future Glory and the Spirit\'s Intercession', startCh: 8, startV: 18, endCh: 8, endV: 30 },
    { level: 3, title: 'More than Conquerors',                   startCh: 8,  startV: 31, endCh: 8,  endV: 39 },
    { level: 1, title: 'The Righteousness of God and Israel',    startCh: 9,  startV: 1,  endCh: 11, endV: 36 },
    { level: 2, title: 'The Sovereignty of God\'s Election',     startCh: 9,  startV: 1,  endCh: 9,  endV: 33 },
    { level: 2, title: 'Israel\'s Rejection and the Righteousness of Faith', startCh: 10, startV: 1, endCh: 10, endV: 21 },
    { level: 2, title: 'The Remnant of Israel and the Grafted Branches', startCh: 11, startV: 1, endCh: 11, endV: 36 },
    { level: 1, title: 'The Righteousness of God in Practice',   startCh: 12, startV: 1,  endCh: 15, endV: 13 },
    { level: 2, title: 'Living Sacrifices; Gifts and Service',   startCh: 12, startV: 1,  endCh: 12, endV: 21 },
    { level: 2, title: 'Governing Authorities; Love and the Day', startCh: 13, startV: 1, endCh: 13, endV: 14 },
    { level: 2, title: 'The Strong and the Weak',                startCh: 14, startV: 1,  endCh: 15, endV: 13 },
    { level: 1, title: 'Conclusion',                             startCh: 15, startV: 14, endCh: 16, endV: 27 },
    { level: 2, title: 'Paul\'s Missionary Plans',               startCh: 15, startV: 14, endCh: 15, endV: 33 },
    { level: 2, title: 'Final Greetings and Doxology',           startCh: 16, startV: 1,  endCh: 16, endV: 27 },
  ],

  // ── 1 Corinthians ─────────────────────────────────────────────
  '1 Corinthians': [
    { level: 1, title: 'Introduction',                           startCh: 1,  startV: 1,  endCh: 1,  endV: 9  },
    { level: 1, title: 'Divisions and the Wisdom of God',        startCh: 1,  startV: 10, endCh: 4,  endV: 21 },
    { level: 2, title: 'Quarrels and the Cross',                 startCh: 1,  startV: 10, endCh: 1,  endV: 31 },
    { level: 2, title: 'Christ Crucified: Wisdom and Power',     startCh: 2,  startV: 1,  endCh: 2,  endV: 16 },
    { level: 2, title: 'Servants and Stewards',                  startCh: 3,  startV: 1,  endCh: 4,  endV: 21 },
    { level: 1, title: 'Moral Disorders in the Church',          startCh: 5,  startV: 1,  endCh: 6,  endV: 20 },
    { level: 2, title: 'Sexual Immorality and Church Discipline',startCh: 5,  startV: 1,  endCh: 5,  endV: 13 },
    { level: 2, title: 'Lawsuits among Believers',               startCh: 6,  startV: 1,  endCh: 6,  endV: 11 },
    { level: 2, title: 'Honor God with Your Body',               startCh: 6,  startV: 12, endCh: 6,  endV: 20 },
    { level: 1, title: 'Questions from Corinth',                 startCh: 7,  startV: 1,  endCh: 11, endV: 34 },
    { level: 2, title: 'On Marriage and Celibacy',               startCh: 7,  startV: 1,  endCh: 7,  endV: 40 },
    { level: 2, title: 'Food Offered to Idols',                  startCh: 8,  startV: 1,  endCh: 8,  endV: 13 },
    { level: 2, title: 'Paul\'s Example of Apostolic Rights',    startCh: 9,  startV: 1,  endCh: 9,  endV: 27 },
    { level: 2, title: 'Warnings from Israel\'s History',        startCh: 10, startV: 1,  endCh: 10, endV: 33 },
    { level: 2, title: 'Head Coverings; The Lord\'s Supper',     startCh: 11, startV: 1,  endCh: 11, endV: 34 },
    { level: 1, title: 'Spiritual Gifts and the Body',           startCh: 12, startV: 1,  endCh: 14, endV: 40 },
    { level: 2, title: 'One Body, Many Members',                 startCh: 12, startV: 1,  endCh: 12, endV: 31 },
    { level: 2, title: 'The Way of Love',                        startCh: 13, startV: 1,  endCh: 13, endV: 13 },
    { level: 2, title: 'Tongues and Prophecy in Worship',        startCh: 14, startV: 1,  endCh: 14, endV: 40 },
    { level: 1, title: 'The Resurrection',                       startCh: 15, startV: 1,  endCh: 15, endV: 58 },
    { level: 2, title: 'Christ\'s Resurrection and Ours',        startCh: 15, startV: 1,  endCh: 15, endV: 34 },
    { level: 2, title: 'The Resurrection Body',                  startCh: 15, startV: 35, endCh: 15, endV: 58 },
    { level: 1, title: 'Conclusion',                             startCh: 16, startV: 1,  endCh: 16, endV: 24 },
  ],

  // ── 2 Corinthians ─────────────────────────────────────────────
  '2 Corinthians': [
    { level: 1, title: 'Introduction',                           startCh: 1,  startV: 1,  endCh: 1,  endV: 11 },
    { level: 1, title: 'Paul\'s Defense of His Ministry',        startCh: 1,  startV: 12, endCh: 7,  endV: 16 },
    { level: 2, title: 'The Changed Travel Plans',               startCh: 1,  startV: 12, endCh: 2,  endV: 17 },
    { level: 2, title: 'Ministers of the New Covenant',          startCh: 3,  startV: 1,  endCh: 5,  endV: 21 },
    { level: 3, title: 'Letters of Recommendation; the Veil Removed', startCh: 3, startV: 1, endCh: 3, endV: 18 },
    { level: 3, title: 'Treasure in Jars of Clay',               startCh: 4,  startV: 1,  endCh: 4,  endV: 18 },
    { level: 3, title: 'Longing for the Heavenly Dwelling',      startCh: 5,  startV: 1,  endCh: 5,  endV: 21 },
    { level: 2, title: 'The Appeal for Reconciliation',          startCh: 6,  startV: 1,  endCh: 7,  endV: 16 },
    { level: 1, title: 'The Collection for Jerusalem',           startCh: 8,  startV: 1,  endCh: 9,  endV: 15 },
    { level: 2, title: 'The Example of the Macedonians',         startCh: 8,  startV: 1,  endCh: 8,  endV: 24 },
    { level: 2, title: 'Exhortation to Generous Giving',         startCh: 9,  startV: 1,  endCh: 9,  endV: 15 },
    { level: 1, title: 'Paul\'s Apostolic Authority',            startCh: 10, startV: 1,  endCh: 13, endV: 14 },
    { level: 2, title: 'Paul\'s Defense against His Opponents',  startCh: 10, startV: 1,  endCh: 11, endV: 33 },
    { level: 2, title: 'Paul\'s Visions and His Thorn',          startCh: 12, startV: 1,  endCh: 12, endV: 21 },
    { level: 2, title: 'Final Warnings and Greetings',           startCh: 13, startV: 1,  endCh: 13, endV: 14 },
  ],

  // ── Galatians ─────────────────────────────────────────────────
  'Galatians': [
    { level: 1, title: 'Introduction',                           startCh: 1,  startV: 1,  endCh: 1,  endV: 10 },
    { level: 1, title: 'Paul\'s Defense of His Apostleship',     startCh: 1,  startV: 11, endCh: 2,  endV: 21 },
    { level: 2, title: 'The Gospel Received by Revelation',      startCh: 1,  startV: 11, endCh: 1,  endV: 24 },
    { level: 2, title: 'Accepted by the Jerusalem Apostles',     startCh: 2,  startV: 1,  endCh: 2,  endV: 10 },
    { level: 2, title: 'Confronting Peter at Antioch',           startCh: 2,  startV: 11, endCh: 2,  endV: 21 },
    { level: 1, title: 'Justification by Faith, Not the Law',    startCh: 3,  startV: 1,  endCh: 4,  endV: 31 },
    { level: 2, title: 'The Foolish Galatians; Abraham\'s Faith',startCh: 3,  startV: 1,  endCh: 3,  endV: 29 },
    { level: 2, title: 'Heirs through Faith; Hagar and Sarah',   startCh: 4,  startV: 1,  endCh: 4,  endV: 31 },
    { level: 1, title: 'Life in the Spirit',                     startCh: 5,  startV: 1,  endCh: 6,  endV: 18 },
    { level: 2, title: 'Freedom in Christ; the Fruit of the Spirit', startCh: 5, startV: 1, endCh: 5, endV: 26 },
    { level: 2, title: 'Bearing One Another\'s Burdens',         startCh: 6,  startV: 1,  endCh: 6,  endV: 18 },
  ],

  // ── Ephesians ─────────────────────────────────────────────────
  'Ephesians': [
    { level: 1, title: 'Introduction',                           startCh: 1,  startV: 1,  endCh: 1,  endV: 2  },
    { level: 1, title: 'Blessings in Christ',                    startCh: 1,  startV: 3,  endCh: 3,  endV: 21 },
    { level: 2, title: 'Every Spiritual Blessing',               startCh: 1,  startV: 3,  endCh: 1,  endV: 23 },
    { level: 2, title: 'Made Alive in Christ',                   startCh: 2,  startV: 1,  endCh: 2,  endV: 22 },
    { level: 3, title: 'Saved by Grace through Faith',           startCh: 2,  startV: 1,  endCh: 2,  endV: 10 },
    { level: 3, title: 'One in Christ Jesus',                    startCh: 2,  startV: 11, endCh: 2,  endV: 22 },
    { level: 2, title: 'The Mystery of Christ; Paul\'s Prayer',  startCh: 3,  startV: 1,  endCh: 3,  endV: 21 },
    { level: 1, title: 'Walking Worthy of the Calling',          startCh: 4,  startV: 1,  endCh: 6,  endV: 24 },
    { level: 2, title: 'Unity in the Body of Christ',            startCh: 4,  startV: 1,  endCh: 4,  endV: 16 },
    { level: 2, title: 'The Old Self and the New',               startCh: 4,  startV: 17, endCh: 4,  endV: 32 },
    { level: 2, title: 'Walk in Love, Light, and Wisdom',        startCh: 5,  startV: 1,  endCh: 5,  endV: 21 },
    { level: 2, title: 'Household Relationships',                startCh: 5,  startV: 22, endCh: 6,  endV: 9  },
    { level: 2, title: 'The Armor of God',                       startCh: 6,  startV: 10, endCh: 6,  endV: 24 },
  ],

  // ── Philippians ───────────────────────────────────────────────
  'Philippians': [
    { level: 1, title: 'Introduction',                           startCh: 1,  startV: 1,  endCh: 1,  endV: 11 },
    { level: 1, title: 'Paul\'s Situation and Joy',              startCh: 1,  startV: 12, endCh: 1,  endV: 30 },
    { level: 1, title: 'The Mind of Christ',                     startCh: 2,  startV: 1,  endCh: 2,  endV: 30 },
    { level: 2, title: 'Humility and the Kenosis',               startCh: 2,  startV: 1,  endCh: 2,  endV: 11 },
    { level: 2, title: 'Shine as Lights; Timothy and Epaphroditus', startCh: 2, startV: 12, endCh: 2, endV: 30 },
    { level: 1, title: 'Righteousness through Faith',            startCh: 3,  startV: 1,  endCh: 3,  endV: 21 },
    { level: 2, title: 'All Loss for Christ',                    startCh: 3,  startV: 1,  endCh: 3,  endV: 11 },
    { level: 2, title: 'Press On; Citizens of Heaven',           startCh: 3,  startV: 12, endCh: 3,  endV: 21 },
    { level: 1, title: 'Peace and Contentment',                  startCh: 4,  startV: 1,  endCh: 4,  endV: 23 },
    { level: 2, title: 'The Peace of God',                       startCh: 4,  startV: 1,  endCh: 4,  endV: 9  },
    { level: 2, title: 'The Secret of Contentment; Greetings',   startCh: 4,  startV: 10, endCh: 4,  endV: 23 },
  ],

  // ── Colossians ────────────────────────────────────────────────
  'Colossians': [
    { level: 1, title: 'Introduction',                           startCh: 1,  startV: 1,  endCh: 1,  endV: 14 },
    { level: 1, title: 'The Supremacy of Christ',                startCh: 1,  startV: 15, endCh: 2,  endV: 23 },
    { level: 2, title: 'Christ the Image of God; Head of the Church', startCh: 1, startV: 15, endCh: 1, endV: 29 },
    { level: 2, title: 'Fullness in Christ; Warning against False Teaching', startCh: 2, startV: 1, endCh: 2, endV: 23 },
    { level: 1, title: 'Life Hidden with Christ',                startCh: 3,  startV: 1,  endCh: 4,  endV: 18 },
    { level: 2, title: 'Put Off the Old; Put On the New',        startCh: 3,  startV: 1,  endCh: 3,  endV: 17 },
    { level: 2, title: 'Household Rules and Final Greetings',    startCh: 3,  startV: 18, endCh: 4,  endV: 18 },
  ],

  // ── 1 Thessalonians ───────────────────────────────────────────
  '1 Thessalonians': [
    { level: 1, title: 'Introduction',                           startCh: 1,  startV: 1,  endCh: 1,  endV: 10 },
    { level: 1, title: 'Paul\'s Ministry among the Thessalonians',startCh: 2,  startV: 1,  endCh: 3,  endV: 13 },
    { level: 2, title: 'Paul\'s Conduct and Concern',            startCh: 2,  startV: 1,  endCh: 2,  endV: 20 },
    { level: 2, title: 'Timothy\'s Report',                      startCh: 3,  startV: 1,  endCh: 3,  endV: 13 },
    { level: 1, title: 'Instruction in Holiness and Hope',       startCh: 4,  startV: 1,  endCh: 5,  endV: 28 },
    { level: 2, title: 'Sexual Purity; Love for One Another',    startCh: 4,  startV: 1,  endCh: 4,  endV: 12 },
    { level: 2, title: 'The Coming of the Lord',                 startCh: 4,  startV: 13, endCh: 4,  endV: 18 },
    { level: 2, title: 'The Day of the Lord',                    startCh: 5,  startV: 1,  endCh: 5,  endV: 11 },
    { level: 2, title: 'Final Exhortations',                     startCh: 5,  startV: 12, endCh: 5,  endV: 28 },
  ],

  // ── 2 Thessalonians ───────────────────────────────────────────
  '2 Thessalonians': [
    { level: 1, title: 'Introduction',                           startCh: 1,  startV: 1,  endCh: 1,  endV: 4  },
    { level: 1, title: 'The Righteous Judgment of God',          startCh: 1,  startV: 5,  endCh: 1,  endV: 12 },
    { level: 1, title: 'The Man of Lawlessness',                 startCh: 2,  startV: 1,  endCh: 2,  endV: 17 },
    { level: 2, title: 'The Coming Rebellion',                   startCh: 2,  startV: 1,  endCh: 2,  endV: 12 },
    { level: 2, title: 'Stand Firm; Prayer',                     startCh: 2,  startV: 13, endCh: 2,  endV: 17 },
    { level: 1, title: 'Instruction on Idleness and Conclusion', startCh: 3,  startV: 1,  endCh: 3,  endV: 18 },
  ],

  // ── 1 Timothy ─────────────────────────────────────────────────
  '1 Timothy': [
    { level: 1, title: 'Introduction',                           startCh: 1,  startV: 1,  endCh: 1,  endV: 2  },
    { level: 1, title: 'Combating False Teaching',               startCh: 1,  startV: 3,  endCh: 1,  endV: 20 },
    { level: 1, title: 'Order in Public Worship',                startCh: 2,  startV: 1,  endCh: 2,  endV: 15 },
    { level: 2, title: 'Prayer for All People',                  startCh: 2,  startV: 1,  endCh: 2,  endV: 8  },
    { level: 2, title: 'Women in Worship',                       startCh: 2,  startV: 9,  endCh: 2,  endV: 15 },
    { level: 1, title: 'Qualifications for Church Leaders',      startCh: 3,  startV: 1,  endCh: 3,  endV: 16 },
    { level: 2, title: 'Overseers',                              startCh: 3,  startV: 1,  endCh: 3,  endV: 7  },
    { level: 2, title: 'Deacons',                                startCh: 3,  startV: 8,  endCh: 3,  endV: 16 },
    { level: 1, title: 'Instructions to Timothy',                startCh: 4,  startV: 1,  endCh: 6,  endV: 21 },
    { level: 2, title: 'False Asceticism; Godly Training',       startCh: 4,  startV: 1,  endCh: 4,  endV: 16 },
    { level: 2, title: 'Instructions for Various Groups',        startCh: 5,  startV: 1,  endCh: 5,  endV: 25 },
    { level: 2, title: 'On Contentment and False Teaching',      startCh: 6,  startV: 1,  endCh: 6,  endV: 21 },
  ],

  // ── 2 Timothy ─────────────────────────────────────────────────
  '2 Timothy': [
    { level: 1, title: 'Introduction',                           startCh: 1,  startV: 1,  endCh: 1,  endV: 5  },
    { level: 1, title: 'Be Strong in Grace',                     startCh: 1,  startV: 6,  endCh: 2,  endV: 26 },
    { level: 2, title: 'Fan into Flame; Guard the Gospel',       startCh: 1,  startV: 6,  endCh: 1,  endV: 18 },
    { level: 2, title: 'A Good Soldier of Christ Jesus',         startCh: 2,  startV: 1,  endCh: 2,  endV: 26 },
    { level: 1, title: 'Perilous Times and Scripture\'s Sufficiency', startCh: 3, startV: 1, endCh: 3, endV: 17 },
    { level: 1, title: 'Preach the Word; Paul\'s Farewell',      startCh: 4,  startV: 1,  endCh: 4,  endV: 22 },
  ],

  // ── Titus ─────────────────────────────────────────────────────
  'Titus': [
    { level: 1, title: 'Introduction',                           startCh: 1,  startV: 1,  endCh: 1,  endV: 4  },
    { level: 1, title: 'Qualifications for Elders; Silencing False Teachers', startCh: 1, startV: 5, endCh: 1, endV: 16 },
    { level: 1, title: 'Sound Doctrine for Various Groups',      startCh: 2,  startV: 1,  endCh: 2,  endV: 15 },
    { level: 2, title: 'Instruction for Households',             startCh: 2,  startV: 1,  endCh: 2,  endV: 10 },
    { level: 2, title: 'The Grace that Saves',                   startCh: 2,  startV: 11, endCh: 2,  endV: 15 },
    { level: 1, title: 'Godly Conduct and Sound Doctrine',       startCh: 3,  startV: 1,  endCh: 3,  endV: 15 },
    { level: 2, title: 'Saved Not by Works; Avoid Foolish Quarrels', startCh: 3, startV: 1, endCh: 3, endV: 11 },
    { level: 2, title: 'Final Instructions',                     startCh: 3,  startV: 12, endCh: 3,  endV: 15 },
  ],

  // ── Philemon ──────────────────────────────────────────────────
  'Philemon': [
    { level: 1, title: 'Introduction and Thanksgiving',          startCh: 1,  startV: 1,  endCh: 1,  endV: 7  },
    { level: 1, title: 'Paul\'s Plea for Onesimus',              startCh: 1,  startV: 8,  endCh: 1,  endV: 21 },
    { level: 1, title: 'Conclusion',                             startCh: 1,  startV: 22, endCh: 1,  endV: 25 },
  ],

  // ── Hebrews ───────────────────────────────────────────────────
  'Hebrews': [
    { level: 1, title: 'The Supremacy of God\'s Son',            startCh: 1,  startV: 1,  endCh: 2,  endV: 18 },
    { level: 2, title: 'God Has Spoken through His Son',         startCh: 1,  startV: 1,  endCh: 1,  endV: 14 },
    { level: 2, title: 'Warning: Do Not Neglect Salvation',      startCh: 2,  startV: 1,  endCh: 2,  endV: 4  },
    { level: 2, title: 'Jesus: Perfected through Suffering',     startCh: 2,  startV: 5,  endCh: 2,  endV: 18 },
    { level: 1, title: 'Jesus Greater than Moses; Rest for God\'s People', startCh: 3, startV: 1, endCh: 4, endV: 13 },
    { level: 2, title: 'Jesus the Apostle and High Priest',      startCh: 3,  startV: 1,  endCh: 3,  endV: 6  },
    { level: 2, title: 'Warning: Do Not Harden Your Heart',      startCh: 3,  startV: 7,  endCh: 4,  endV: 13 },
    { level: 1, title: 'Jesus Our Great High Priest',            startCh: 4,  startV: 14, endCh: 7,  endV: 28 },
    { level: 2, title: 'The Sympathetic High Priest',            startCh: 4,  startV: 14, endCh: 5,  endV: 10 },
    { level: 2, title: 'Warning: Do Not Fall Away; Maturity',    startCh: 5,  startV: 11, endCh: 6,  endV: 20 },
    { level: 2, title: 'Melchizedek and the New Order',          startCh: 7,  startV: 1,  endCh: 7,  endV: 28 },
    { level: 1, title: 'The New Covenant and the Better Sacrifice', startCh: 8, startV: 1, endCh: 10, endV: 18 },
    { level: 2, title: 'A Better Covenant and Sanctuary',        startCh: 8,  startV: 1,  endCh: 9,  endV: 10 },
    { level: 2, title: 'The Blood of Christ and the Once-for-All Sacrifice', startCh: 9, startV: 11, endCh: 10, endV: 18 },
    { level: 1, title: 'A Call to Faithful Endurance',           startCh: 10, startV: 19, endCh: 12, endV: 29 },
    { level: 2, title: 'Draw Near; Warning against Apostasy',    startCh: 10, startV: 19, endCh: 10, endV: 39 },
    { level: 2, title: 'The Hall of Faith',                      startCh: 11, startV: 1,  endCh: 11, endV: 40 },
    { level: 2, title: 'Run the Race; God\'s Discipline',        startCh: 12, startV: 1,  endCh: 12, endV: 29 },
    { level: 3, title: 'Fix Your Eyes on Jesus',                 startCh: 12, startV: 1,  endCh: 12, endV: 3  },
    { level: 3, title: 'God\'s Discipline',                      startCh: 12, startV: 4,  endCh: 12, endV: 11 },
    { level: 3, title: 'Warning against Refusing God',           startCh: 12, startV: 12, endCh: 12, endV: 29 },
    { level: 1, title: 'Concluding Exhortations',                startCh: 13, startV: 1,  endCh: 13, endV: 25 },
    { level: 2, title: 'Service Pleasing to God',                startCh: 13, startV: 1,  endCh: 13, endV: 19 },
    { level: 2, title: 'Benediction and Final Greetings',        startCh: 13, startV: 20, endCh: 13, endV: 25 },
  ],

  // ── James ─────────────────────────────────────────────────────
  'James': [
    { level: 1, title: 'Trials, Wisdom, and the Word',           startCh: 1,  startV: 1,  endCh: 1,  endV: 27 },
    { level: 2, title: 'Trials and Temptations',                 startCh: 1,  startV: 1,  endCh: 1,  endV: 18 },
    { level: 2, title: 'Doers of the Word',                      startCh: 1,  startV: 19, endCh: 1,  endV: 27 },
    { level: 1, title: 'Faith and Works',                        startCh: 2,  startV: 1,  endCh: 2,  endV: 26 },
    { level: 2, title: 'Favoritism Forbidden',                   startCh: 2,  startV: 1,  endCh: 2,  endV: 13 },
    { level: 2, title: 'Faith without Works Is Dead',            startCh: 2,  startV: 14, endCh: 2,  endV: 26 },
    { level: 1, title: 'The Tongue and Worldly Wisdom',          startCh: 3,  startV: 1,  endCh: 3,  endV: 18 },
    { level: 1, title: 'Warning against Worldliness',            startCh: 4,  startV: 1,  endCh: 4,  endV: 17 },
    { level: 2, title: 'The Source of Quarrels; Pride',          startCh: 4,  startV: 1,  endCh: 4,  endV: 12 },
    { level: 2, title: 'Boasting about Tomorrow',                startCh: 4,  startV: 13, endCh: 4,  endV: 17 },
    { level: 1, title: 'Warning to the Rich; Patience and Prayer', startCh: 5, startV: 1, endCh: 5, endV: 20 },
    { level: 2, title: 'Warning to the Oppressive Rich',         startCh: 5,  startV: 1,  endCh: 5,  endV: 6  },
    { level: 2, title: 'Patience in Suffering; Prayer of Faith', startCh: 5,  startV: 7,  endCh: 5,  endV: 20 },
  ],

  // ── 1 Peter ───────────────────────────────────────────────────
  '1 Peter': [
    { level: 1, title: 'Introduction',                           startCh: 1,  startV: 1,  endCh: 1,  endV: 2  },
    { level: 1, title: 'A Living Hope; Holy Living',             startCh: 1,  startV: 3,  endCh: 2,  endV: 12 },
    { level: 2, title: 'Praise for Living Hope and Salvation',   startCh: 1,  startV: 3,  endCh: 1,  endV: 12 },
    { level: 2, title: 'Be Holy; the Precious Cornerstone',      startCh: 1,  startV: 13, endCh: 2,  endV: 12 },
    { level: 1, title: 'Submission and Suffering',               startCh: 2,  startV: 13, endCh: 4,  endV: 19 },
    { level: 2, title: 'Submit to Governing Authorities',        startCh: 2,  startV: 13, endCh: 2,  endV: 17 },
    { level: 2, title: 'Servants and Spouses',                   startCh: 2,  startV: 18, endCh: 3,  endV: 7  },
    { level: 2, title: 'Suffering for Righteousness',            startCh: 3,  startV: 8,  endCh: 3,  endV: 22 },
    { level: 2, title: 'Living for God; Suffering as a Christian', startCh: 4, startV: 1, endCh: 4, endV: 19 },
    { level: 1, title: 'The Elders and Final Exhortations',      startCh: 5,  startV: 1,  endCh: 5,  endV: 14 },
    { level: 2, title: 'Instructions to Elders and the Young',   startCh: 5,  startV: 1,  endCh: 5,  endV: 9  },
    { level: 2, title: 'Closing Exhortations and Greetings',     startCh: 5,  startV: 10, endCh: 5,  endV: 14 },
  ],

  // ── 2 Peter ───────────────────────────────────────────────────
  '2 Peter': [
    { level: 1, title: 'Introduction; Precious Promises and Godly Qualities', startCh: 1, startV: 1, endCh: 1, endV: 21 },
    { level: 2, title: 'Salutation and Precious Promises',       startCh: 1,  startV: 1,  endCh: 1,  endV: 11 },
    { level: 2, title: 'Peter\'s Final Testimony; Prophetic Word', startCh: 1, startV: 12, endCh: 1, endV: 21 },
    { level: 1, title: 'Warning against False Teachers',         startCh: 2,  startV: 1,  endCh: 2,  endV: 22 },
    { level: 1, title: 'The Day of the Lord',                    startCh: 3,  startV: 1,  endCh: 3,  endV: 18 },
    { level: 2, title: 'Scoffers; the Day of the Lord',          startCh: 3,  startV: 1,  endCh: 3,  endV: 13 },
    { level: 2, title: 'Grow in Grace and Knowledge',            startCh: 3,  startV: 14, endCh: 3,  endV: 18 },
  ],

  // ── 1 John ────────────────────────────────────────────────────
  '1 John': [
    { level: 1, title: 'Prologue: The Word of Life',             startCh: 1,  startV: 1,  endCh: 1,  endV: 4  },
    { level: 1, title: 'Walking in the Light',                   startCh: 1,  startV: 5,  endCh: 2,  endV: 29 },
    { level: 2, title: 'God Is Light; Confessing Sin',           startCh: 1,  startV: 5,  endCh: 1,  endV: 10 },
    { level: 2, title: 'Christ Our Advocate; the New Command',   startCh: 2,  startV: 1,  endCh: 2,  endV: 17 },
    { level: 2, title: 'Warning against Antichrists',            startCh: 2,  startV: 18, endCh: 2,  endV: 29 },
    { level: 1, title: 'Children of God and Love for One Another', startCh: 3, startV: 1, endCh: 4, endV: 21 },
    { level: 2, title: 'Children of God; Righteous Conduct',     startCh: 3,  startV: 1,  endCh: 3,  endV: 24 },
    { level: 2, title: 'Test the Spirits; Love and Confidence',  startCh: 4,  startV: 1,  endCh: 4,  endV: 21 },
    { level: 1, title: 'Faith Overcoming the World; Eternal Life', startCh: 5, startV: 1, endCh: 5, endV: 21 },
    { level: 2, title: 'Faith and the Three Witnesses',          startCh: 5,  startV: 1,  endCh: 5,  endV: 12 },
    { level: 2, title: 'Confidence in Prayer; Conclusion',       startCh: 5,  startV: 13, endCh: 5,  endV: 21 },
  ],

  // ── 2 John ────────────────────────────────────────────────────
  '2 John': [
    { level: 1, title: 'Salutation',                             startCh: 1,  startV: 1,  endCh: 1,  endV: 3  },
    { level: 1, title: 'Walk in Truth and Love; Beware Deceivers', startCh: 1, startV: 4, endCh: 1, endV: 11 },
    { level: 1, title: 'Conclusion',                             startCh: 1,  startV: 12, endCh: 1,  endV: 13 },
  ],

  // ── 3 John ────────────────────────────────────────────────────
  '3 John': [
    { level: 1, title: 'Salutation',                             startCh: 1,  startV: 1,  endCh: 1,  endV: 4  },
    { level: 1, title: 'Gaius Commended; Diotrephes Rebuked',    startCh: 1,  startV: 5,  endCh: 1,  endV: 12 },
    { level: 1, title: 'Conclusion',                             startCh: 1,  startV: 13, endCh: 1,  endV: 14 },
  ],

  // ── Jude ──────────────────────────────────────────────────────
  'Jude': [
    { level: 1, title: 'Salutation',                             startCh: 1,  startV: 1,  endCh: 1,  endV: 2  },
    { level: 1, title: 'Contend for the Faith against False Teachers', startCh: 1, startV: 3, endCh: 1, endV: 16 },
    { level: 2, title: 'The Urgency to Contend',                 startCh: 1,  startV: 3,  endCh: 1,  endV: 4  },
    { level: 2, title: 'Judgment on the Ungodly',                startCh: 1,  startV: 5,  endCh: 1,  endV: 16 },
    { level: 1, title: 'Instructions for Believers; Doxology',   startCh: 1,  startV: 17, endCh: 1,  endV: 25 },
  ],

  // ── Revelation ────────────────────────────────────────────────
  'Revelation': [
    { level: 1, title: 'Prologue and Vision of Christ',          startCh: 1,  startV: 1,  endCh: 1,  endV: 20 },
    { level: 2, title: 'Prologue',                               startCh: 1,  startV: 1,  endCh: 1,  endV: 8  },
    { level: 2, title: 'The Vision of the Glorified Son of Man', startCh: 1,  startV: 9,  endCh: 1,  endV: 20 },
    { level: 1, title: 'The Seven Letters to the Churches',      startCh: 2,  startV: 1,  endCh: 3,  endV: 22 },
    { level: 2, title: 'To Ephesus',                             startCh: 2,  startV: 1,  endCh: 2,  endV: 7  },
    { level: 2, title: 'To Smyrna',                              startCh: 2,  startV: 8,  endCh: 2,  endV: 11 },
    { level: 2, title: 'To Pergamum',                            startCh: 2,  startV: 12, endCh: 2,  endV: 17 },
    { level: 2, title: 'To Thyatira',                            startCh: 2,  startV: 18, endCh: 2,  endV: 29 },
    { level: 2, title: 'To Sardis',                              startCh: 3,  startV: 1,  endCh: 3,  endV: 6  },
    { level: 2, title: 'To Philadelphia',                        startCh: 3,  startV: 7,  endCh: 3,  endV: 13 },
    { level: 2, title: 'To Laodicea',                            startCh: 3,  startV: 14, endCh: 3,  endV: 22 },
    { level: 1, title: 'The Heavenly Throne Room',               startCh: 4,  startV: 1,  endCh: 5,  endV: 14 },
    { level: 2, title: 'The Throne in Heaven',                   startCh: 4,  startV: 1,  endCh: 4,  endV: 11 },
    { level: 2, title: 'The Scroll and the Lamb',                startCh: 5,  startV: 1,  endCh: 5,  endV: 14 },
    { level: 1, title: 'The Seven Seals',                        startCh: 6,  startV: 1,  endCh: 8,  endV: 5  },
    { level: 2, title: 'The First Six Seals',                    startCh: 6,  startV: 1,  endCh: 6,  endV: 17 },
    { level: 2, title: 'Interlude: The Sealed and the Multitude',startCh: 7,  startV: 1,  endCh: 7,  endV: 17 },
    { level: 2, title: 'The Seventh Seal',                       startCh: 8,  startV: 1,  endCh: 8,  endV: 5  },
    { level: 1, title: 'The Seven Trumpets',                     startCh: 8,  startV: 6,  endCh: 11, endV: 19 },
    { level: 2, title: 'The First Six Trumpets',                 startCh: 8,  startV: 6,  endCh: 9,  endV: 21 },
    { level: 2, title: 'Interlude: The Angel and the Little Scroll; the Two Witnesses', startCh: 10, startV: 1, endCh: 11, endV: 14 },
    { level: 2, title: 'The Seventh Trumpet',                    startCh: 11, startV: 15, endCh: 11, endV: 19 },
    { level: 1, title: 'The Great Conflict',                     startCh: 12, startV: 1,  endCh: 14, endV: 20 },
    { level: 2, title: 'The Woman, the Dragon, and the Child',   startCh: 12, startV: 1,  endCh: 12, endV: 17 },
    { level: 2, title: 'The Two Beasts',                         startCh: 13, startV: 1,  endCh: 13, endV: 18 },
    { level: 2, title: 'The Lamb and the 144,000; Judgment Announced', startCh: 14, startV: 1, endCh: 14, endV: 20 },
    { level: 1, title: 'The Seven Bowls of Wrath',               startCh: 15, startV: 1,  endCh: 16, endV: 21 },
    { level: 2, title: 'The Song of Moses; Preparation of the Bowls', startCh: 15, startV: 1, endCh: 15, endV: 8 },
    { level: 2, title: 'The Seven Bowls',                        startCh: 16, startV: 1,  endCh: 16, endV: 21 },
    { level: 1, title: 'The Judgment of Babylon',                startCh: 17, startV: 1,  endCh: 18, endV: 24 },
    { level: 2, title: 'The Great Prostitute',                   startCh: 17, startV: 1,  endCh: 17, endV: 18 },
    { level: 2, title: 'The Fall of Babylon',                    startCh: 18, startV: 1,  endCh: 18, endV: 24 },
    { level: 1, title: 'The Return of Christ and the Final Judgment', startCh: 19, startV: 1, endCh: 20, endV: 15 },
    { level: 2, title: 'Hallelujah; the Marriage of the Lamb',   startCh: 19, startV: 1,  endCh: 19, endV: 10 },
    { level: 2, title: 'The Rider on the White Horse',           startCh: 19, startV: 11, endCh: 19, endV: 21 },
    { level: 2, title: 'The Thousand Years; the Final Rebellion',startCh: 20, startV: 1,  endCh: 20, endV: 10 },
    { level: 2, title: 'The Great White Throne Judgment',        startCh: 20, startV: 11, endCh: 20, endV: 15 },
    { level: 1, title: 'The New Creation',                       startCh: 21, startV: 1,  endCh: 22, endV: 21 },
    { level: 2, title: 'The New Heaven and New Earth',           startCh: 21, startV: 1,  endCh: 21, endV: 8  },
    { level: 2, title: 'The New Jerusalem',                      startCh: 21, startV: 9,  endCh: 21, endV: 27 },
    { level: 2, title: 'The River of Life; the Invitation',      startCh: 22, startV: 1,  endCh: 22, endV: 17 },
    { level: 2, title: 'Epilogue and Benediction',               startCh: 22, startV: 18, endCh: 22, endV: 21 },
  ],
}

/**
 * Build a fast lookup map: { 'Book': { 'ch:v': [entries] } }
 * Called once per book when the reader renders.
 */
const _lookupCache = {}
export function getOutlineLookup(book) {
  if (_lookupCache[book]) return _lookupCache[book]
  const entries = BIBLE_OUTLINES[book]
  if (!entries) return null
  const map = {}
  for (const entry of entries) {
    const k = `${entry.startCh}:${entry.startV}`
    if (!map[k]) map[k] = []
    map[k].push(entry)
  }
  _lookupCache[book] = map
  return map
}

/** Returns entries that start at (ch, verse), or empty array. */
export function getInlineHeadings(book, ch, verse) {
  const map = getOutlineLookup(book)
  if (!map) return []
  return map[`${ch}:${verse}`] || []
}

export const NT_BOOKS_WITH_OUTLINES = new Set(Object.keys(BIBLE_OUTLINES))
