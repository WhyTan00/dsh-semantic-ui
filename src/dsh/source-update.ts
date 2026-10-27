import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {Context} from '@deepseek-ai/cordis';
import {appendPluginRecord,pluginRecordOf,type Session,type SessionStore} from '@deepseek-ai/dsh-session';
import type {ProjectionDefinition} from '@deepseek-ai/dsh-session-projection';
import {clientRequestSchema} from '@deepseek-ai/dsh-client-connection';
import {currentSourceProjection,currentSourceSchema,snapshotCurrentSource} from './source';
import {checkpointOf} from './definition';
import {sourceDeliverySchema,sourceHostContextSchema} from '../source-delivery-meta';
import {validateEnvelope} from '../protocol';
import {sourceUpdateBaseSchema,sourceUpdateRequestSchema,SOURCE_UPDATE_ENDPOINT,type SourceUpdateBase,type SourceUpdateResult} from '../source-update-contract';
import {reviseUnknownCondition,sameUpdateBase,sourceTextSha,sourceUpdateFields,updateFlags,updateWithheld} from '../source-update';
import type {SourceSnapshot} from '../source-graph';

const RECORD='plugin:dsh-semantic-ui/source-update-intent';
const intentSchema=z.strictObject({version:z.literal(1),requestId:z.uuid(),base:sourceUpdateBaseSchema,condition:z.string().min(1).max(160),value:z.boolean(),nextTextSha256:z.string().regex(/^[a-f0-9]{64}$/),change:z.strictObject({condition:z.string(),from:z.null(),to:z.boolean(),textByteStart:z.number().int().nonnegative(),textByteEnd:z.number().int().nonnegative(),before:z.string(),after:z.string()})});
type Intent=z.infer<typeof intentSchema>;
type Receipt={intent:Intent;issue?:string;message?:NonNullable<SourceUpdateResult['message']>;checkpoint?:NonNullable<SourceUpdateResult['checkpoint']>};
interface UpdateState{current:z.infer<typeof currentSourceSchema>;base:{identity:SourceUpdateBase;source:SourceSnapshot;checkpointSha256:string}|null;receipts:Receipt[];blocked:boolean}
declare module '@deepseek-ai/dsh-session/types'{interface PluginRecordMap{'plugin:dsh-semantic-ui/source-update-intent':Intent}}
declare module '@deepseek-ai/dsh-session-projection/types'{
 interface SessionProjectionStateMap{dshSemanticSourceUpdates:UpdateState}
 interface SessionProjectionMap{dshSemanticSourceUpdates:{receipts:Receipt[];blocked:boolean}}
}
const receiptSchema=z.strictObject({intent:intentSchema,issue:z.string().optional(),message:z.strictObject({id:z.string(),seq:z.number(),turn:z.number(),turnStartSeq:z.number(),requestId:z.string(),textSha256:z.string()}).optional(),checkpoint:z.strictObject({seq:z.number(),displayId:z.string(),revision:z.number(),textSha256:z.string(),explanation:z.string()}).optional()});
const stateSchema=z.strictObject({current:currentSourceSchema,base:z.strictObject({identity:sourceUpdateBaseSchema,checkpointSha256:z.string().regex(/^[a-f0-9]{64}$/),source:z.strictObject({kind:z.literal('decision-zh'),textSha256:z.string(),excerptSha256:z.string(),textBytes:z.number(),textByteStart:z.literal(0),textByteEnd:z.number(),excerpt:z.string(),hostContext:sourceHostContextSchema})}).nullable(),receipts:z.array(receiptSchema).max(16),blocked:z.boolean()});
const wireSchema=z.strictObject({receipts:z.array(receiptSchema).max(16),blocked:z.boolean()});
function receiptResult(r:Receipt,blocked:boolean,durable:boolean):SourceUpdateResult{
 const result={...updateFlags,requestId:r.intent.requestId,base:r.intent.base,change:r.intent.change,nextTextSha256:r.intent.nextTextSha256,durable,...(durable&&r.message?{message:r.message}:{}),...(durable&&r.checkpoint?{checkpoint:r.checkpoint}:{})};
 if(r.issue||blocked)return {...result,status:'withheld',code:r.issue??'UPDATE_HISTORY_INVALID'};
 return {...result,status:durable?(r.checkpoint?'adopted':r.message?'message-persisted':'unknown'):'unknown',...(!durable?{code:'UPDATE_DURABILITY_UNCONFIRMED'}:{})};
}
/** Flush promises the pre-existing prefix, not events appended while awaiting it.
 * Capture and detach the exact projection before crossing that async boundary. */
