import React,{useCallback,useEffect,useMemo,useState,useRef} from 'react';
import {AppState,View,Text,ScrollView,FlatList,Pressable,TextInput,Alert,StyleSheet,ActivityIndicator,Image,Switch,Modal,PermissionsAndroid,Platform} from 'react-native';
import * as DocumentPicker from 'expo-document-picker';
import * as FileSystem from 'expo-file-system/legacy';
import * as Crypto from 'expo-crypto';
import {NativeStackScreenProps} from '@react-navigation/native-stack';
import {useFocusEffect} from '@react-navigation/native';
import {RootStackParamList} from '../../App';
import {Book,addBook,getBook,listBooks,toggleFavorite,touchBook,saveParsedBook,listChapters,getChapter,saveProgress,saveReadingPosition,getReadingPosition,getProgress,getStats,getTranslationStatus,getTranslatedParagraph,saveTranslation,markTranslationFailed,addTranslationHistory,getActivity,deleteBook} from '../db/books';
import {db} from '../db/database';
import {parseEpub} from '../services/epub';
import {translateParagraph} from '../services/translator';
import {startBackgroundTranslation,isBackgroundTranslationRunning} from '../services/backgroundTranslation';
import {Screen,SectionTitle,EmptyState,BookTile} from '../ui/components';
import {Palette as P} from '../ui/theme';
import {useSafeAreaInsets} from 'react-native-safe-area-context';

function useBooks(){const [books,setBooks]=useState<Book[]>([]);const refresh=useCallback(()=>setBooks(listBooks()),[]);useFocusEffect(useCallback(()=>{refresh();},[refresh]));return {books,refresh};}
function Header({title,subtitle}:{title:string;subtitle?:string}){return <View style={{marginBottom:16}}><Text style={st.brand}>NOVEL READER</Text><Text style={st.heading}>{title}</Text>{subtitle?<Text style={st.sub}>{subtitle}</Text>:null}</View>}
async function importEpub(refresh:()=>void){
 try{
  const pick=await DocumentPicker.getDocumentAsync({type:['application/epub+zip','application/zip'],copyToCacheDirectory:true});if(pick.canceled)return;
  const f=pick.assets[0];if(!f.name.toLowerCase().endsWith('.epub')){Alert.alert('ملف غير مدعوم','اختر ملف EPUB.');return;}
  const dir=FileSystem.documentDirectory+'books/';await FileSystem.makeDirectoryAsync(dir,{intermediates:true});
  const safeName=`${Date.now()}_${f.name.replace(/[^a-zA-Z0-9._-]/g,'_')}`;const target=dir+safeName;await FileSystem.copyAsync({from:f.uri,to:target});
  Alert.alert('جاري تحليل الرواية','سيتم استخراج بيانات EPUB والفصول.');
  const parsed=await parseEpub(target,f.name);
  const base64=await FileSystem.readAsStringAsync(target,{encoding:FileSystem.EncodingType.Base64});const hash=await Crypto.digestStringAsync(Crypto.CryptoDigestAlgorithm.SHA256,base64);
  const added=addBook(parsed.title,parsed.author,target,hash);if(added.duplicate){await FileSystem.deleteAsync(target,{idempotent:true});Alert.alert('الرواية موجودة بالفعل','لم تتم إضافة نسخة مكررة من نفس ملف EPUB.');refresh();return;}
  const id=added.id;saveParsedBook(id,parsed);refresh();
  Alert.alert('تم استيراد الرواية بنجاح',`تم استخراج ${parsed.chapters.length} فصلًا${parsed.coverDataUri?' والغلاف':''}.`);
 }catch(e){Alert.alert('تعذر استيراد EPUB',String(e));}
}
export function HomeScreen({navigation}:any){const {books,refresh}=useBooks();const reading=books.filter(b=>b.last_opened_at);return <Screen><ScrollView showsVerticalScrollIndicator={false}>
 <Header title="الرئيسية" subtitle="مكتبتك، وقراءتك، وترجماتك في مكان واحد"/>
 <View style={st.hero}><Text style={st.heroEyebrow}>مكتبتك الخاصة</Text><Text style={st.heroTitle}>عالم رواياتك يبدأ هنا</Text><Text style={st.sub}>استورد ملفات EPUB واقرأها وترجمها إلى العربية.</Text><Pressable style={st.goldBtn} onPress={()=>importEpub(refresh)}><Text style={st.goldBtnText}>＋ إضافة رواية EPUB</Text></Pressable></View>
 <SectionTitle>متابعة القراءة</SectionTitle>{reading.length===0?<EmptyState title="لسه مفيش روايات بدأت قراءتها" body="أضف رواية EPUB لبدء مكتبتك."/>:<View style={st.grid}>{reading.map(b=><BookTile key={b.id} title={b.title} author={b.author} coverUri={b.cover_uri} onPress={()=>navigation.navigate('Novel',{bookId:b.id})}/>)}</View>}
 <SectionTitle>آخر الإضافات</SectionTitle><View style={st.grid}>{books.slice(0,6).map(b=><BookTile key={b.id} title={b.title} author={b.author} coverUri={b.cover_uri} onPress={()=>navigation.navigate('Novel',{bookId:b.id})}/>)}</View>
 </ScrollView></Screen>}
