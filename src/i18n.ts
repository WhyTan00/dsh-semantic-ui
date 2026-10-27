import{createContext,useContext,useSyncExternalStore}from'react';
import{zhCN}from'./locales/zh-CN';
export type Locale='zh-CN'|'en';
export const LOCALE_KEY='dsh-semantic-ui.locale.v1';
const changed='dsh-semantic-ui:locale';
const valid=(v:unknown):v is Locale=>v==='zh-CN'||v==='en';
let memory:Locale|undefined;
const english=new Map<string,string>(Object.entries(zhCN).map(([en,zh])=>[zh,en]));
export function translate(locale:Locale,key:string){return locale==='zh-CN'?(zhCN as Record<string,string>)[key]??key:english.get(key)??key;}
function snapshot():Locale{if(memory)return memory;try{const saved=window.localStorage.getItem(LOCALE_KEY);return valid(saved)?saved:'zh-CN';}catch{return 'zh-CN';}}
function subscribe(notify:()=>void){
 if(typeof window==='undefined')return()=>{};
 const local=(event:Event)=>{const value=(event as CustomEvent).detail;if(valid(value))memory=value;notify();};
 const storage=(event:StorageEvent)=>{if(event.key===LOCALE_KEY||event.key===null){memory=valid(event.newValue)?event.newValue:'zh-CN';notify();}};
 window.addEventListener(changed,local);window.addEventListener('storage',storage);
 return()=>{window.removeEventListener(changed,local);window.removeEventListener('storage',storage);};
}
export function setLocale(locale:Locale){
 if(!valid(locale))return;memory=locale;
 if(typeof window==='undefined')return;
 try{window.localStorage.setItem(LOCALE_KEY,locale);}catch{/* Usable for this page when storage is unavailable. */}
 window.dispatchEvent(new CustomEvent(changed,{detail:locale}));
}
/** Explicit override is useful for embedding and server-rendered snapshots. */
export const LocaleContext=createContext<Locale|null>(null);
export function useI18n(){
 const override=useContext(LocaleContext),saved=useSyncExternalStore(subscribe,snapshot,()=> 'zh-CN' as Locale),locale=override??saved;
 return {locale,t:(key:string)=>translate(locale,key),setLocale};
}