export async function flushSourceUpdateReceipt(read:()=>{receipt:Receipt|undefined;blocked:boolean;asOfSeq:number},flush:()=>Promise<boolean>,requestId:string):Promise<SourceUpdateResult>{
 const cut=structuredClone(read());
 const durable=await flush();
 return cut.receipt?{...receiptResult(cut.receipt,cut.blocked,durable),asOfSeq:cut.asOfSeq}:{...updateWithheld('UPDATE_REQUEST_UNKNOWN'),requestId,asOfSeq:cut.asOfSeq};
}
export const sourceUpdateProjection:ProjectionDefinition<'dshSemanticSourceUpdates'>&{wire:NonNullable<ProjectionDefinition<'dshSemanticSourceUpdates'>['wire']>}={
 key:'dshSemanticSourceUpdates',stateVersion:2,stateSchema:stateSchema as z.ZodType<UpdateState>,
 wire:{viewSchema:wireSchema,view:s=>({receipts:s.receipts,blocked:s.blocked})},
 init:(h,n)=>({current:currentSourceProjection.init(h,n),base:null,receipts:[],blocked:false}),
 apply:(s,event)=>{
  const inherited=s.current.inheritedRemaining>0,current=currentSourceProjection.apply(s.current,event);
  if(inherited)return {...s,current};
  let next:UpdateState={...s,current};const record=pluginRecordOf(event);
  if(record?.type===RECORD){
   const parsed=intentSchema.safeParse(record.data);if(!parsed.success||s.receipts.length>=16)return {...next,blocked:true};
   const i=parsed.data;if(i.base.sessionId!==current.sessionId||s.receipts.some(r=>r.intent.requestId===i.requestId)||!s.base||!sameUpdateBase(s.base.identity,i.base))return {...next,blocked:true};
   try{const revision=reviseUnknownCondition(s.base.source,i.condition,i.value);if(revision.nextTextSha256!==i.nextTextSha256||JSON.stringify(revision.change)!==JSON.stringify(i.change))return {...next,blocked:true};}catch{return {...next,blocked:true};}
   return {...next,receipts:[...s.receipts,{intent:i}]};
  }
  if(event.type==='turn/start')next={...next,base:null};
  if(event.type==='user/message'&&current.candidate?.seq===Number(event.seq)){
   const c=current.candidate,hash=sourceTextSha(c.text);next={...next,base:null,receipts:s.receipts.map(r=>{
    if(r.message||r.issue)return r;
    if(c.requestId===r.intent.requestId)return hash===r.intent.nextTextSha256?{...r,message:{id:c.id,seq:c.seq,turn:current.turn!,turnStartSeq:current.startSeq!,requestId:c.requestId,textSha256:hash}}:{...r,issue:'UPDATE_MESSAGE_MISMATCH'};
    return {...r,issue:'UPDATE_INTERVENING_SOURCE'};
   })};
  }
  if(current.blocked&&current.turn!==null)next={...next,receipts:next.receipts.map(r=>r.message?.turn===current.turn?{...r,issue:'UPDATE_AMBIGUOUS_SOURCE'}:r)};
  const cp=checkpointOf(event),meta=sourceDeliverySchema.safeParse(cp?.sourceDelivery);
  if(cp?.view?.component==='DecisionExplorer'&&validateEnvelope(cp.view).ok&&meta.success&&meta.data.status==='bound'&&meta.data.kind==='decision-zh'){
   const m=meta.data,c=current.candidate;
   if(!c||!current.open||current.blocked||current.userCount!==1||m.sourceRef.hostContext.sessionId!==current.sessionId||m.sourceRef.hostContext.messageId!==c.id||m.sourceRef.hostContext.messageSeq!==c.seq||m.sourceRef.hostContext.turn!==current.turn||m.sourceRef.hostContext.turnStartSeq!==current.startSeq||m.sourceRef.hostContext.requestId!==c.requestId||m.sourceRef.textSha256!==sourceTextSha(c.text)||cp.turn!==current.turn||m.viewIdentity.component!=='DecisionExplorer'||m.viewIdentity.displayId!==cp.view.displayId||m.viewIdentity.revision!==cp.view.revision)return next;
   const snap=snapshotCurrentSource(current,{lastTurn:current.turn!,openTurnStartSeq:current.startSeq},current.sessionId);if(!snap.ok)return next;
   const identity:SourceUpdateBase={sessionId:current.sessionId,turn:current.turn!,turnStartSeq:current.startSeq!,messageId:c.id,messageSeq:c.seq,textSha256:m.sourceRef.textSha256,displayId:cp.view.displayId,revision:cp.view.revision};
   const checkpointSha256=sourceTextSha(JSON.stringify([cp.view,m]));
   if(s.base?.identity.turn===identity.turn&&s.base.identity.displayId===identity.displayId){
    if(identity.revision<s.base.identity.revision)return next;
    if(identity.revision===s.base.identity.revision&&checkpointSha256!==s.base.checkpointSha256)return {...next,base:null,receipts:next.receipts.map(r=>r.message?.id===c.id?{...r,issue:'UPDATE_REVISION_CONFLICT'}:r)};
   }
   return {...next,base:{identity,source:snap.snapshot,checkpointSha256},receipts:next.receipts.map(r=>!r.issue&&r.message?.id===c.id?{...r,checkpoint:{seq:Number(event.seq),displayId:cp.view!.displayId,revision:cp.view!.revision,textSha256:m.sourceRef.textSha256,explanation:m.explanation}}:r)};
  }
  return next.current===s.current&&next.base===s.base&&next.receipts===s.receipts?s:next;
 },
};

