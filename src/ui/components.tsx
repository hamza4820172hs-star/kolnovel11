import React from 'react';
import {View,Text,Pressable,StyleSheet,Image} from 'react-native';
import {Palette as P} from './theme';
export function Screen({children}:{children:React.ReactNode}) {return <View style={s.screen}>{children}</View>}
export function SectionTitle({children,action,onAction}:{children:string;action?:string;onAction?:()=>void}) {
 return <View style={s.section}><Text style={s.sectionTitle}>{children}</Text>{action&&<Pressable onPress={onAction}><Text style={s.action}>{action}</Text></Pressable>}</View>;
}
export function EmptyState({title,body}:{title:string;body:string}) {return <View style={s.empty}><Text style={s.emptyTitle}>{title}</Text><Text style={s.muted}>{body}</Text></View>}
export function BookTile({title,author,onPress,favorite,coverUri}:{title:string;author?:string|null;onPress:()=>void;favorite?:boolean;coverUri?:string|null}) {
 return <Pressable onPress={onPress} style={s.book}>
  <View style={s.cover}>{coverUri?<Image source={{uri:coverUri}} style={s.coverImage}/>:<><Text style={s.coverMark}>✦</Text><Text style={s.coverTitle} numberOfLines={3}>{title}</Text><Text style={s.coverFoot}>NOVEL</Text></>}</View>
  <Text style={s.bookTitle} numberOfLines={1}>{title}</Text><Text style={s.muted} numberOfLines={1}>{author||'مؤلف غير معروف'}</Text>
  {favorite?<Text style={s.fav}>★</Text>:null}
 </Pressable>;
}
const s=StyleSheet.create({
 screen:{flex:1,backgroundColor:P.bg,padding:16},section:{flexDirection:'row',justifyContent:'space-between',alignItems:'center',marginTop:18,marginBottom:12},
 sectionTitle:{color:P.text,fontSize:18,fontWeight:'800'},action:{color:P.gold,fontSize:13,fontWeight:'700'},
 empty:{padding:24,alignItems:'center',gap:8,borderWidth:1,borderColor:P.line,borderRadius:16,marginTop:16},
 emptyTitle:{color:P.text,fontWeight:'800',fontSize:16},muted:{color:P.muted,fontSize:12},
 book:{width:'30%',marginBottom:18},cover:{height:142,borderRadius:9,backgroundColor:'#343B3E',borderWidth:1,borderColor:'#555047',padding:9,justifyContent:'space-between',alignItems:'center',overflow:'hidden'},coverImage:{width:'100%',height:'100%',resizeMode:'cover'},
 coverMark:{color:P.gold,fontSize:20},coverTitle:{color:P.text,fontSize:12,fontWeight:'800',textAlign:'center'},coverFoot:{color:P.gold,fontSize:8,letterSpacing:2},
 bookTitle:{color:P.text,fontSize:12,fontWeight:'700',marginTop:7},fav:{position:'absolute',top:5,right:5,color:P.gold}
});