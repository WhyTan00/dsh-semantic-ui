import {randomUUID} from 'node:crypto';
import {z} from 'zod';
import type {Context} from '@deepseek-ai/cordis';
import type {Session,SessionStore} from '@deepseek-ai/dsh-session';
import type {} from '@deepseek-ai/dsh-commands';
import type {} from '@deepseek-ai/dsh-api-session-controller';
import type {} from '@deepseek-ai/dsh-workspace';
import type {Agent} from '@deepseek-ai/dsh-agent';
import type {ProjectionDefinition} from '@deepseek-ai/dsh-session-projection';
import {clientRequestSchema} from '@deepseek-ai/dsh-client-connection';
import {currentSourceProjection,currentSourceSchema,snapshotCurrentSource} from './source';
import {checkpointOf} from './definition';
import {sourceDeliverySchema,sourceHostContextSchema} from '../source-delivery-meta';
import {validateEnvelope} from '../protocol';
import {sourceUpdateBaseSchema,sourceUpdateRequestSchema,SOURCE_UPDATE_ENDPOINT,type SourceUpdateBase,type SourceUpdateResult} from '../source-update-contract';
import {reviseUnknownCondition,sameUpdateBase,sourceTextSha,sourceUpdateFields,updateFlags,updateWithheld} from '../source-update';
import type {SourceSnapshot} from '../source-graph';