/** The only submission record is an informational intent in DSH's own log.
 * Normal prompt owns the user message; no synthetic user or parallel chat store. */
export function mountSourceUpdates(ctx:Context){
 ctx.sessionProjections.register(sourceUpdateProjection);
 ctx.inject(['sessions','connection'],child=>{
  // Host and browser both augment Context.sessions in the shared typecheck.
  // This injected host service is SessionStore, never the browser ISessions.
  const sessions=child.sessions as unknown as SessionStore;
  const shared=child.connection.createSharedFetchHandler('/api');
  const state=(session:Session)=>child.sessionProjections.stateOf(session,'dshSemanticSourceUpdates');
  async function status(session:Session,id:string):Promise<SourceUpdateResult>{
   return flushSourceUpdateReceipt(()=>{const s=state(session);return {receipt:s?.receipts.find(r=>r.intent.requestId===id),blocked:!!s?.blocked,asOfSeq:Number(session.seq)-1};},()=>sessions.flush(session),id);
  }
  async function nativeCall(request:Request,method:string,args:unknown){
   const admission=child.connection.admit(request);if('rejection'in admission)throw Error('UPDATE_ADMISSION');
   const response=await shared.fetch(new Request(new URL('/api/'+method,request.url),{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'client-request',rpcId:randomUUID(),method,payload:{args:{request:args}}}),signal:request.signal}),admission.peer);
   return await response.json() as {result?:{ok?:boolean;value?:unknown}};
  }
  child.connection.fetch.register({path:'/api/'+SOURCE_UPDATE_ENDPOINT,methods:['POST'],requestBody:'buffered',async fetch(request){
   if(!request.headers.get('content-type')?.toLowerCase().startsWith('application/json'))return new Response('Expected JSON',{status:415});
   const text=await request.text();if(Buffer.byteLength(text)>4096)return new Response('Request too large',{status:413});
   let raw:unknown;try{raw=JSON.parse(text);}catch{return new Response('Invalid JSON',{status:400});}
   const envelope=clientRequestSchema.safeParse(raw);if(!envelope.success||envelope.data.method!==SOURCE_UPDATE_ENDPOINT)return new Response('Invalid envelope',{status:400});
   const reply=(value:SourceUpdateResult)=>Response.json({type:'server-response',rpcId:envelope.data.rpcId,result:{ok:true,value}});
   const parsed=sourceUpdateRequestSchema.safeParse(envelope.data.payload);if(!parsed.success)return reply(updateWithheld('UPDATE_REQUEST'));
   const p=parsed.data,sessionId=(p.action==='status'?p.sessionId:p.base.sessionId) as Session['id'],session=sessions.get(sessionId);
   try{
    request.signal.throwIfAborted();
    if(!session){
     // Public non-activating projection read restores receipts from the same
     // durable log after host restart. It never resends an uncertain intent.
     const read=await nativeCall(request,'session/projections',{sessionId}),v=read.result?.value as {kind?:string;values?:Record<string,unknown>}|undefined;
     const cold=v?.kind==='sequenced'?wireSchema.safeParse(v.values?.dshSemanticSourceUpdates):undefined;
     const live=sessions.get(sessionId);if(live&&p.action==='status')return reply(await status(live,p.requestId));
     if(cold?.success){const r=cold.data.receipts.find(r=>p.action==='status'?r.intent.requestId===p.requestId:sameUpdateBase(r.intent.base,p.base));
      if(r){if(p.action==='submit'&&(r.intent.requestId!==p.requestId||r.intent.condition!==p.condition||r.intent.value!==p.value))return reply({...updateWithheld('UPDATE_ALREADY_REQUESTED'),requestId:r.intent.requestId});return reply(receiptResult(r,cold.data.blocked,true));}
     }
     return reply(updateWithheld('UPDATE_SESSION'));
    }
    if(p.action==='status')return reply(await status(session,p.requestId));
    const s=state(session);if(!s||s.blocked)return reply(updateWithheld('UPDATE_HISTORY_INVALID'));
    if(p.action==='submit'){
     const prior=s.receipts.find(r=>r.intent.requestId===p.requestId);
     if(prior){if(!sameUpdateBase(prior.intent.base,p.base)||prior.intent.condition!==p.condition||prior.intent.value!==p.value)return reply(updateWithheld('UPDATE_REQUEST_CONFLICT'));return reply(await status(session,p.requestId));}
     const previous=s.receipts.find(r=>sameUpdateBase(r.intent.base,p.base));if(previous)return reply({...updateWithheld('UPDATE_ALREADY_REQUESTED'),requestId:previous.intent.requestId});
    }
    if(p.action==='offer'){const previous=s.receipts.find(r=>sameUpdateBase(r.intent.base,p.base));if(previous)return reply(await status(session,previous.intent.requestId));}
    if(s.current.open||!s.base||!sameUpdateBase(s.base.identity,p.base))return reply(updateWithheld('UPDATE_STALE_BASE'));
    if(p.action==='offer')return reply({status:'available',base:s.base.identity,fields:sourceUpdateFields(s.base.source).map(({span,...f})=>f),...updateFlags});
    if(s.receipts.length>=16)return reply(updateWithheld('UPDATE_CAPACITY'));
    const rev=reviseUnknownCondition(s.base.source,p.condition,p.value),intent:Intent={version:1,requestId:p.requestId,base:p.base,condition:p.condition,value:p.value,nextTextSha256:rev.nextTextSha256,change:rev.change};
    appendPluginRecord(session,RECORD,intent);
    // Persist intent BEFORE dispatch. An uncertain submission is status-only,
    // including after reload/restart; it is never silently reissued.
    if(!await sessions.flush(session))return reply({...updateWithheld('UPDATE_DURABILITY_UNCONFIRMED'),requestId:p.requestId});
    const now=state(session);if(now?.current.open||!now?.base||!sameUpdateBase(now.base.identity,p.base))return reply({...updateWithheld('UPDATE_STALE_BASE'),requestId:p.requestId});
    const accepted=await nativeCall(request,'session/prompt',{sessionId:p.base.sessionId,requestId:p.requestId,mode:'queue',content:[{type:'text',text:rev.text}],clientTimeZone:'UTC'});
    return reply({...await status(session,p.requestId),admission:accepted.result?.ok&&(accepted.result.value as {accepted?:boolean})?.accepted===true?'accepted':'not-confirmed'});
   }catch(error){return reply({...updateWithheld(error instanceof Error&&/^UPDATE_/.test(error.message)?error.message:'UPDATE_UNCERTAIN'),...(p.action==='submit'?{requestId:p.requestId}:{})});}
  }});
 });
}
