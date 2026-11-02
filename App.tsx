import React, {useEffect, useState} from 'react';
import {ActivityIndicator, View} from 'react-native';
import {NavigationContainer, DarkTheme} from '@react-navigation/native';
import {createBottomTabNavigator} from '@react-navigation/bottom-tabs';
import {createNativeStackNavigator} from '@react-navigation/native-stack';
import {StatusBar} from 'expo-status-bar';
import {SafeAreaProvider} from 'react-native-safe-area-context';
import {initDatabase} from './src/db/database';
import {Palette} from './src/ui/theme';
import {HomeScreen, BrowseScreen, LibraryScreen, ActivityScreen, SettingsScreen, NovelScreen, ReaderScreen} from './src/screens';

export type RootStackParamList = {
  Tabs: undefined;
  Novel: {bookId: number};
  Reader: {bookId: number; chapterId?: number};
};
const Stack = createNativeStackNavigator<RootStackParamList>();
const Tabs = createBottomTabNavigator();

function TabNavigator() {
  return <Tabs.Navigator screenOptions={{
    headerShown:false, tabBarStyle:{backgroundColor:Palette.panel,borderTopColor:Palette.line,height:62,paddingTop:6,paddingBottom:7},
    tabBarActiveTintColor:Palette.gold, tabBarInactiveTintColor:Palette.muted,
    tabBarLabelStyle:{fontSize:11,fontWeight:'600'}
  }}>
    <Tabs.Screen name="الرئيسية" component={HomeScreen} options={{tabBarLabel:'الرئيسية',tabBarIcon:({color})=><TabGlyph glyph="⌂" color={color}/>}}/>
    <Tabs.Screen name="اكتشف" component={BrowseScreen} options={{tabBarLabel:'اكتشف',tabBarIcon:({color})=><TabGlyph glyph="⌕" color={color}/>}}/>
    <Tabs.Screen name="مكتبتي" component={LibraryScreen} options={{tabBarLabel:'مكتبتي',tabBarIcon:({color})=><TabGlyph glyph="▤" color={color}/>}}/>
    <Tabs.Screen name="النشاط" component={ActivityScreen} options={{tabBarLabel:'النشاط',tabBarIcon:({color})=><TabGlyph glyph="◷" color={color}/>}}/>
    <Tabs.Screen name="الإعدادات" component={SettingsScreen} options={{tabBarLabel:'الإعدادات',tabBarIcon:({color})=><TabGlyph glyph="⚙" color={color}/>}}/>
  </Tabs.Navigator>;
}
function TabGlyph({glyph,color}:{glyph:string;color:string}) {
  const {Text}=require('react-native');
  return <Text style={{color,fontSize:20,fontWeight:'700'}}>{glyph}</Text>;
}
export default function App() {
  const [ready,setReady]=useState(false);
  const [error,setError]=useState<string|null>(null);
  useEffect(()=>{initDatabase().then(()=>setReady(true)).catch(e=>setError(String(e)));},[]);
  if(!ready) return <View style={{flex:1,backgroundColor:Palette.bg,alignItems:'center',justifyContent:'center'}}><ActivityIndicator color={Palette.gold}/></View>;
  return <SafeAreaProvider>
    <StatusBar style="light"/>
    <NavigationContainer theme={{...DarkTheme,colors:{...DarkTheme.colors,background:Palette.bg,card:Palette.panel,text:Palette.text,border:Palette.line,primary:Palette.gold}}}>
      <Stack.Navigator screenOptions={{headerStyle:{backgroundColor:Palette.panel},headerTintColor:Palette.text,contentStyle:{backgroundColor:Palette.bg}}}>
        <Stack.Screen name="Tabs" component={TabNavigator} options={{headerShown:false}}/>
        <Stack.Screen name="Novel" component={NovelScreen} options={{title:'تفاصيل الرواية'}}/>
        <Stack.Screen name="Reader" component={ReaderScreen} options={{headerShown:false}}/>
      </Stack.Navigator>
    </NavigationContainer>
  </SafeAreaProvider>;
}