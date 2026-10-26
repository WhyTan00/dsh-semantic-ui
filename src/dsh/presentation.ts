import {randomUUID} from 'node:crypto';
import {bounded} from '../protocol';
import {META,type Checkpoint} from './events';

/** A short-lived one-use reference survives the host's canonical JSON clone.
 * The saved payload is the checked snapshot, never rebuilt from tool args.
 * Bounded pending memory is not a second conversation store. */
export function createPresentationChannel(){
 const pending=new Map<string,{json:string;turn:number;displayId:string;revision?:number;status:string}>();
 return {
  remember(checkpoint:Checkpoint){
   if(pending.size>=32)throw Error('PRESENTATION_CAPACITY: Too many unconsumed delivery snapshots; retry after pending tool dispatches finish.');
   const issue=bounded(checkpoint);if(issue)throw Error('PRESENTATION_LIMIT: The complete checkpoint exceeds the delivery budget.');
   const key=randomUUID();pending.set(key,{json:JSON.stringify(checkpoint),turn:checkpoint.turn,displayId:checkpoint.view?.displayId??checkpoint.displayId!,revision:checkpoint.view?.revision,status:checkpoint.view?'delivered':'validation-failed'});return key;
  },
  presentationMeta(_args:unknown,value:unknown){
   const r=value as {deliveryId?:string;turn?:number;displayId?:string;revision?:number;status?:string};
   if(!r||typeof r.deliveryId!=='string')return null;const saved=pending.get(r.deliveryId);if(!saved)return null;pending.delete(r.deliveryId);
   if(r.turn!==saved.turn||r.displayId!==saved.displayId||r.revision!==saved.revision||r.status!==saved.status)return null;
   return {[META]:JSON.parse(saved.json)};
  },
 };
}
