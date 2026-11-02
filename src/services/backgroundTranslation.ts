import BackgroundService from 'react-native-background-actions';
import {initDatabase} from '../db/database';
import {getChapter,getTranslatedParagraph,saveTranslation,markTranslationFailed,addTranslationHistory,Chapter} from '../db/books';
import {translateParagraph} from './translator';
type Params={bookId:number;chapterIds:number[];bookTitle:string};
const sleep=(ms:number)=>new Promise(resolve=>setTimeout(resolve,ms));
async function translationTask(params:Params){
 await initDatabase();
 const {bookId,chapterIds,bookTitle}=params;
 let total=0,done=0,failed=0;
 const chapters=(chapterIds||[]).map(id=>getChapter(id)).filter(Boolean) as Chapter[];
 for(const chapter of chapters){
  const ps=String(chapter.content||'').split(/\n\s*\n+/).map(x=>x.trim()).filter(Boolean);
  total+=ps.filter((p,i)=>{const old=getTranslatedParagraph(bookId,chapter.id,i);return !(old?.status==='done'&&old.translated_text);}).length;
 }
 await BackgroundService.updateNotification({taskDesc:`${bookTitle} · بدء الترجمة · 0/${total} فقرة`});
 for(const chapter of chapters){
  const ps=String(chapter.content||'').split(/\n\s*\n+/).map(x=>x.trim()).filter(Boolean);let chapterFailed=false;
  for(let i=0;i<ps.length;i++){
   const old=getTranslatedParagraph(bookId,chapter.id,i);if(old?.status==='done'&&old.translated_text)continue;
   try{const result=await translateParagraph(ps[i]);saveTranslation(bookId,chapter.id,i,ps[i],result.text);done++;}
   catch(error){failed++;chapterFailed=true;markTranslationFailed(bookId,chapter.id,i,ps[i],String(error));}
   await BackgroundService.updateNotification({taskDesc:`${bookTitle} · ${done+failed}/${total} فقرة · ${done} ناجحة · ${failed} فاشلة`,progressBar:{max:Math.max(1,total),value:done+failed,indeterminate:false}});
   await sleep(250);
  }
  addTranslationHistory(bookId,chapter.id,chapterFailed?'partial':'done','ترجمة جماعية في الخلفية');
 }
 await BackgroundService.updateNotification({taskDesc:`اكتملت ترجمة ${bookTitle} · ${done} ناجحة · ${failed} فاشلة`});
 await sleep(1800);
}
export async function startBackgroundTranslation(params:Params){
 if(await BackgroundService.isRunning())throw new Error('هناك مهمة ترجمة تعمل بالفعل.');
 await BackgroundService.start(translationTask,{
  taskName:'NovelTranslation',taskTitle:'ترجمة الرواية',
  taskDesc:`${params.bookTitle} · تجهيز الترجمة`,
  taskIcon:{name:'ic_launcher',type:'mipmap'},color:'#D7AD55',
  linkingURI:'novelreader://activity',foregroundServiceType:['dataSync'],parameters:params,
  stopOnTerminate:false,startOnBoot:false
 } as any);
}
export async function isBackgroundTranslationRunning(){return BackgroundService.isRunning();}
