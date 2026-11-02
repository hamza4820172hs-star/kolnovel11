import * as SQLite from 'expo-sqlite';
export const db = SQLite.openDatabaseSync('novel_reader.db');
export async function initDatabase() {
  db.execSync(`PRAGMA journal_mode = WAL;
  PRAGMA foreign_keys = ON;
  CREATE TABLE IF NOT EXISTS books (
    id INTEGER PRIMARY KEY AUTOINCREMENT, title TEXT NOT NULL, author TEXT,
    source_uri TEXT NOT NULL, local_uri TEXT, cover_uri TEXT, content_hash TEXT,
    description TEXT, added_at INTEGER NOT NULL, last_opened_at INTEGER,
    is_favorite INTEGER NOT NULL DEFAULT 0
  );
  CREATE TABLE IF NOT EXISTS chapters (
    id INTEGER PRIMARY KEY AUTOINCREMENT, book_id INTEGER NOT NULL,
    spine_index INTEGER NOT NULL, title TEXT NOT NULL, href TEXT NOT NULL,
    content TEXT, UNIQUE(book_id, spine_index),
    FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS reading_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT, book_id INTEGER NOT NULL, chapter_id INTEGER, opened_at INTEGER NOT NULL
  );
  CREATE TABLE IF NOT EXISTS reading_progress (
    book_id INTEGER PRIMARY KEY, chapter_id INTEGER, paragraph_index INTEGER DEFAULT 0,
    scroll_offset REAL DEFAULT 0, updated_at INTEGER NOT NULL,
    FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE
  );
  CREATE TABLE IF NOT EXISTS chapter_reading_positions (
    book_id INTEGER NOT NULL,
    chapter_id INTEGER NOT NULL,
    scroll_offset REAL NOT NULL DEFAULT 0,
    updated_at INTEGER NOT NULL,
    PRIMARY KEY(book_id, chapter_id),
    FOREIGN KEY(book_id) REFERENCES books(id) ON DELETE CASCADE,
    FOREIGN KEY(chapter_id) REFERENCES chapters(id) ON DELETE CASCADE
  );
  CREATE INDEX IF NOT EXISTS idx_reading_positions_book ON chapter_reading_positions(book_id, updated_at);
  CREATE TABLE IF NOT EXISTS reading_settings (
    id INTEGER PRIMARY KEY CHECK(id=1), font_size REAL DEFAULT 20,
    line_height REAL DEFAULT 1.8, theme TEXT DEFAULT 'paper',
    margin REAL DEFAULT 22, show_english INTEGER DEFAULT 0
  );
  INSERT OR IGNORE INTO reading_settings(id) VALUES(1);
  CREATE TABLE IF NOT EXISTS translation_paragraphs (
    id INTEGER PRIMARY KEY AUTOINCREMENT, book_id INTEGER NOT NULL,
    chapter_id INTEGER NOT NULL, paragraph_index INTEGER NOT NULL,
    source_hash TEXT NOT NULL, source_text TEXT NOT NULL, translated_text TEXT,
    status TEXT NOT NULL DEFAULT 'pending', error TEXT, updated_at INTEGER NOT NULL,
    UNIQUE(book_id, chapter_id, paragraph_index)
  );
  CREATE TABLE IF NOT EXISTS translation_batches (
    id INTEGER PRIMARY KEY AUTOINCREMENT, book_id INTEGER NOT NULL,
    started_at INTEGER NOT NULL, finished_at INTEGER, range_start INTEGER,
    range_end INTEGER, success_count INTEGER DEFAULT 0, failed_count INTEGER DEFAULT 0,
    skipped_count INTEGER DEFAULT 0, status TEXT NOT NULL
  );
  CREATE TABLE IF NOT EXISTS translation_history (
    id INTEGER PRIMARY KEY AUTOINCREMENT, book_id INTEGER NOT NULL,
    batch_id INTEGER, chapter_id INTEGER, status TEXT NOT NULL,
    reason TEXT, created_at INTEGER NOT NULL
  );
  CREATE INDEX IF NOT EXISTS idx_chapters_book ON chapters(book_id, spine_index);
  CREATE INDEX IF NOT EXISTS idx_translation_book ON translation_paragraphs(book_id, chapter_id);`);
}