export function BrowseScreen({navigation}:any){
 const {books}=useBooks();const [q,setQ]=useState('');
 const found=books.filter(b=>b.title.toLowerCase().includes(q.toLowerCase())||(b.author||'').toLowerCase().includes(q.toLowerCase()));
 return <Screen><Header title="اكتشف" subtitle="ابحث داخل رواياتك المحلية"/>
  <TextInput value={q} onChangeText={setQ} placeholder="ابحث عن رواية أو مؤلف..." placeholderTextColor={P.muted} style={st.input}/>
  <FlatList data={found} numColumns={3} keyExtractor={b=>String(b.id)} renderItem={({item})=><BookTile title={item.title} author={item.author} coverUri={item.cover_uri} onPress={()=>navigation.navigate('Novel',{bookId:item.id})}/>} columnWrapperStyle={{justifyContent:'space-between'}} ListEmptyComponent={()=><EmptyState title="لا توجد نتائج" body="جرّب كلمة بحث أخرى أو أضف رواية جديدة."/>}/>
 </Screen>;
}
export function LibraryScreen({navigation}:any){const {books,refresh}=useBooks();const [q,setQ]=useState('');const [sort,setSort]=useState<'new'|'last'|'name'>('new');const data=useMemo(()=>books.filter(b=>b.title.toLowerCase().includes(q.toLowerCase())).sort((a,b)=>sort==='name'?a.title.localeCompare(b.title):sort==='last'?(b.last_opened_at||0)-(a.last_opened_at||0):b.added_at-a.added_at),[books,q,sort]);
 const menu=(b:Book)=>Alert.alert(b.title,'إدارة الرواية',[{text:'فتح التفاصيل',onPress:()=>navigation.navigate('Novel',{bookId:b.id})},{text:b.is_favorite?'إزالة من المفضلة':'إضافة للمفضلة',onPress:()=>{toggleFavorite(b.id);refresh();}},{text:'حذف الرواية',style:'destructive',onPress:()=>Alert.alert('حذف الرواية؟','سيتم حذف بيانات الرواية من المكتبة.',[{text:'إلغاء',style:'cancel'},{text:'حذف',style:'destructive',onPress:()=>{deleteBook(b.id);refresh();}}])},{text:'إلغاء',style:'cancel'}]);
 return <Screen><Header title="مكتبتي" subtitle={`${books.length} رواية في مكتبتك`}/><TextInput value={q} onChangeText={setQ} placeholder="بحث في المكتبة..." placeholderTextColor={P.muted} style={st.input}/><View style={st.sortRow}>{[['new','الأحدث'],['last','آخر قراءة'],['name','الاسم']].map(([v,l])=><Pressable key={v} onPress={()=>setSort(v as any)} style={[st.sortBtn,sort===v&&st.sortActive]}><Text style={{color:sort===v?P.gold:P.muted}}>{l}</Text></Pressable>)}</View><Pressable style={st.goldBtn} onPress={()=>importEpub(refresh)}><Text style={st.goldBtnText}>＋ استيراد EPUB</Text></Pressable>{data.length===0?<EmptyState title="المكتبة فارغة" body="استورد أول ملف EPUB من جهازك."/>:<FlatList style={{marginTop:14}} data={data} numColumns={3} keyExtractor={b=>String(b.id)} renderItem={({item})=><Pressable onLongPress={()=>menu(item)}><BookTile title={item.title} author={item.author} favorite={!!item.is_favorite} coverUri={item.cover_uri} onPress={()=>navigation.navigate('Novel',{bookId:item.id})}/></Pressable>} columnWrapperStyle={{justifyContent:'space-between'}}/>}</Screen>}
