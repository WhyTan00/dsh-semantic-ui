import {createHash} from 'node:crypto';
import {z} from 'zod';
import type {Context} from '@deepseek-ai/cordis';
import type {ToolExecution} from '@deepseek-ai/dsh-tools';
import type {ProjectionDefinition} from '@deepseek-ai/dsh-session-projection';
import {SOURCE_LIMITS,type SourceSnapshot} from '../source-graph';
import {numericSourcePrefix} from '../source-numeric';
import {permissionsSourcePrefix} from '../source-permissions';

const candidateSchema=z.strictObject({id:z.string().min(1).max(160),seq:z.number().int().nonnegative(),text:z.string().max(SOURCE_LIMITS.excerptBytes),requestId:z.string().min(1).max(160).optional()});
export const currentSourceSchema=z.strictObject({sessionId:z.string(),inheritedRemaining:z.number().int().nonnegative(),open:z.boolean(),turn:z.number().int().nullable(),startSeq:z.number().int().nullable(),candidate:candidateSchema.nullable(),userCount:z.number().int().min(0).max(2),excludedSyntheticContexts:z.number().int().nonnegative(),blocked:z.string().nullable(),unknownProducerKinds:z.array(z.string().max(80)).max(4)});
export type CurrentSourceState=z.infer<typeof currentSourceSchema>;
declare module '@deepseek-ai/dsh-session-projection/types'{interface SessionProjectionStateMap{dshSemanticCurrentSource:CurrentSourceState}}
// These are explicitly non-user producer labels in the pinned public message
// contracts. They are excluded, never promoted to human input or authority.
const synthetic=new Set(['runtime-context','agent-instructions','skill-catalog','time-context','skill-invocation','model-selection','tool-registry']);
export const currentSourceProjection:ProjectionDefinition<'dshSemanticCurrentSource'>={
 key:'dshSemanticCurrentSource',stateSchema:currentSourceSchema,stateVersion:5,
 init:(header,inherited)=>({sessionId:String(header.id),inheritedRemaining:Number(inherited),open:false,turn:null,startSeq:null,candidate:null,userCount:0,excludedSyntheticContexts:0,blocked:null,unknownProducerKinds:[]}),
 apply:(state,event)=>{
  if(state.inheritedRemaining>0)return {...state,inheritedRemaining:state.inheritedRemaining-1};
  if(event.type==='turn/start')return {...state,open:true,turn:event.data.turn,startSeq:Number(event.seq),candidate:null,userCount:0,excludedSyntheticContexts:0,blocked:null,unknownProducerKinds:[]};
  if(event.type==='turn/end')return {...state,open:false,turn:null,startSeq:null,candidate:null,userCount:0,excludedSyntheticContexts:0,blocked:null,unknownProducerKinds:[]};
  if(event.type!=='user/message'||!state.open)return state;
  const message=event.data as unknown as {role?:unknown;id?:unknown;source?:{kind?:unknown;rpcId?:unknown};content?:unknown};
  const producer=message.source?.kind;
  if(typeof producer==='string'&&synthetic.has(producer))return {...state,excludedSyntheticContexts:Math.min(1024,state.excludedSyntheticContexts+1)};
  if(producer!=='user')return {...state,blocked:'HOST_SOURCE_PRODUCER',candidate:null,unknownProducerKinds:[...new Set([...state.unknownProducerKinds,typeof producer==='string'?producer.slice(0,80):'[missing]'])].slice(0,4)};
  const next={...state,userCount:Math.min(2,state.userCount+1)};
  if(next.userCount>1)return {...next,blocked:'HOST_SOURCE_AMBIGUOUS',candidate:null};
  if(state.blocked)return {...next,candidate:null};
  if(message.role!=='user'||typeof message.id!=='string'||!message.id.length||message.id.length>160)return {...next,blocked:'HOST_SOURCE_MESSAGE',candidate:null};
  const content=message.content;
  if(!Array.isArray(content)||content.length!==1||!content[0]||content[0].type!=='text'||typeof content[0].text!=='string')return {...next,blocked:'HOST_SOURCE_NOT_TEXT',candidate:null};
  const text=content[0].text;
  if(!text.trim())return {...next,blocked:'HOST_SOURCE_EMPTY',candidate:null};
  if(Buffer.byteLength(text)>SOURCE_LIMITS.excerptBytes)return {...next,blocked:'HOST_SOURCE_LIMIT',candidate:null};
  const requestId=message.source?.rpcId;
  return {...next,candidate:{id:message.id,seq:Number(event.seq),text,...(typeof requestId==='string'&&requestId.length>0&&requestId.length<=160?{requestId}:{})}};
 },
};
const unavailable=(code:string,producers:string[]=[])=>({ok:false as const,result:{status:'source-unavailable',sourceFactsVerified:false,identityVerified:false,issues:[{code,path:'$.hostSource',reason:'No unambiguous supported current own-turn user-source message was selected. No tool-supplied source or historical fallback was used.'}],...(producers.length?{unknownProducerKinds:producers}:{})}});
export function snapshotCurrentSource(state:CurrentSourceState|undefined,boundary:{lastTurn:number;openTurnStartSeq:number|null}|undefined,sessionId:string){
 if(!boundary||boundary.openTurnStartSeq===null)return unavailable('HOST_SOURCE_NO_OPEN_TURN');
 if(!state||!state.open||state.sessionId!==sessionId||state.turn!==boundary.lastTurn||state.startSeq!==boundary.openTurnStartSeq)return unavailable('HOST_SOURCE_NOT_CURRENT');
 if(state.blocked)return unavailable(state.blocked,state.unknownProducerKinds);
 if(state.userCount!==1||!state.candidate)return unavailable(state.excludedSyntheticContexts?'HOST_SOURCE_SYNTHETIC_ONLY':'HOST_SOURCE_NO_USER');
 const c=state.candidate;if(c.seq<=state.startSeq)return unavailable('HOST_SOURCE_NOT_CURRENT');
 const sha=createHash('sha256').update(c.text).digest('hex'),textBytes=Buffer.byteLength(c.text);
 const snapshot:SourceSnapshot={kind:permissionsSourcePrefix(c.text)?'permissions-zh':numericSourcePrefix(c.text)?'observations-zh':'decision-zh',textSha256:sha,excerptSha256:sha,textBytes,textByteStart:0,textByteEnd:textBytes,excerpt:c.text,hostContext:{sessionId,turn:state.turn!,turnStartSeq:state.startSeq,messageId:c.id,messageSeq:c.seq,producerSourceKind:'user',inherited:false,excludedSyntheticContexts:state.excludedSyntheticContexts,...(c.requestId?{requestId:c.requestId}:{})}};
 return {ok:true as const,snapshot};
}
export function currentHostSource(ctx:Context,exec:Pick<ToolExecution,'agent'>){
 if(!exec.agent)return unavailable('HOST_SOURCE_NO_AGENT');
 const session=exec.agent.session;
 return snapshotCurrentSource(ctx.sessionProjections.stateOf(session,'dshSemanticCurrentSource'),ctx.sessionProjections.stateOf(session,'turnBoundary'),String(session.id));
}
