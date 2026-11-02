import JSZip from 'jszip';
import {XMLParser} from 'fast-xml-parser';
import * as FileSystem from 'expo-file-system/legacy';

export type ParsedChapter={spineIndex:number;title:string;href:string;content:string;paragraphs:string[]};
export type ParsedEpub={title:string;author:string|null;description:string|null;coverDataUri:string|null;chapters:ParsedChapter[]};
const parser=new XMLParser({ignoreAttributes:false,attributeNamePrefix:'@_',textNodeName:'#text',trimValues:true,parseTagValue:false});
const arr=<T,>(v:T|T[]|undefined|null):T[]=>v==null?[]:Array.isArray(v)?v:[v];
const text=(v:any):string=>typeof v==='string'?v:typeof v?.['#text']==='string'?v['#text']:'';
const decode=(s:string)=>s.replace(/&nbsp;/g,' ').replace(/&amp;/g,'&').replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&quot;/g,'"').replace(/&#39;|&apos;/g,"'").replace(/&#(\d+);/g,(_,n)=>String.fromCodePoint(Number(n))).replace(/&#x([\da-f]+);/gi,(_,n)=>String.fromCodePoint(parseInt(n,16)));
function cleanHtml(html:string){
 const normalized=html.replace(/<!--[\s\S]*?-->/g,' ').replace(/<(script|style|svg|head)\b[\s\S]*?<\/\1>/gi,' ').replace(/<br\s*\/?>/gi,'\n').replace(/<\/(p|div|h[1-6]|li|blockquote|section|tr)>/gi,'\n\n').replace(/<[^>]+>/g,' ');
 return decode(normalized.replace(/\s+\n/g,'\n').replace(/[\t\r ]+/g,' ').replace(/\n[ \t]*/g,'\n')).split(/\n+/).map(x=>x.trim()).filter(x=>x.length>0);
}
function dirname(p:string){const i=p.lastIndexOf('/');return i<0?'':p.slice(0,i+1)}
function resolve(base:string,href:string){const raw=(dirname(base)+href.split('#')[0]).replace(/\\/g,'/');const out:string[]=[];for(const part of raw.split('/')){if(!part||part==='.')continue;if(part==='..')out.pop();else out.push(decodeURIComponent(part));}return out.join('/')}
function mime(path:string){const ext=path.split('.').pop()?.toLowerCase();return ext==='png'?'image/png':ext==='jpg'||ext==='jpeg'?'image/jpeg':ext==='gif'?'image/gif':ext==='webp'?'image/webp':'image/jpeg'}
export async function parseEpub(uri:string,filename:string):Promise<ParsedEpub>{
 const b64=await FileSystem.readAsStringAsync(uri,{encoding:FileSystem.EncodingType.Base64});
 const zip=await JSZip.loadAsync(b64,{base64:true});
 const container=zip.file('META-INF/container.xml');if(!container)throw new Error('ملف EPUB غير صالح: ملف container.xml غير موجود');
 const cxml=parser.parse(await container.async('text'));const root=arr(cxml?.container?.rootfiles?.rootfile)[0];const opfPath=root?.['@_full-path'];if(!opfPath||!zip.file(opfPath))throw new Error('تعذر العثور على ملف بيانات EPUB');
 const opf=parser.parse(await zip.file(opfPath)!.async('text'));const pkg=opf.package||{};const metadata=pkg.metadata||{};const manifestItems=arr(pkg.manifest?.item);const spineItems=arr(pkg.spine?.itemref);
 const title=text(metadata['dc:title']||metadata.title)||filename.replace(/\.epub$/i,'');const author=text(metadata['dc:creator']||metadata.creator)||null;const description=text(metadata['dc:description']||metadata.description)||null;
 const byId=new Map<string,any>();for(const item of manifestItems)byId.set(item['@_id'],item);
 let coverPath:string|undefined;const metaCover=arr(metadata.meta).find((m:any)=>m['@_name']==='cover')?.['@_content'];const coverItem=manifestItems.find((m:any)=>m['@_id']===metaCover)||manifestItems.find((m:any)=>String(m['@_properties']||'').includes('cover-image'));
 if(coverItem?.['@_href'])coverPath=resolve(opfPath,coverItem['@_href']);
 let coverDataUri:string|null=null;if(coverPath&&zip.file(coverPath)){const data=await zip.file(coverPath)!.async('base64');coverDataUri=`data:${mime(coverPath)};base64,${data}`;}
 const chapters:ParsedChapter[]=[];let index=0;
 for(const ref of spineItems){const item=byId.get(ref['@_idref']);if(!item?.['@_href'])continue;const href=resolve(opfPath,item['@_href']);const file=zip.file(href);if(!file)continue;const html=await file.async('text');const paragraphs=cleanHtml(html);if(!paragraphs.length)continue;
  const titleMatch=html.match(/<h[1-6][^>]*>([\s\S]*?)<\/h[1-6]>/i);const chapterTitle=titleMatch?cleanHtml(titleMatch[1])[0]:'';
  chapters.push({spineIndex:index++,title:chapterTitle||`الفصل ${chapters.length+1}`,href,content:paragraphs.join('\n\n'),paragraphs});
 }
 if(!chapters.length)throw new Error('لم أستطع استخراج فصول نصية من هذا الملف. قد يكون EPUB مصورًا أو بتنسيق غير مدعوم.');
 return {title,author,description,coverDataUri,chapters};
}