export const SOURCE_UPDATE_COMMAND='dsh-semantic-ui-source-update';
const intentSchema=z.strictObject({version:z.literal(1),requestId:z.uuid(),base:sourceUpdateBaseSchema,condition:z.string().min(1).max(160),value:z.boolean(),nextTextSha256:z.string().regex(/^[a-f0-9]{64}$/),change:z.strictObject({condition:z.string(),from:z.null(),to:z.boolean(),textByteStart:z.number().int().nonnegative(),textByteEnd:z.number().int().nonnegative(),before:z.string(),after:z.string()})});
type Intent=z.infer<typeof intentSchema>;
type Receipt={intent:Intent;commandId:string;settled:boolean;issue?:string;message?:NonNullable<SourceUpdateResult['message']>;checkpoint?:NonNullable<SourceUpdateResult['checkpoint']>};
interface UpdateState{ordinary:boolean;automationRecorded:boolean;current:z.infer<typeof currentSourceSchema>;base:{identity:SourceUpdateBase;source:SourceSnapshot;checkpointSha256:string}|null;receipts:Receipt[];blocked:boolean}
declare module '@deepseek-ai/dsh-session-projection/types'{
 interface SessionProjectionStateMap{dshSemanticSourceUpdates:UpdateState}
 interface SessionProjectionMap{dshSemanticSourceUpdates:UpdateWire}
}
const receiptSchema=z.strictObject({intent:intentSchema,commandId:z.string().min(1),settled:z.boolean(),issue:z.string().optional(),message:z.strictObject({id:z.string(),seq:z.number(),turn:z.number(),turnStartSeq:z.number(),requestId:z.string(),textSha256:z.string()}).optional(),checkpoint:z.strictObject({seq:z.number(),displayId:z.string(),revision:z.number(),textSha256:z.string(),explanation:z.string()}).optional()});
const stateSchema=z.strictObject({ordinary:z.boolean(),automationRecorded:z.boolean(),current:currentSourceSchema,base:z.strictObject({identity:sourceUpdateBaseSchema,checkpointSha256:z.string().regex(/^[a-f0-9]{64}$/),source:z.strictObject({kind:z.literal('decision-zh'),textSha256:z.string(),excerptSha256:z.string(),textBytes:z.number(),textByteStart:z.literal(0),textByteEnd:z.number(),excerpt:z.string(),hostContext:sourceHostContextSchema})}).nullable(),receipts:z.array(receiptSchema).max(16),blocked:z.boolean()});
const fieldSchema=z.strictObject({condition:z.string().min(1).max(160),capabilities:z.array(z.string().max(160)).max(32),before:z.string().max(16384)});
const wireSchema=z.strictObject({receipts:z.array(receiptSchema).max(16),blocked:z.boolean(),ordinary:z.boolean(),automationRecorded:z.boolean(),open:z.boolean(),offer:z.strictObject({base:sourceUpdateBaseSchema,fields:z.array(fieldSchema).max(32)}).nullable()});
type UpdateWire=z.infer<typeof wireSchema>;
const inboxSchema=z.strictObject({'next-turn':z.array(z.unknown()),'next-step':z.array(z.unknown())});
function projectedOffer(s:UpdateState):UpdateWire['offer']{
 if(!s.base||s.blocked||s.current.open)return null;
 try{return {base:s.base.identity,fields:sourceUpdateFields(s.base.source).map(({span,...f})=>f)};}catch{return null;}
}
/** Public native projections supply pending work; missing/corrupt data is withheld. */
export function sourceUpdateGate(values:unknown,base:SourceUpdateBase,archived:boolean,activityCount:number):{ok:true;wire:UpdateWire}|{ok:false;code:string}{
 if(archived)return {ok:false,code:'UPDATE_SESSION_ARCHIVED'};
 if(!values||typeof values!=='object')return {ok:false,code:'UPDATE_GUARD_UNAVAILABLE'};
 const v=values as Record<string,unknown>,wire=wireSchema.safeParse(v.dshSemanticSourceUpdates),inbox=inboxSchema.safeParse(v.inbox);
 if(!wire.success||!inbox.success)return {ok:false,code:'UPDATE_GUARD_UNAVAILABLE'};
 if(!wire.data.ordinary)return {ok:false,code:'UPDATE_SESSION_OWNERSHIP'};
 // This bounded entry never re-arms a task/goal or schedule while resuming.
 if(wire.data.automationRecorded||v.goal!==undefined&&v.goal!==null)return {ok:false,code:'UPDATE_SESSION_AUTOMATION'};
 if(activityCount||wire.data.open||inbox.data['next-turn'].length||inbox.data['next-step'].length)return {ok:false,code:'UPDATE_SESSION_BUSY'};
 if(wire.data.blocked)return {ok:false,code:'UPDATE_HISTORY_INVALID'};
 if(!wire.data.offer||!sameUpdateBase(wire.data.offer.base,base))return {ok:false,code:'UPDATE_STALE_BASE'};
 return {ok:true,wire:wire.data};
}
function receiptResult(r:Receipt,blocked:boolean,durable:boolean):SourceUpdateResult{
 const result={...updateFlags,requestId:r.intent.requestId,base:r.intent.base,change:r.intent.change,nextTextSha256:r.intent.nextTextSha256,durable,...(durable&&r.message?{message:r.message}:{}),...(durable&&r.checkpoint?{checkpoint:r.checkpoint}:{})};
 if(r.issue||blocked)return {...result,status:'withheld',code:r.issue??'UPDATE_HISTORY_INVALID'};
 return {...result,status:durable&&r.settled?(r.checkpoint?'adopted':r.message?'message-persisted':'unknown'):'unknown',...(!durable?{code:'UPDATE_DURABILITY_UNCONFIRMED'}:{})};
}
/** Flush promises the pre-existing prefix, not events appended while awaiting it.
 * Capture and detach the exact projection before crossing that async boundary. */
