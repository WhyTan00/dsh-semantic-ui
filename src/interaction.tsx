import {createContext,useContext,useState,useCallback,type Dispatch,type SetStateAction} from 'react';
import type {Interaction} from './results';
export const InteractionContext=createContext<{state:Interaction;set:Dispatch<SetStateAction<Interaction>>;saveDraft?:()=>Promise<void>;saveScenarios?:()=>Promise<void>}|null>(null);
/** Standalone components retain local behavior; the normal workspace owns exportable state. */
export function useResultField<T>(key:string,initial:T|(()=>T)):[T,Dispatch<SetStateAction<T>>]{
 const context=useContext(InteractionContext),[local,setLocal]=useState(initial);
 const dispatch=context?.set;
 const set=useCallback<Dispatch<SetStateAction<T>>>(next=>{
  if(!dispatch){setLocal(next);return;}
  dispatch(old=>{const prior=(old as unknown as Record<string,unknown>)[key] as T,value=typeof next==='function'?(next as (v:T)=>T)(prior):next;
   if(Object.is(prior,value)||JSON.stringify(prior)===JSON.stringify(value))return old;
   const result={...old,[key]:value};if(value===undefined)delete (result as Record<string,unknown>)[key];return result;});
 },[dispatch,key]);
 return [context?(context.state as unknown as Record<string,unknown>)[key] as T:local,set];
}