export function ActivityScreen(){
 const [tab,setTab]=useState<'reading'|'translation'|'stats'>('reading');const [items,setItems]=useState<any[]>([]);const [stats,setStats]=useState<any>({books:0,chapters:0,translated:0,words:0});
 useFocusEffect(useCallback(()=>{setItems(getActivity());setStats(getStats());},[]));
 const visible=items.filter(i=>tab==='reading'?i.history_type==='reading':i.history_type==='translation');
 return <Screen><Header title="النشاط" subtitle="سجل القراءة والترجمة وإحصائياتك"/>
  <View style={st.sortRow}>{[['reading','سجل القراءة'],['translation','الترجمات'],['stats','العدادات']].map(([v,l])=><Pressable key={v} onPress={()=>setTab(v as any)} style={[st.sortBtn,tab===v&&st.sortActive]}><Text style={{color:tab===v?P.gold:P.muted}}>{l}</Text></Pressable>)}</View>
  {tab==='stats'?<View style={st.statGrid}>{[['الروايات',stats.books],['الفصول',stats.chapters],['فصول بها ترجمة',stats.translated],['الفقرات المترجمة',stats.words]].map(([l,v])=><View key={String(l)} style={st.stat}><Text style={st.statNum}>{v}</Text><Text style={st.sub}>{l}</Text></View>)}</View>:visible.length===0?<EmptyState title="لا يوجد نشاط بعد" body="سيظهر سجل القراءة والترجمة هنا عند استخدامهما."/>:<ScrollView>{visible.map(i=><View key={`${i.history_type}-${i.id}`} style={st.activity}><Text style={st.settingTitle}>{i.book_title} · {i.chapter_title||'فصل'}</Text><Text style={st.sub}>{i.history_type==='reading'?'تم فتح الرواية':i.status==='done'?'اكتملت الترجمة':i.status==='failed'?'فشلت الترجمة':i.status==='started'?'بدأت الترجمة':'تم تخطي الفصل'} {i.reason?`· ${i.reason}`:''}</Text><Text style={st.muted}>{new Date(i.event_at).toLocaleString('ar-EG')}</Text></View>)}</ScrollView>}
 </Screen>;
}
export function SettingsScreen(){const [font,setFont]=useState(20);const [line,setLine]=useState(1.8);const [theme,setTheme]=useState('paper');const [english,setEnglish]=useState(false);useEffect(()=>{const x=db.getFirstSync<any>('SELECT * FROM reading_settings WHERE id=1');if(x){setFont(x.font_size);setLine(x.line_height);setTheme(x.theme);setEnglish(!!x.show_english);}},[]);const update=(field:string,value:any)=>db.runSync(`UPDATE reading_settings SET ${field}=? WHERE id=1`,[value]);return <Screen><ScrollView><Header title="الإعدادات" subtitle="تحكم في تجربة القراءة والترجمة"/><Text style={st.settingTitle}>المظهر داخل القارئ</Text><View style={st.sortRow}>{[['paper','ورقي'],['dark','داكن'],['light','فاتح']].map(([v,l])=><Pressable key={v} onPress={()=>{setTheme(v);update('theme',v);}} style={[st.sortBtn,theme===v&&st.sortActive]}><Text style={{color:theme===v?P.gold:P.muted}}>{l}</Text></Pressable>)}</View><View style={st.setting}><Text style={st.settingTitle}>حجم الخط: {font}</Text><View style={st.sortRow}><Pressable style={st.sortBtn} onPress={()=>{const n=Math.max(14,font-1);setFont(n);update('font_size',n);}}><Text style={st.outlineText}>−</Text></Pressable><Pressable style={st.sortBtn} onPress={()=>{const n=Math.min(32,font+1);setFont(n);update('font_size',n);}}><Text style={st.outlineText}>＋</Text></Pressable></View></View><View style={st.setting}><Text style={st.settingTitle}>تباعد الأسطر: {line.toFixed(1)}</Text><View style={st.sortRow}><Pressable style={st.sortBtn} onPress={()=>{const n=Math.max(1.3,line-.1);setLine(n);update('line_height',n);}}><Text style={st.outlineText}>−</Text></Pressable><Pressable style={st.sortBtn} onPress={()=>{const n=Math.min(2.5,line+.1);setLine(n);update('line_height',n);}}><Text style={st.outlineText}>＋</Text></Pressable></View></View><View style={st.setting}><Text style={st.settingTitle}>إظهار النص الإنجليزي بجانب الترجمة</Text><Switch value={english} onValueChange={v=>{setEnglish(v);update('show_english',v?1:0);}} trackColor={{true:P.gold}}/></View><View style={st.setting}><Text style={st.settingTitle}>الترجمة</Text><Text style={st.sub}>MyMemory أولًا، ثم Google Translate تلقائيًا عند الفشل. يلزم اتصال بالإنترنت.</Text></View><View style={st.setting}><Text style={st.settingTitle}>التخزين</Text><Text style={st.sub}>ملفات EPUB والترجمات محفوظة محليًا داخل التطبيق.</Text></View><Text style={st.muted}>الإصدار التجريبي · 0.5</Text></ScrollView></Screen>}
export function NovelScreen({route,navigation}:NativeStackScreenProps<RootStackParamList,'Novel'>){
 const [book,setBook]=useState<Book|undefined>();const [chapters,setChapters]=useState<any[]>([]);const [bulkBusy,setBulkBusy]=useState(false);const [bulkMessage,setBulkMessage]=useState('');const [bulkDone,setBulkDone]=useState(0);const [bulkTotal,setBulkTotal]=useState(0);const [selectionOpen,setSelectionOpen]=useState(false);const [selectedChapterIds,setSelectedChapterIds]=useState<number[]>([]);const [rangeStart,setRangeStart]=useState('1');const [rangeEnd,setRangeEnd]=useState('');
 const refresh=()=>{setBook(getBook(route.params.bookId));setChapters(listChapters(route.params.bookId));};
 useEffect(()=>{refresh();},[route.params.bookId]);
 useFocusEffect(useCallback(()=>{
  let alive=true;
  const check=async()=>{try{const running=await isBackgroundTranslationRunning();if(alive)setBulkBusy(running);}catch{}};
  check();const timer=setInterval(check,2500);
  return ()=>{alive=false;clearInterval(timer);};
 },[]));
 const chapterParagraphs=(content:string|null)=>String(content||'').split(/\n\n+/).map(x=>x.trim()).filter(Boolean);
 const statusFor=(c:any)=>{const total=chapterParagraphs(c.content).length;const x=getTranslationStatus(route.params.bookId,c.id);if(total>0&&x.done>=total)return {label:'مترجم',color:'#4C9B70'};if(x.done>0)return {label:`مترجم جزئيًا ${x.done}/${total}`,color:'#C08A2C'};if(x.failed>0)return {label:'تعذرت الترجمة',color:'#C45B5B'};return {label:'غير مترجم',color:P.muted};};
 const toggleChapterSelection=(id:number)=>setSelectedChapterIds(old=>old.includes(id)?old.filter(x=>x!==id):[...old,id]);
 const selectUntranslated=()=>setSelectedChapterIds(chapters.filter(c=>{const total=chapterParagraphs(c.content).length;const x=getTranslationStatus(route.params.bookId,c.id);return total>0&&x.done<total;}).map(c=>c.id));
 const selectRange=()=>{const a=Math.max(1,Math.min(chapters.length,parseInt(rangeStart||'1',10)||1));const b=Math.max(1,Math.min(chapters.length,parseInt(rangeEnd||String(chapters.length),10)||chapters.length));const lo=Math.min(a,b),hi=Math.max(a,b);setSelectedChapterIds(chapters.filter(c=>c.spine_index+1>=lo&&c.spine_index+1<=hi).map(c=>c.id));};
 const bulkTranslate=async()=>{
  if(bulkBusy)return;
  const chosen=chapters.filter(c=>selectedChapterIds.includes(c.id));
  if(!chosen.length){Alert.alert('لم تحدد فصولًا','اختر فصلًا واحدًا على الأقل.');return;}
  const pending=chosen.reduce((n,c)=>n+chapterParagraphs(c.content).filter((_,i)=>{const old=getTranslatedParagraph(route.params.bookId,c.id,i);return !(old?.status==='done'&&old.translated_text);}).length,0);
  if(!pending){Alert.alert('لا توجد فقرات معلقة','كل الفصول المحددة مترجمة بالفعل.');return;}
  Alert.alert('تأكيد الترجمة الجماعية',`سيتم تشغيل ترجمة ${chosen.length} فصلًا محددًا فقط، وبها ${pending} فقرة غير مكتملة. سيظهر إشعار دائم بالتقدم.`,[
   {text:'إلغاء',style:'cancel'},
   {text:'بدء الترجمة',onPress:async()=>{
    try{
     if(await isBackgroundTranslationRunning()){Alert.alert('هناك ترجمة تعمل بالفعل','انتظر انتهاء المهمة الحالية قبل بدء مهمة أخرى.');return;}
     if(Platform.OS==='android'&&Number(Platform.Version)>=33){
      const permission=await PermissionsAndroid.request(PermissionsAndroid.PERMISSIONS.POST_NOTIFICATIONS);
      if(permission!=='granted'){Alert.alert('الإشعارات مطلوبة','اسمح بالإشعارات حتى يظهر تقدم الترجمة في الخلفية.');return;}
     }
     setSelectionOpen(false);
     await startBackgroundTranslation({bookId:route.params.bookId,chapterIds:chosen.map(c=>c.id),bookTitle:book?.title||'الرواية'});
     setBulkBusy(true);setBulkTotal(pending);setBulkDone(0);
     setBulkMessage('بدأت الترجمة في الخلفية. تابع التقدم من إشعار الهاتف.');
     Alert.alert('بدأت الترجمة','يمكنك الخروج من الرواية واستخدام تطبيقات أخرى. سيظهر إشعار دائم بتقدم الترجمة.');
    }catch(e){Alert.alert('تعذر بدء الترجمة في الخلفية',String(e));}
   }}
  ]);
 };
 if(!book)return <Screen><EmptyState title="الرواية غير موجودة" body="قد تكون حُذفت من المكتبة."/></Screen>;
 return <Screen><ScrollView><View style={st.detailCover}>{book.cover_uri?<Image source={{uri:book.cover_uri}} style={st.detailImage}/>:<Text style={{color:P.gold,fontSize:34}}>✦</Text>}<Text style={st.detailTitle}>{book.title}</Text><Text style={st.sub}>{book.author||'مؤلف غير معروف'}</Text></View><Text style={st.sub}>{chapters.length} فصل · ملف EPUB محلي</Text><Pressable style={st.goldBtn} onPress={()=>{const pr=getProgress(book.id);const cid=pr?.chapter_id||chapters[0]?.id;if(cid){touchBook(book.id,cid);navigation.navigate('Reader',{bookId:book.id,chapterId:cid});}}}><Text style={st.goldBtnText}>متابعة القراءة</Text></Pressable><Pressable style={st.outlineBtn} onPress={()=>{toggleFavorite(book.id);setBook(getBook(book.id));}}><Text style={st.outlineText}>{book.is_favorite?'إزالة من المفضلة':'إضافة للمفضلة'}</Text></Pressable><Pressable disabled={bulkBusy} style={[st.goldBtn,{alignSelf:'stretch',opacity:bulkBusy?0.6:1}]} onPress={()=>setSelectionOpen(true)}><Text style={st.goldBtnText}>{bulkBusy?`جارٍ ترجمة المحدد ${bulkDone}/${bulkTotal}`:'اختيار فصول للترجمة الجماعية'}</Text></Pressable>{bulkMessage?<Text style={st.sub}>{bulkMessage}</Text>:null}
  <Modal visible={selectionOpen} transparent animationType="slide" onRequestClose={()=>setSelectionOpen(false)}>
   <View style={{flex:1,backgroundColor:'#0009',justifyContent:'center',padding:16}}><View style={{backgroundColor:'#24252A',borderRadius:18,padding:16,maxHeight:'88%'}}>
    <Text style={{color:'#fff',fontSize:20,fontWeight:'900',marginBottom:6}}>اختيار فصول الترجمة</Text>
    <Text style={{color:'#bbb',marginBottom:12}}>حدد الفصول المطلوبة فقط. الفقرات المكتملة سيتم تخطيها.</Text>
    <View style={{flexDirection:'row',gap:7,marginBottom:10}}>
     <Pressable style={[st.sortBtn,{flex:1}]} onPress={selectUntranslated}><Text style={{color:P.gold}}>غير المترجم</Text></Pressable>
     <Pressable style={[st.sortBtn,{flex:1}]} onPress={()=>setSelectedChapterIds(chapters.map(c=>c.id))}><Text style={{color:P.gold}}>تحديد الكل</Text></Pressable>
     <Pressable style={st.sortBtn} onPress={()=>setSelectedChapterIds([])}><Text style={{color:P.gold}}>مسح</Text></Pressable>
    </View>
    <Text style={{color:'#fff',fontWeight:'700',marginBottom:6}}>نطاق الفصول</Text>
    <View style={{flexDirection:'row',gap:8,alignItems:'center',marginBottom:10}}>
     <TextInput value={rangeStart} onChangeText={setRangeStart} keyboardType="number-pad" placeholder="من" placeholderTextColor="#999" style={[st.input,{flex:1,color:'#fff'}]}/>
     <Text style={{color:'#fff'}}>إلى</Text>
     <TextInput value={rangeEnd} onChangeText={setRangeEnd} keyboardType="number-pad" placeholder={String(chapters.length)} placeholderTextColor="#999" style={[st.input,{flex:1,color:'#fff'}]}/>
     <Pressable style={st.sortBtn} onPress={selectRange}><Text style={{color:P.gold}}>تحديد</Text></Pressable>
    </View>
    <Text style={{color:P.gold,fontWeight:'800',marginBottom:8}}>المحدد: {selectedChapterIds.length} من {chapters.length} فصل</Text>
    <FlatList data={chapters} keyExtractor={c=>String(c.id)} style={{maxHeight:300}} renderItem={({item:c})=>{
     const chosen=selectedChapterIds.includes(c.id);const total=chapterParagraphs(c.content).length;const status=getTranslationStatus(route.params.bookId,c.id);const complete=total>0&&status.done>=total;
     return <Pressable onPress={()=>toggleChapterSelection(c.id)} style={{flexDirection:'row',alignItems:'center',paddingVertical:10,borderBottomWidth:1,borderBottomColor:'#8883'}}>
      <View style={{width:24,height:24,borderRadius:6,borderWidth:1,borderColor:chosen?P.gold:'#888',backgroundColor:chosen?P.gold:'transparent',alignItems:'center',justifyContent:'center',marginRight:10}}><Text style={{color:'#111',fontWeight:'900'}}>{chosen?'✓':''}</Text></View>
      <View style={{flex:1}}><Text style={{color:'#fff',fontWeight:'700'}}>{c.title}</Text><Text style={{color:complete?'#4C9B70':'#aaa',fontSize:11}}>{complete?'مترجم بالكامل':`${status.done}/${total} فقرة مترجمة`}</Text></View><Text style={{color:'#aaa'}}>#{c.spine_index+1}</Text>
     </Pressable>;
    }}/>
    <View style={{flexDirection:'row',gap:10,marginTop:12}}>
     <Pressable style={[st.outlineBtn,{flex:1}]} onPress={()=>setSelectionOpen(false)}><Text style={st.outlineText}>إلغاء</Text></Pressable>
     <Pressable disabled={!selectedChapterIds.length||bulkBusy} style={[st.goldBtn,{flex:1,opacity:selectedChapterIds.length?1:.5}]} onPress={bulkTranslate}><Text style={st.goldBtnText}>ترجمة {selectedChapterIds.length} فصل</Text></Pressable>
    </View>
   </View></View>
  </Modal><SectionTitle>فهرس الفصول</SectionTitle>{chapters.map(c=>{const status=statusFor(c);return <Pressable key={c.id} style={st.chapterRow} onPress={()=>{touchBook(book.id,c.id);navigation.navigate('Reader',{bookId:book.id,chapterId:c.id});}}><View style={{flex:1}}><Text style={st.chapterTitle}>{c.title}</Text><Text style={{color:status.color,fontSize:11,marginTop:5,fontWeight:'700'}}>{status.label}</Text></View><Text style={st.muted}>الفصل {c.spine_index+1} ←</Text></Pressable>;})}</ScrollView></Screen>;
}
export function ReaderScreen({route,navigation}:NativeStackScreenProps<RootStackParamList,'Reader'>){
 const book=getBook(route.params.bookId);const chapters=listChapters(route.params.bookId);const [chapterId,setChapterId]=useState(route.params.chapterId||getProgress(route.params.bookId)?.chapter_id||chapters[0]?.id);const [paragraphs,setParagraphs]=useState<string[]>([]);const [translations,setTranslations]=useState<(string|null)[]>([]);const [busy,setBusy]=useState(false);const [progress,setProgressIndex]=useState(0);const [message,setMessage]=useState('');const [font,setFont]=useState(20);const [line,setLine]=useState(1.8);const [theme,setTheme]=useState('paper');const [english,setEnglish]=useState(false);const [controlsVisible,setControlsVisible]=useState(true);const [tocVisible,setTocVisible]=useState(false);const [tocSearchOpen,setTocSearchOpen]=useState(false);const [tocQuery,setTocQuery]=useState('');const [scrollPercent,setScrollPercent]=useState(0);const [viewportWidth,setViewportWidth]=useState(0);const insets=useSafeAreaInsets();const touchStart=useRef<{x:number;y:number;time:number}|null>(null);const lastSavedOffset=useRef(0);const scrollRef=useRef<ScrollView>(null);const savedOffset=useRef(0);const restored=useRef(false);const restoring=useRef(false);const pendingRestoreOffset=useRef(0);const scrollLayoutReady=useRef(false);const contentLayoutReady=useRef(false);
 const chapter=chapters.find(c=>c.id===chapterId);const refreshTranslations=()=>{if(!chapter)return;const ps=(chapter.content||'').split(/\n\n+/).map(x=>x.trim()).filter(Boolean);setParagraphs(ps);setTranslations(ps.map((_,i)=>getTranslatedParagraph(route.params.bookId,chapter.id,i)?.translated_text||null));};
 useEffect(()=>{const cfg=db.getFirstSync<any>('SELECT * FROM reading_settings WHERE id=1');if(cfg){setFont(cfg.font_size);setLine(cfg.line_height);setTheme(cfg.theme);setEnglish(!!cfg.show_english);}},[]);
 useEffect(()=>{
   if(!chapter)return;
   refreshTranslations();
   const restoreOffset=getReadingPosition(route.params.bookId,chapter.id);
   savedOffset.current=restoreOffset;
   lastSavedOffset.current=restoreOffset;
   pendingRestoreOffset.current=restoreOffset;
   restoring.current=true;
   restored.current=false;
   scrollLayoutReady.current=false;
   contentLayoutReady.current=false;
   setProgressIndex(0);
   setScrollPercent(0);
   setControlsVisible(true);
   setTocSearchOpen(false);
   setTocQuery('');
 },[chapterId]);
 const applyPendingRestore=()=>{
   if(!scrollLayoutReady.current||!contentLayoutReady.current||restored.current)return;
   const target=Math.max(0,pendingRestoreOffset.current);
   requestAnimationFrame(()=>{
     requestAnimationFrame(()=>{
       scrollRef.current?.scrollTo({y:target,animated:false});
       savedOffset.current=target;
       lastSavedOffset.current=target;
       restored.current=true;
       // Ignore any transient y=0 event generated while the native ScrollView
       // is laying out and applying the restored offset.
       setTimeout(()=>{restoring.current=false;},180);
     });
   });
 };
 useEffect(()=>{
   const persist=()=>{if(chapterId&&!restoring.current) safeSavePosition();};
   const unsubscribe=navigation.addListener('blur',persist);
   const appStateSub=AppState.addEventListener('change',state=>{if(state!=='active')persist();});
   return ()=>{unsubscribe();appStateSub.remove();};
 },[navigation,route.params.bookId,chapterId]);
 function safeSavePosition(){try{saveReadingPosition(route.params.bookId,chapterId,savedOffset.current);}catch{}}
 const startTranslation=async()=>{if(!chapter||busy)return;setBusy(true);setMessage('بدأت الترجمة...');addTranslationHistory(route.params.bookId,chapter.id,'started');let done=0;try{for(let i=0;i<paragraphs.length;i++){const existing=getTranslatedParagraph(route.params.bookId,chapter.id,i);if(existing?.status==='done'&&existing.translated_text){done++;continue;}try{const result=await translateParagraph(paragraphs[i]);saveTranslation(route.params.bookId,chapter.id,i,paragraphs[i],result.text);done++;saveProgress(route.params.bookId,chapter.id,i+1);setProgressIndex(i+1);setTranslations(old=>{const n=[...old];n[i]=result.text;return n;});setMessage(`تمت ترجمة ${done} من ${paragraphs.length} فقرة · ${result.provider}`);}catch(e){markTranslationFailed(route.params.bookId,chapter.id,i,paragraphs[i],String(e));addTranslationHistory(route.params.bookId,chapter.id,'failed',`فقرة ${i+1}: ${String(e)}`);setMessage(`توقفت عند الفقرة ${i+1}. يمكنك إعادة المحاولة.`);Alert.alert('توقفت الترجمة',`تم حفظ ${done} فقرة. اضغط متابعة الترجمة لاستكمال الباقي.\n${String(e)}`);return;}}addTranslationHistory(route.params.bookId,chapter.id,'done');setMessage('اكتملت ترجمة الفصل.');Alert.alert('اكتملت الترجمة',`تمت ترجمة ${done} فقرة.`);}finally{setBusy(false);refreshTranslations();}};
  const goChapter=(delta:number)=>{
    const idx=chapters.findIndex(c=>c.id===chapterId);
    const next=chapters[idx+delta];
    if(!next)return;
    // Save the chapter being left before resetting transient reader refs.
    saveReadingPosition(route.params.bookId,chapterId,savedOffset.current);
    restoring.current=true;
    savedOffset.current=0;
    lastSavedOffset.current=0;
    pendingRestoreOffset.current=0;
    restored.current=false;
    scrollLayoutReady.current=false;
    contentLayoutReady.current=false;
    setScrollPercent(0);
    setChapterId(next.id);
    setProgressIndex(0);
  };
 const onScroll=(e:any)=>{
   const {contentOffset,contentSize,layoutMeasurement}=e.nativeEvent;
   const max=Math.max(1,contentSize.height-layoutMeasurement.height);
   const y=Math.max(0,contentOffset.y);
   if(restoring.current){
     setScrollPercent(Math.min(100,Math.round(y/max*100)));
     return;
   }
   savedOffset.current=y;
   if(Math.abs(y-lastSavedOffset.current)>80){
     saveReadingPosition(route.params.bookId,chapterId,y);
     lastSavedOffset.current=y;
   }
   setScrollPercent(Math.min(100,Math.round(y/max*100)));
 };
 const onTouchStart=(e:any)=>{const t=e.nativeEvent;touchStart.current={x:t.pageX,y:t.pageY,time:Date.now()};};
 const onTouchEnd=(e:any)=>{const start=touchStart.current;if(!start)return;const t=e.nativeEvent;const dx=Math.abs(t.pageX-start.x),dy=Math.abs(t.pageY-start.y),dt=Date.now()-start.time;touchStart.current=null;if(dx<9&&dy<9&&dt<450&&viewportWidth>0&&start.x>viewportWidth*.36&&start.x<viewportWidth*.64){setControlsVisible(v=>!v);}};
 const showTOC=()=>setTocVisible(true);
 if(!book||!chapter)return <View style={{flex:1,backgroundColor:P.bg,justifyContent:'center',padding:20}}><EmptyState title="لا توجد فصول للقراءة" body="تأكد من نجاح استخراج فصول ملف EPUB."/></View>;
 const paper=theme==='paper';const bg=paper?'#E9DFC9':theme==='light'?'#FAFAF7':'#171A1C';const ink=paper?'#28241F':theme==='light'?'#222':'#EAE8E2';
 return <View style={{flex:1,backgroundColor:bg,paddingTop:insets.top,paddingBottom:insets.bottom}} onLayout={e=>setViewportWidth(e.nativeEvent.layout.width)}>
  <View style={{height:3,backgroundColor:'#0002'}}><View style={{height:3,width:`${scrollPercent}%`,backgroundColor:P.gold}}/></View>
  {controlsVisible&&<View style={st.readerTop}><Pressable onPress={()=>navigation.goBack()}><Text style={{color:ink}}>رجوع</Text></Pressable><Text numberOfLines={1} style={{color:ink,fontWeight:'800',flex:1,textAlign:'center'}}>{chapter.title}</Text><Pressable onPress={showTOC}><Text style={{color:ink}}>الفهرس</Text></Pressable></View>}
  <Modal visible={tocVisible} transparent animationType="fade" onRequestClose={()=>setTocVisible(false)}><View style={{flex:1,backgroundColor:'#0009',justifyContent:'center',padding:18}}><View style={{maxHeight:'82%',backgroundColor:bg,borderRadius:18,padding:16}}><View style={{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginBottom:12}}><Text style={{color:ink,fontSize:19,fontWeight:'900'}}>فهرس الفصول</Text><View style={{flexDirection:'row',alignItems:'center',gap:16}}><Pressable onPress={()=>{setTocSearchOpen(v=>!v);setTocQuery('');}}><Text style={{color:ink,fontSize:20}}>⌕</Text></Pressable><Pressable onPress={()=>setTocVisible(false)}><Text style={{color:ink,fontSize:22}}>×</Text></Pressable></View></View>{tocSearchOpen&&<TextInput value={tocQuery} onChangeText={setTocQuery} autoFocus placeholder="ابحث برقم الفصل أو اسمه..." placeholderTextColor={P.muted} style={[st.input,{marginBottom:10,color:ink}]}/>}<FlatList data={chapters.filter(c=>String(c.title||'').toLowerCase().includes(tocQuery.toLowerCase())||String(c.spine_index+1).includes(tocQuery.trim()))} keyExtractor={c=>String(c.id)} renderItem={({item:c})=>{const total=String(c.content||'').split(/\n\n+/).filter(x=>x.trim()).length;const x=getTranslationStatus(route.params.bookId,c.id);const complete=total>0&&x.done>=total;const partial=x.done>0&&!complete;const label=complete?'مترجم':partial?`مترجم جزئيًا ${x.done}/${total}`:x.failed>0?'فشل جزء من الترجمة':'غير مترجم';const color=complete?'#4C9B70':partial?'#C08A2C':x.failed>0?'#C45B5B':P.muted;return <Pressable onPress={()=>{saveReadingPosition(route.params.bookId,chapterId,savedOffset.current);setChapterId(c.id);setTocVisible(false);}} style={{paddingVertical:12,borderBottomWidth:1,borderBottomColor:'#8884'}}><Text style={{color:ink,fontWeight:'700'}}>{c.title}</Text><Text style={{color,fontSize:12,marginTop:4}}>{label}</Text></Pressable>;}}/></View></View></Modal>
  <ScrollView key={`reader-chapter-${chapterId}`} ref={scrollRef} onLayout={()=>{scrollLayoutReady.current=true;applyPendingRestore();}} onScroll={onScroll} onScrollEndDrag={()=>{if(!restoring.current)safeSavePosition();}} onMomentumScrollEnd={()=>{if(!restoring.current)safeSavePosition();}} scrollEventThrottle={16} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd} onContentSizeChange={()=>{contentLayoutReady.current=true;applyPendingRestore();}} contentContainerStyle={{paddingHorizontal:22,paddingTop:18,paddingBottom:45}}>
   <Text style={{color:ink,fontSize:23,fontWeight:'900',textAlign:'center',marginBottom:20}}>{chapter.title}</Text>
   {paragraphs.map((p,i)=><View key={i} style={{marginBottom:22}}>{english&&<Text style={{color:ink,opacity:.7,fontSize:font-2,lineHeight:font*line,textAlign:'left',marginBottom:8}}>{p}</Text>}<Text style={{color:ink,fontSize:font,lineHeight:font*line,textAlign:'right'}}>{translations[i]|| (translations.some(Boolean)?'…':p)}</Text></View>)}
  </ScrollView>
  {controlsVisible&&<View style={st.readerBottom}><View style={{height:4,backgroundColor:'#0002',borderRadius:5,marginBottom:8}}><View style={{height:4,width:`${scrollPercent}%`,backgroundColor:P.gold,borderRadius:5}}/></View><Text style={{color:ink,fontSize:11,textAlign:'center'}}>{scrollPercent}% من الفصل · {translations.filter(Boolean).length}/{paragraphs.length} فقرة مترجمة {message?`· ${message}`:''}</Text><View style={st.readerActions}><Pressable style={st.outlineBtnSmall} onPress={()=>goChapter(-1)}><Text style={{color:ink}}>السابق</Text></Pressable><Pressable disabled={busy} style={[st.goldBtn,{opacity:busy?0.5:1}]} onPress={startTranslation}><Text style={st.goldBtnText}>{busy?'جارٍ الترجمة...':'ترجمة الفصل / استكمال'}</Text></Pressable><Pressable style={st.outlineBtnSmall} onPress={()=>goChapter(1)}><Text style={{color:ink}}>التالي</Text></Pressable></View><View style={{flexDirection:'row',justifyContent:'space-between',marginTop:8}}><Pressable onPress={()=>{const n=Math.max(14,font-1);setFont(n);db.runSync('UPDATE reading_settings SET font_size=? WHERE id=1',[n]);}}><Text style={{color:ink}}>A−</Text></Pressable><Pressable onPress={()=>{const n=Math.min(32,font+1);setFont(n);db.runSync('UPDATE reading_settings SET font_size=? WHERE id=1',[n]);}}><Text style={{color:ink}}>A＋</Text></Pressable><Pressable onPress={()=>{const n=!english;setEnglish(n);db.runSync('UPDATE reading_settings SET show_english=? WHERE id=1',[n?1:0]);}}><Text style={{color:ink}}>{english?'إخفاء الإنجليزي':'إظهار الإنجليزي'}</Text></Pressable></View></View>}
  {!controlsVisible&&<View pointerEvents="none" style={{position:'absolute',bottom:4,alignSelf:'center'}}><Text style={{color:ink,opacity:.45,fontSize:10}}>اضغط منتصف الشاشة لإظهار أدوات القراءة</Text></View>}
 </View>;
}
const st=StyleSheet.create({brand:{color:P.gold,fontSize:10,fontWeight:'900',letterSpacing:3},heading:{color:P.text,fontSize:28,fontWeight:'900',marginTop:5},sub:{color:P.muted,fontSize:13,marginTop:5,lineHeight:20},hero:{backgroundColor:P.panel2,borderRadius:18,padding:20,borderWidth:1,borderColor:'#4B4436'},heroEyebrow:{color:P.gold,fontSize:12,fontWeight:'800'},heroTitle:{color:P.text,fontSize:22,fontWeight:'900',marginTop:8,marginBottom:4},goldBtn:{backgroundColor:P.gold,borderRadius:12,paddingVertical:13,paddingHorizontal:16,alignItems:'center',alignSelf:'flex-start',marginTop:14},goldBtnText:{color:'#171717',fontWeight:'900',fontSize:13},outlineBtn:{borderWidth:1,borderColor:P.gold,borderRadius:12,padding:13,alignItems:'center',marginTop:12},outlineText:{color:P.gold,fontWeight:'800'},grid:{flexDirection:'row',flexWrap:'wrap',justifyContent:'space-between'},input:{backgroundColor:P.panel,borderColor:P.line,borderWidth:1,borderRadius:12,padding:13,color:P.text},sortRow:{flexDirection:'row',gap:8,marginTop:10,flexWrap:'wrap'},sortBtn:{borderWidth:1,borderColor:P.line,borderRadius:18,paddingVertical:8,paddingHorizontal:13},sortActive:{borderColor:P.gold},setting:{paddingVertical:17,borderBottomWidth:1,borderBottomColor:P.line},settingTitle:{color:P.text,fontSize:15,fontWeight:'800'},detailCover:{height:245,backgroundColor:P.panel2,borderRadius:18,alignItems:'center',justifyContent:'center',padding:20,marginBottom:12},detailTitle:{color:P.text,fontSize:23,fontWeight:'900',textAlign:'center',marginVertical:12},detailImage:{width:110,height:155,resizeMode:'contain',borderRadius:8},chapterRow:{paddingVertical:14,borderBottomWidth:1,borderBottomColor:P.line,flexDirection:'row',justifyContent:'space-between'},chapterTitle:{color:P.text,fontWeight:'700',flex:1},statGrid:{flexDirection:'row',flexWrap:'wrap',gap:10,marginTop:16},stat:{width:'47%',backgroundColor:P.panel,borderWidth:1,borderColor:P.line,borderRadius:14,padding:18},statNum:{color:P.gold,fontSize:25,fontWeight:'900'},activity:{paddingVertical:14,borderBottomWidth:1,borderBottomColor:P.line},muted:{color:P.muted,fontSize:11,marginTop:4},readerTop:{paddingHorizontal:18,paddingVertical:14,flexDirection:'row',alignItems:'center',gap:12,borderBottomWidth:1,borderColor:'#0002'},readerBottom:{padding:14,borderTopWidth:1,borderColor:'#0002'},readerActions:{flexDirection:'row',alignItems:'center',justifyContent:'space-between',gap:8},outlineBtnSmall:{borderWidth:1,borderColor:'#88764f',borderRadius:10,padding:10}});
