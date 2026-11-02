import {db} from './database';
export type Book = {id:number;title:string;author:string|null;source_uri:string;cover_uri:string|null;added_at:number;last_opened_at:number|null;is_favorite:number};
export function listBooks():Book[] {
  return db.getAllSync<Book>('SELECT id,title,author,source_uri,cover_uri,added_at,last_opened_at,is_favorite FROM books ORDER BY added_at DESC');
}
export function addBook(title:string,author:string|null,uri:string,hash?:string) {
  const existing=db.getFirstSync<{id:number}>('SELECT id FROM books WHERE source_uri=? OR (? IS NOT NULL AND content_hash=?)',[uri,hash||null,hash||null]);
  if(existing) return {id:existing.id,duplicate:true};
  const result=db.runSync('INSERT INTO books(title,author,source_uri,content_hash,added_at) VALUES(?,?,?,?,?)',[title,author,uri,hash||null,Date.now()]);
  return {id:result.lastInsertRowId,duplicate:false};
}
export function getBook(id:number) {
  return db.getFirstSync<Book>('SELECT id,title,author,source_uri,cover_uri,added_at,last_opened_at,is_favorite FROM books WHERE id=?',[id]);
}
export function toggleFavorite(id:number) {
  db.runSync('UPDATE books SET is_favorite=1-is_favorite WHERE id=?',[id]);
}
export function touchBook(id:number,chapterId?:number) {
  const now=Date.now();db.runSync('UPDATE books SET last_opened_at=? WHERE id=?',[now,id]);db.runSync('INSERT INTO reading_history(book_id,chapter_id,opened_at) VALUES(?,?,?)',[id,chapterId||null,now]);
}

export type Chapter={id:number;book_id:number;spine_index:number;title:string;href:string;content:string|null};
export function saveParsedBook(bookId:number,parsed:{title:string;author:string|null;description:string|null;coverDataUri:string|null;chapters:{spineIndex:number;title:string;href:string;content:string}[]}){
 db.runSync('UPDATE books SET title=?,author=?,description=?,cover_uri=? WHERE id=?',[parsed.title,parsed.author,parsed.description,parsed.coverDataUri,bookId]);
 db.runSync('DELETE FROM chapters WHERE book_id=?',[bookId]);
 for(const c of parsed.chapters) db.runSync('INSERT INTO chapters(book_id,spine_index,title,href,content) VALUES(?,?,?,?,?)',[bookId,c.spineIndex,c.title,c.href,c.content]);
}
export function listChapters(bookId:number):Chapter[]{return db.getAllSync<Chapter>('SELECT id,book_id,spine_index,title,href,content FROM chapters WHERE book_id=? ORDER BY spine_index',[bookId]);}
export function getChapter(id:number):Chapter|undefined{return db.getFirstSync<Chapter>('SELECT id,book_id,spine_index,title,href,content FROM chapters WHERE id=?',[id])||undefined;}
export function saveProgress(bookId:number,chapterId:number,paragraphIndex:number){db.runSync('INSERT INTO reading_progress(book_id,chapter_id,paragraph_index,updated_at) VALUES(?,?,?,?) ON CONFLICT(book_id) DO UPDATE SET chapter_id=excluded.chapter_id,paragraph_index=excluded.paragraph_index,updated_at=excluded.updated_at',[bookId,chapterId,paragraphIndex,Date.now()]);}

