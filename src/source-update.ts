import {createHash} from 'node:crypto';
import {parseDecisionSource} from './source-decision';
import type {SourceSnapshot} from './source-graph';
import type {SourceUpdateBase,SourceUpdateResult} from './source-update-contract';

export const sourceTextSha=(text:string)=>createHash('sha256').update(text).digest('hex');
/** An exact, complete source, never a merge with arbitrary earlier prose. */
export function sourceUpdateFields(source:SourceSnapshot){
 if(source.kind!=='decision-zh'||source.textByteStart!==0||source.textByteEnd!==Buffer.byteLength(source.excerpt)||source.textSha256!==sourceTextSha(source.excerpt)||source.excerptSha256!==source.textSha256)throw Error('UPDATE_SOURCE');
 const p=parseDecisionSource(source.excerpt);if(p.status!=='ready')throw Error('UPDATE_SYNTAX');
 return [...new Set(p.value.conditionalNeeds?.filter(c=>c.current===null&&c.currentSpans.length===1).map(c=>c.condition)??[])].map(condition=>{
  const cs=p.value.conditionalNeeds!.filter(c=>c.condition===condition),span=cs[0].currentSpans[0];
  const before=Buffer.from(source.excerpt).subarray(span.textByteStart,span.textByteEnd).toString('utf8');
  // A missing or repeated declaration is deliberately not an editable field.
  if(!new RegExp('^\\s*当前'+condition.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')+'(?:为)?未知\\s*$','u').test(before))throw Error('UPDATE_SCOPE');
  return {condition,capabilities:cs.map(c=>c.name),before,span};
 });
}
export function reviseUnknownCondition(source:SourceSnapshot,condition:string,value:boolean){
 if(typeof value!=='boolean')throw Error('UPDATE_VALUE');
 const f=sourceUpdateFields(source).find(f=>f.condition===condition);if(!f)throw Error('UPDATE_FIELD');
 const after=f.before.replace(/未知(\s*)$/u,`${f.before.trimEnd().endsWith('为未知')?'':'为'}${value?'是':'否'}$1`);
 const b=Buffer.from(source.excerpt),text=Buffer.concat([b.subarray(0,f.span.textByteStart),Buffer.from(after),b.subarray(f.span.textByteEnd)]).toString('utf8');
 const parsed=parseDecisionSource(text);if(parsed.status!=='ready'||parsed.value.conditionalNeeds?.some(c=>c.condition===condition&&c.current!==value))throw Error('UPDATE_REVISION');
 return {text,nextTextSha256:sourceTextSha(text),change:{condition,from:null,to:value,...f.span,before:f.before,after}};
}
export function sameUpdateBase(a:SourceUpdateBase,b:SourceUpdateBase){return Object.keys(a).length===Object.keys(b).length&&Object.entries(a).every(([k,v])=>b[k as keyof SourceUpdateBase]===v);}
export const updateFlags={sourceFactsVerified:false,identityVerified:false,freeProseVerified:false} as const;
export const updateWithheld=(code:string):SourceUpdateResult=>({status:'withheld',code,...updateFlags});
