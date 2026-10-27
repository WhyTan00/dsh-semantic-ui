import {describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {mountSourceUpdates,sourceUpdateProjection,sourceUpdateGate,SOURCE_UPDATE_COMMAND} from '../src/dsh/source-update';
import {SOURCE_UPDATE_ENDPOINT,retainSourceUpdateRequest} from '../src/source-update-contract';
import {sourceTextSha} from '../src/source-update';
import {conditionRequest} from '../fixtures/source-condition';
import {bindDecisionView} from '../src/source-delivery';

const text='合成训练组在选杉原与松港。前者支持缓存；后者不支持缓存。若离线值守，则我们需要缓存；否则我们不需要缓存。当前离线值守未知。两边价格都未知。';
const sessionId='session-cold-test',hostContext={sessionId,turn:1,turnStartSeq:1,messageId:'original',messageSeq:2,producerSourceKind:'user' as const,inherited:false as const,excludedSyntheticContexts:0};
function seed(){
 let state=sourceUpdateProjection.init({id:sessionId} as any,0 as any);
 const apply=(type:string,seq:number,data:unknown)=>{state=sourceUpdateProjection.apply(state,{type,seq,time:1,data} as any);};
 apply('turn/start',1,{turn:1});apply('user/message',2,{role:'user',id:'original',source:{kind:'user'},content:[{type:'text',text}]});
 const snapshot={kind:'decision-zh' as const,textSha256:sourceTextSha(text),excerptSha256:sourceTextSha(text),textBytes:Buffer.byteLength(text),textByteStart:0,textByteEnd:Buffer.byteLength(text),excerpt:text,hostContext};
 const req=conditionRequest(['杉原','松港'],'缓存',null,[true,false],'cold-test'),bound=bindDecisionView(snapshot,req.view,req.mapping);if(!bound.ok)throw Error('seed');
 apply('tool/result',3,{meta:{dshSemanticUi:{turn:1,view:bound.view,sourceDelivery:{version:1,status:'bound',kind:'decision-zh',explanation:bound.explanation,sourceRef:{textSha256:snapshot.textSha256,hostContext},viewIdentity:{displayId:bound.view.displayId,revision:1,component:'DecisionExplorer'},sourceFactsVerified:false,identityVerified:false}}}});apply('turn/end',4,{});return state;
}
const pause=()=>{let release!:()=>void;const promise=new Promise<void>(r=>{release=r;});return {promise,release};};
/** A service double tests await boundaries; installed DSH tests cover real ownership,
 * transport, activation, native inbox, messages and checkpoints separately. */
function host(){
 let state=seed(),seq=5,attached=false,owned=false,fetchHandler:any,command:any,resolveHook=async()=>{},flushHook=async()=>{},activityHook=async()=>[] as unknown[],principal='owner';
 const counts={resolve:0,commands:0,prompt:0,reads:0},peer={principal:{kind:'owner'}},inbox={'next-turn':[] as unknown[],'next-step':[] as unknown[]},archives:string[]=[];
 const session={id:sessionId,header:{} as {parentSession?:string},get seq(){return seq;}},agent={id:sessionId,session,status:'idle',inbox:{get nextTurn(){return inbox['next-turn'];},get nextStep(){return inbox['next-step'];}}};
 const values=()=>({dshSemanticSourceUpdates:sourceUpdateProjection.wire.view(state),inbox,goal:null});
 const fold=(type:string,data:unknown)=>{state=sourceUpdateProjection.apply(state,{type,seq:seq++,time:1,data} as any);};
 const ctx:any={
  inject:(_names:unknown,fn:any)=>fn(ctx),waterfall:()=>activityHook(),workspaceRegistry:{archivedSessionIds:archives},
  sessionProjections:{register:()=>{},stateOf:(_s:unknown,key:string)=>key==='inbox'?inbox:state,snapshot:()=>({values:values()})},
  sessions:{get:()=>attached?session:undefined,flush:async()=>{await flushHook();return true;}},agents:{get:()=>attached?agent:undefined,isOwnedBy:()=>owned},
  sessionController:{resolveAgent:async()=>{counts.resolve++;await resolveHook();attached=true;return {agent};}},
  commands:{register:(c:any)=>{command=c;},execute:async(_a:any,raw:string,_attachments:any,signal:AbortSignal)=>{counts.commands++;const args=raw.slice(('/'+SOURCE_UPDATE_COMMAND+' ').length),commandId=randomUUID();fold('command/run',{commandId,name:SOURCE_UPDATE_COMMAND,args,source:{kind:'user'}});const result=command.handler({agent,rawInput:args,signal});fold('command/done',{commandId,kind:result.kind});return {result};}},
  connection:{admit:()=>({peer:{...peer,principal:{kind:principal}}}),fetch:{register:(h:any)=>{fetchHandler=h.fetch;}},createSharedFetchHandler:()=>({fetch:async(req:Request,actualPeer:unknown)=>{
   expect(actualPeer).toMatchObject({principal:{kind:'owner'}});const {method}=await req.json();if(method==='session/projections'){counts.reads++;return Response.json({result:{ok:true,value:{kind:'sequenced',values:values()}}});}
   expect(method).toBe('session/prompt');counts.prompt++;return Response.json({result:{ok:true,value:{accepted:true}}});
  }})},
 };
 mountSourceUpdates(ctx);
 const base=state.base!.identity,submit=(requestId=randomUUID())=>({action:'submit',base,condition:'离线值守',value:false,requestId});
 return {base,submit,counts,inbox,archives,agent,values,fold,get state(){return state;},get seq(){return seq;},setState:(s:typeof state)=>{state=s;},onResolve:(f:typeof resolveHook)=>{resolveHook=f;},onFlush:(f:typeof flushHook)=>{flushHook=f;},onActivity:(f:typeof activityHook)=>{activityHook=f;},nonOwner:()=>{principal='guest';},markOwned:()=>{session.header.parentSession='parent';owned=true;},call:async(payload:unknown)=>{const response=await fetchHandler(new Request('http://fixture/api/'+SOURCE_UPDATE_ENDPOINT,{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'client-request',rpcId:randomUUID(),method:SOURCE_UPDATE_ENDPOINT,payload})}));return (await response.json()).result.value;}};
}