// Keep one independent reading position for every chapter, plus the last-opened
// chapter for the book. Moving to another chapter must never overwrite the old one.
export function saveReadingPosition(bookId:number,chapterId:number,scrollOffset:number){
  const now=Date.now();
  db.runSync(
    'INSERT INTO chapter_reading_positions(book_id,chapter_id,scroll_offset,updated_at) VALUES(?,?,?,?) ON CONFLICT(book_id,chapter_id) DO UPDATE SET scroll_offset=excluded.scroll_offset,updated_at=excluded.updated_at',
    [bookId,chapterId,Math.max(0,scrollOffset),now]
  );
  db.runSync(
    'INSERT INTO reading_progress(book_id,chapter_id,paragraph_index,scroll_offset,updated_at) VALUES(?,?,0,?,?) ON CONFLICT(book_id) DO UPDATE SET chapter_id=excluded.chapter_id,scroll_offset=excluded.scroll_offset,updated_at=excluded.updated_at',
    [bookId,chapterId,Math.max(0,scrollOffset),now]
  );
}
export function getReadingPosition(bookId:number,chapterId:number):number{
  const row=db.getFirstSync<{scroll_offset:number}>(
    'SELECT scroll_offset FROM chapter_reading_positions WHERE book_id=? AND chapter_id=?',
    [bookId,chapterId]
  );
  return Math.max(0,row?.scroll_offset||0);
}
export function getProgress(bookId:number){return db.getFirstSync<{chapter_id:number|null;paragraph_index:number;scroll_offset:number}>('SELECT chapter_id,paragraph_index,scroll_offset FROM reading_progress WHERE book_id=?',[bookId]);}
export function getStats(){return db.getFirstSync<{books:number;chapters:number;translated:number;words:number}>('SELECT (SELECT COUNT(*) FROM books) books,(SELECT COUNT(*) FROM chapters) chapters,(SELECT COUNT(DISTINCT chapter_id) FROM translation_paragraphs WHERE status="done") translated,(SELECT COUNT(*) FROM translation_paragraphs WHERE status="done") words')!;}
export function getTranslationStatus(bookId:number,chapterId:number){return db.getFirstSync<{done:number;failed:number;total:number}>('SELECT COUNT(CASE WHEN status="done" THEN 1 END) done,COUNT(CASE WHEN status="failed" THEN 1 END) failed,COUNT(*) total FROM translation_paragraphs WHERE book_id=? AND chapter_id=?',[bookId,chapterId])!;}
export function getTranslatedParagraph(bookId:number,chapterId:number,index:number){return db.getFirstSync<{translated_text:string|null;status:string}>('SELECT translated_text,status FROM translation_paragraphs WHERE book_id=? AND chapter_id=? AND paragraph_index=?',[bookId,chapterId,index]);}
export function saveTranslation(bookId:number,chapterId:number,index:number,source:string,translated:string){db.runSync('INSERT INTO translation_paragraphs(book_id,chapter_id,paragraph_index,source_hash,source_text,translated_text,status,updated_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(book_id,chapter_id,paragraph_index) DO UPDATE SET translated_text=excluded.translated_text,status="done",error=NULL,updated_at=excluded.updated_at',[bookId,chapterId,index,String(source.length)+':'+source.slice(0,80),source,translated,'done',Date.now()]);}
export function markTranslationFailed(bookId:number,chapterId:number,index:number,source:string,error:string){db.runSync('INSERT INTO translation_paragraphs(book_id,chapter_id,paragraph_index,source_hash,source_text,status,error,updated_at) VALUES(?,?,?,?,?,?,?,?) ON CONFLICT(book_id,chapter_id,paragraph_index) DO UPDATE SET status="failed",error=excluded.error,updated_at=excluded.updated_at',[bookId,chapterId,index,String(source.length)+':'+source.slice(0,80),source,'failed',error,Date.now()]);}
export function addTranslationHistory(bookId:number,chapterId:number,status:string,reason?:string){db.runSync('INSERT INTO translation_history(book_id,chapter_id,status,reason,created_at) VALUES(?,?,?,?,?)',[bookId,chapterId,status,reason||null,Date.now()]);}
export function getActivity(){return db.getAllSync<any>(`SELECT 'translation' history_type,h.id,h.book_id,b.title book_title,h.chapter_id,c.title chapter_title,h.status,h.reason,h.created_at event_at FROM translation_history h JOIN books b ON b.id=h.book_id LEFT JOIN chapters c ON c.id=h.chapter_id UNION ALL SELECT 'reading' history_type,r.id,r.book_id,b.title book_title,r.chapter_id,c.title chapter_title,'opened' status,NULL reason,r.opened_at event_at FROM reading_history r JOIN books b ON b.id=r.book_id LEFT JOIN chapters c ON c.id=r.chapter_id ORDER BY event_at DESC LIMIT 100`);}

export function deleteBook(id:number){for(const table of ['reading_history','reading_progress','chapters','translation_paragraphs','translation_batches','translation_history'])db.runSync(`DELETE FROM ${table} WHERE book_id=?`,[id]);db.runSync('DELETE FROM books WHERE id=?',[id]);}