export async function flushSourceUpdateReceipt(read:()=>{receipt:Receipt|undefined;blocked:boolean;asOfSeq:number},flush:()=>Promise<boolean>,requestId:string):Promise<SourceUpdateResult>{
 const cut=structuredClone(read());
 const durable=await flush();
 return cut.receipt?{...receiptResult(cut.receipt,cut.blocked,durable),asOfSeq:cut.asOfSeq}:{...updateWithheld('UPDATE_REQUEST_UNKNOWN'),requestId,asOfSeq:cut.asOfSeq};
}
export const sourceUpdateProjection:ProjectionDefinition<'dshSemanticSourceUpdates'>&{wire:NonNullable<ProjectionDefinition<'dshSemanticSourceUpdates'>['wire']>}={
 key:'dshSemanticSourceUpdates',stateVersion:4,stateSchema:stateSchema as z.ZodType<UpdateState>,
 wire:{viewSchema:wireSchema,view:s=>({receipts:s.receipts,blocked:s.blocked,ordinary:s.ordinary,automationRecorded:s.automationRecorded,open:s.current.open,offer:projectedOffer(s)})},
 init:(h,n)=>({ordinary:h.origin!=='subagent',automationRecorded:false,current:currentSourceProjection.init(h,n),base:null,receipts:[],blocked:false}),
 apply:(s,event)=>{
  const inherited=s.current.inheritedRemaining>0,current=currentSourceProjection.apply(s.current,event);
  if(inherited)return {...s,current};
  let next:UpdateState={...s,current};
  if(['goal/change','schedule/change'].includes(event.type))return {...next,automationRecorded:true};
  if(event.type==='command/done')return {...next,receipts:s.receipts.map(r=>r.commandId===event.data.commandId?{...r,settled:event.data.kind==='success',...(event.data.kind!=='success'?{issue:'UPDATE_COMMAND_REJECTED'}:{})}:r)};
  if(event.type==='command/run'&&event.data.name===SOURCE_UPDATE_COMMAND){
   let input:unknown;try{input=JSON.parse(event.data.args??'');}catch{return next;}
   const parsed=intentSchema.safeParse(input);if(!parsed.success)return next;if(s.receipts.length>=16)return {...next,blocked:true};
   const i=parsed.data;if(i.base.sessionId!==current.sessionId||s.receipts.some(r=>r.intent.requestId===i.requestId)||!s.base||!sameUpdateBase(s.base.identity,i.base))return {...next,blocked:true};
   try{const revision=reviseUnknownCondition(s.base.source,i.condition,i.value);if(revision.nextTextSha256!==i.nextTextSha256||JSON.stringify(revision.change)!==JSON.stringify(i.change))return {...next,blocked:true};}catch{return {...next,blocked:true};}
   return {...next,receipts:[...s.receipts,{intent:i,commandId:String(event.data.commandId),settled:false}]};
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

/** Intent uses the existing command/run + command/done log via the actual
 * injected CommandRuntime. No cross-SDK Session class-bound function or custom
 * append, synthetic user message or parallel conversation store. */
export function mountSourceUpdates(ctx:Context){
 ctx.sessionProjections.register(sourceUpdateProjection);
 ctx.inject(['sessions','connection','commands','agents','sessionController','workspaceRegistry'],child=>{
  // Host and browser both augment Context.sessions in the shared typecheck.
  // This injected host service is SessionStore, never the browser ISessions.
  const sessions=child.sessions as unknown as SessionStore;
  const shared=child.connection.createSharedFetchHandler('/api');
  const staged=new Map<string,Intent>(),submitting=new Map<string,string>();
  child.commands.register({name:SOURCE_UPDATE_COMMAND,description:'Reserve a bounded source supplement from its explicit owner UI; does not prompt a model.',input:{hint:'Internal source-update intent; use the source supplementation UI.'},handler(invocation){
   invocation.signal.throwIfAborted();let raw:unknown;try{raw=JSON.parse(invocation.rawInput);}catch{return {kind:'error',text:'UPDATE_INTENT_FORMAT'};}
   const parsed=intentSchema.safeParse(raw);if(!parsed.success)return {kind:'error',text:'UPDATE_INTENT_FORMAT'};
   const i=parsed.data,expected=staged.get(i.requestId);
   if(!expected||JSON.stringify(expected)!==JSON.stringify(i)||String(invocation.agent.session.id)!==i.base.sessionId)return {kind:'error',text:'UPDATE_OWNER_UI_REQUIRED'};
   const g=syncGuard(invocation.agent,i.base);if(g)return {kind:'error',text:g};
   return {kind:'success',text:'Source-update intent recorded. Not prompt admission, message persistence or new view adoption.'};
  }});
  const state=(session:Session)=>child.sessionProjections.stateOf(session,'dshSemanticSourceUpdates');
  const archived=(id:Session['id'])=>child.workspaceRegistry.archivedSessionIds.includes(id);
  const activity=(id:Session['id'])=>child.waterfall('workspace/session-activity',{sessionId:id},()=>Promise.resolve([]));
  function syncGuard(agent:Agent,base:SourceUpdateBase):string|undefined{
   const session=agent.session,s=state(session);
   if(sessions.get(session.id)!==session||child.agents.get(agent.id)!==agent)return 'UPDATE_SESSION_OWNERSHIP';
   const parent=session.header.parentSession&&child.agents.get(session.header.parentSession);
   if(session.header.origin==='subagent'||parent&&child.agents.isOwnedBy(agent.id,parent))return 'UPDATE_SESSION_OWNERSHIP';
   if(archived(session.id))return 'UPDATE_SESSION_ARCHIVED';
   if(agent.status!=='idle'||agent.inbox.nextTurn.length||agent.inbox.nextStep.length)return 'UPDATE_SESSION_BUSY';
   if(!s)return 'UPDATE_GUARD_UNAVAILABLE';
   const g=sourceUpdateGate(child.sessionProjections.snapshot(session).values,base,false,0);return g.ok?undefined:g.code;
  }
  async function liveGuard(agent:Agent,base:SourceUpdateBase){
   const busy=await activity(agent.session.id);const sync=syncGuard(agent,base);return sync??(busy.length?'UPDATE_SESSION_BUSY':undefined);
  }
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
   const p=parsed.data,sessionId=(p.action==='status'?p.sessionId:p.base.sessionId) as Session['id'];let session=sessions.get(sessionId),ownsSubmit=false;
   try{
    request.signal.throwIfAborted();
    const admission=child.connection.admit(request);if('rejection'in admission||admission.peer.principal.kind!=='owner')return reply(updateWithheld('UPDATE_ADMISSION'));
    if(p.action==='submit'){
     const pending=submitting.get(sessionId);if(pending)return reply({status:pending===p.requestId?'unknown':'withheld',code:'UPDATE_SUBMIT_PENDING',requestId:pending,...updateFlags});
     if(submitting.size>=128)return reply(updateWithheld('UPDATE_CAPACITY'));
     submitting.set(sessionId,p.requestId);ownsSubmit=true;
    }
    if(!session||!child.agents.get(sessionId as Parameters<typeof child.agents.get>[0])){
     // Public non-activating projection read restores receipts from the same
     // durable log after host restart. It never resends an uncertain intent.
     const readCold=async()=>{const read=await nativeCall(request,'session/projections',{sessionId});return read.result?.ok?read.result.value as {kind?:string;values?:Record<string,unknown>}|undefined:undefined;};
     let v=await readCold();
     const prior=(v:Awaited<ReturnType<typeof readCold>>):SourceUpdateResult|undefined=>{
      const cold=v?.kind==='sequenced'?wireSchema.safeParse(v.values?.dshSemanticSourceUpdates):undefined;if(!cold?.success)return;
      const r=cold.data.receipts.find(r=>p.action==='status'||p.action==='submit'?r.intent.requestId===p.requestId:sameUpdateBase(r.intent.base,p.base));
      if(r){if(p.action==='submit'&&(!sameUpdateBase(r.intent.base,p.base)||r.intent.condition!==p.condition||r.intent.value!==p.value))return {...updateWithheld('UPDATE_REQUEST_CONFLICT'),requestId:r.intent.requestId};return receiptResult(r,cold.data.blocked,true);}
      if(p.action==='submit'){const previous=cold.data.receipts.find(r=>sameUpdateBase(r.intent.base,p.base));if(previous)return {...updateWithheld('UPDATE_ALREADY_REQUESTED'),requestId:previous.intent.requestId};}
     };
     const live=child.agents.get(sessionId as Parameters<typeof child.agents.get>[0]);if(live&&p.action==='status')return reply(await status(live.session,p.requestId));
     const previous=prior(v);if(previous)return reply(previous);
     if(p.action==='status')return reply(updateWithheld('UPDATE_REQUEST_UNKNOWN'));
     const busy=await activity(sessionId);
     // Activity providers may yield. Re-read the exact native prefix before
     // offering or activating; an earlier snapshot cannot authorize a resume.
     v=await readCold();request.signal.throwIfAborted();const latest=prior(v);if(latest)return reply(latest);
     const g=sourceUpdateGate(v?.kind==='sequenced'?v.values:undefined,p.base,archived(sessionId),busy.length);
     if(!g.ok)return reply(updateWithheld(g.code));
     const offer=g.wire.offer!;
     if(p.action==='offer')return reply({status:'available',...offer,...updateFlags});
     if(!offer.fields.some(f=>f.condition===p.condition))return reply(updateWithheld('UPDATE_FIELD'));
     request.signal.throwIfAborted();
     // Explicit new owner submit is the only activation site. The public
     // Session domain owns ordinary-session resolution, writer and preset policy.
     if(archived(sessionId))return reply(updateWithheld('UPDATE_SESSION_ARCHIVED'));
     const resumed=await child.sessionController.resolveAgent(sessionId);
     if('error'in resumed)return reply(updateWithheld('UPDATE_RESUME_REJECTED'));
     session=resumed.agent.session;
     if(session.id!==sessionId)return reply(updateWithheld('UPDATE_SESSION_OWNERSHIP'));
     request.signal.throwIfAborted();
     const gate=await liveGuard(resumed.agent,p.base);if(gate)return reply(updateWithheld(gate));
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
    if(p.action==='offer'){
     const busy=await activity(sessionId),g=sourceUpdateGate(child.sessionProjections.snapshot(session).values,p.base,archived(sessionId),busy.length);
     return reply(g.ok?{status:'available',...g.wire.offer!,...updateFlags}:updateWithheld(g.code));
    }
    if(s.receipts.length>=16)return reply(updateWithheld('UPDATE_CAPACITY'));
    const rev=reviseUnknownCondition(s.base.source,p.condition,p.value),intent:Intent={version:1,requestId:p.requestId,base:p.base,condition:p.condition,value:p.value,nextTextSha256:rev.nextTextSha256,change:rev.change};
    const agent=child.agents.get(sessionId as Parameters<typeof child.agents.get>[0]);if(!agent||agent.session!==session)return reply(updateWithheld('UPDATE_AGENT'));
    const before=await liveGuard(agent,p.base);if(before)return reply(updateWithheld(before));
    request.signal.throwIfAborted();staged.set(p.requestId,intent);
    try{const command=await child.commands.execute(agent,'/'+SOURCE_UPDATE_COMMAND+' '+JSON.stringify(intent),[],request.signal);if(command?.result.kind!=='success')return reply({...updateWithheld('UPDATE_COMMAND_REJECTED'),requestId:p.requestId});}finally{staged.delete(p.requestId);}
    // Persist intent BEFORE dispatch. An uncertain submission is status-only,
    // including after reload/restart; it is never silently reissued.
    if(!await sessions.flush(session))return reply({...updateWithheld('UPDATE_DURABILITY_UNCONFIRMED'),requestId:p.requestId});
    const now=await liveGuard(agent,p.base);if(now)return reply({...updateWithheld(now),requestId:p.requestId});request.signal.throwIfAborted();
    const accepted=await nativeCall(request,'session/prompt',{sessionId:p.base.sessionId,requestId:p.requestId,mode:'queue',content:[{type:'text',text:rev.text}],clientTimeZone:'UTC'});
    return reply({...await status(session,p.requestId),admission:accepted.result?.ok&&(accepted.result.value as {accepted?:boolean})?.accepted===true?'accepted':'not-confirmed'});
   }catch(error){return reply({...updateWithheld(error instanceof Error&&/^UPDATE_/.test(error.message)?error.message:'UPDATE_UNCERTAIN'),...(p.action==='submit'?{requestId:p.requestId}:{})});}finally{if(ownsSubmit)submitting.delete(sessionId);}
  }});
 });
}