describe('cold source update admission',()=>{
 it('keeps the original caller ID when status omits it, including unknown and error results',()=>{
  const requestId=randomUUID(),flags={sourceFactsVerified:false as const,identityVerified:false as const,freeProseVerified:false as const};
  for(const status of ['unknown','withheld'] as const){const result={status,code:'UPDATE_REQUEST_UNKNOWN',...flags};expect(retainSourceUpdateRequest(result,requestId).requestId).toBe(requestId);expect(retainSourceUpdateRequest(result,undefined).requestId).toBeUndefined();}
  const originalId=randomUUID();expect(retainSourceUpdateRequest({status:'unknown',requestId:originalId,...flags},requestId).requestId).toBe(originalId);
 });
 it('reads an offer, leaves unknown/cancel local and reconciles unknown IDs without activation or events',async()=>{
  const h=host(),before=h.seq;expect((await h.call({action:'offer',base:h.base})).fields).toEqual([{condition:'离线值守',capabilities:['缓存'],before:'当前离线值守未知'}]);
  expect((await h.call({action:'status',sessionId,requestId:randomUUID()})).code).toBe('UPDATE_REQUEST_UNKNOWN');expect(h.counts).toEqual({resolve:0,commands:0,prompt:0,reads:3});expect(h.seq).toBe(before);
 });
 it('withholds archived, busy, queued, automated, nonordinary and unavailable sessions before resolving',async()=>{
  for(const configure of [(h:ReturnType<typeof host>)=>h.archives.push(sessionId),(h:ReturnType<typeof host>)=>h.inbox['next-turn'].push({id:'pending'}),(h:ReturnType<typeof host>)=>h.inbox['next-step'].push({id:'pending'}),(h:ReturnType<typeof host>)=>h.onActivity(async()=>[{}]),(h:ReturnType<typeof host>)=>h.setState({...h.state,automationRecorded:true}),(h:ReturnType<typeof host>)=>h.setState({...h.state,ordinary:false}),(h:ReturnType<typeof host>)=>h.fold('turn/start',{turn:2})]){
   const h=host();configure(h);expect((await h.call(h.submit())).status).toBe('withheld');expect(h.counts.resolve).toBe(0);expect(h.counts.commands).toBe(0);expect(h.counts.prompt).toBe(0);
  }
  const h=host();expect(sourceUpdateGate({dshSemanticSourceUpdates:h.values().dshSemanticSourceUpdates},h.base,false,0)).toEqual({ok:false,code:'UPDATE_GUARD_UNAVAILABLE'});
  expect(sourceUpdateGate({...h.values(),goal:{goal:{phase:'paused'}}},h.base,false,0)).toEqual({ok:false,code:'UPDATE_SESSION_AUTOMATION'});
 });
 it('rejects wrong source/view/session, extra data, invalid values and non-owner peers without activation',async()=>{
  const h=host();for(const req of [{...h.submit(),base:{...h.base,textSha256:'f'.repeat(64)}},{...h.submit(),base:{...h.base,displayId:'wrong'}},{...h.submit(),base:{...h.base,sessionId:'other'}},{...h.submit(),source:text},{...h.submit(),value:null},{...h.submit(),condition:'缓存'}])expect((await h.call(req)).status).toBe('withheld');
  h.nonOwner();expect((await h.call(h.submit())).code).toBe('UPDATE_ADMISSION');expect(h.counts.resolve).toBe(0);expect(h.counts.prompt).toBe(0);
 });
 it('rechecks the native prefix after an asynchronous activity query before activation',async()=>{
  const h=host();h.onActivity(async()=>{h.fold('turn/start',{turn:2});return [];});expect((await h.call(h.submit())).code).toBe('UPDATE_SESSION_BUSY');expect(h.counts.resolve).toBe(0);
 });
 it('withholds a dynamically owned child even when its historical origin marker was ordinary',async()=>{
  const h=host();h.onResolve(async()=>h.markOwned());expect((await h.call(h.submit())).code).toBe('UPDATE_SESSION_OWNERSHIP');expect(h.counts.commands).toBe(0);expect(h.counts.prompt).toBe(0);
 });
 it('serializes concurrent request IDs across suspended resolution and never silently resends an uncertain intent',async()=>{
  const h=host(),gate=pause(),req=h.submit();h.onResolve(()=>gate.promise);const first=h.call(req);await new Promise(r=>setTimeout(r,0));
  const same=await h.call(req),different=await h.call(h.submit());expect(same.status).toBe('unknown');expect(different.status).toBe('withheld');expect(same.requestId).toBe(req.requestId);expect(different.requestId).toBe(req.requestId);gate.release();
  expect((await first).admission).toBe('accepted');expect(h.counts.resolve).toBe(1);expect(h.counts.commands).toBe(1);expect(h.counts.prompt).toBe(1);
  expect((await h.call(req)).status).toBe('unknown');expect((await h.call(h.submit())).requestId).toBe(req.requestId);expect(h.counts.prompt).toBe(1);
 });
 it('withholds if a source or pending work changes while resolution or intent flush is suspended',async()=>{
  for(const at of ['resolve','flush'])for(const changed of ['source','pending','archive']){const h=host(),gate=pause();if(at==='resolve')h.onResolve(()=>gate.promise);else h.onFlush(()=>gate.promise);const pending=h.call(h.submit());await new Promise(r=>setTimeout(r,0));
   if(changed==='source')h.fold('turn/start',{turn:2});else if(changed==='pending')h.inbox['next-turn'].push({id:'later-work'});else h.archives.push(sessionId);gate.release();expect((await pending).code).toBe(changed==='archive'?'UPDATE_SESSION_ARCHIVED':'UPDATE_SESSION_BUSY');expect(h.counts.prompt).toBe(0);expect(h.counts.commands).toBe(at==='resolve'?0:1);
  }
 });
});
