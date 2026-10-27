import {it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {checkSourceDecision,parseDecisionSource} from '../src/source-decision';
import {bindDecisionView} from '../src/source-delivery';
import type {SourceSnapshot} from '../src/source-graph';
import {conditionSamples,conditionRequest} from '../fixtures/source-condition';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const snap=(text:string):SourceSnapshot=>({kind:'decision-zh',documentSha256:hash(text),textSha256:hash(text),excerptSha256:hash(text),jsonPointer:null,textBytes:Buffer.byteLength(text),textByteStart:0,textByteEnd:Buffer.byteLength(text),excerpt:text});
const parsed=(text:string)=>{const r=parseDecisionSource(text);if(r.status!=='ready')throw Error(JSON.stringify(r));return r.value;};

it('retains independently frozen source/question bytes and traces both branches/current/derived need',()=>{
 const [e,f]=conditionSamples;expect(hash(e.source)).toBe(e.sourceSha256);expect(hash(f.source)).toBe(f.sourceSha256);
 const a=parsed(e.source),b=parsed(f.source);expect(a.conditionalNeeds?.[0]).toMatchObject({condition:'现场断网',whenTrue:true,whenFalse:false,current:false,derivedNeed:false});expect(b.conditionalNeeds?.[0]).toMatchObject({condition:'使用公网',current:null,derivedNeed:null});
 for(const s of [e,f]){const c=parsed(s.source).conditionalNeeds![0];const bytes=Buffer.from(s.source);expect(bytes.subarray(c.spans.condition.textByteStart,c.spans.condition.textByteEnd).toString()).toBe('若'+c.condition);expect(bytes.subarray(c.spans.whenTrue.textByteStart,c.spans.whenTrue.textByteEnd).toString()).toBe('则我们需要'+c.name);expect(bytes.subarray(c.spans.whenFalse.textByteStart,c.spans.whenFalse.textByteEnd).toString()).toBe('否则我们不需要'+c.name);expect(c.currentSpans.length).toBe(1);}
});
it('normalizes current needs to the existing core and source-bound host delivery without arbitrary when',()=>{
 for(const [i,s]of conditionSamples.entries()){
  const req=i===0?conditionRequest():conditionRequest(['松湾','竹湾'],'加密',null,[true,null],'other-ids');const r=checkSourceDecision(snap(s.source),req);
  expect(r.comparison).toHaveProperty('status','matched');expect(r.computedDecision).toHaveProperty('recommendedOptionIds',[]);expect(r.sourceFactsVerified).toBe(false);expect(r.source).toHaveProperty('identityVerified',false);
  expect(r.inputChecks).toHaveProperty('0.sourceDerivation.current',i===0?false:null);
  const d=bindDecisionView(snap(s.source),req.view,req.mapping);expect(d.ok).toBe(true);if(d.ok){expect(d.explanation).toContain(i===0?'本项不排除':'条件未定');expect(d.explanation).toContain('整体可行');expect(d.view.payload).not.toHaveProperty('when');}
 }
});
it('evaluates both directions with different names, booleans and IDs, and preserves missing current as unknown',()=>{
 for(const [index,[marker,need]] of ([['是',true],['否',false],['未知',null]] as const).entries()){
  const text=`另一团队在选云杉与银杏。前者不支持备份；后者支持备份。若外链暴露，则我们需要备份；否则我们不需要备份。当前外链暴露为${marker}。两边价格都未知。`;
  const suffix='variant-'+index,r=checkSourceDecision(snap(text),conditionRequest(['云杉','银杏'],'备份',need,[false,true],suffix));expect(r.comparison).toHaveProperty('status','matched');
  if(need===true)expect(r.computedDecision).toHaveProperty('excludedOptionIds',['option-0-'+suffix]);
  if(need===false)expect(r.computedDecision).toHaveProperty('excludedOptionIds',[]);
  const flipped=parsed(text.replace('则我们需要备份；否则我们不需要备份','则我们不需要备份；否则我们需要备份'));expect(flipped.conditionalNeeds![0].derivedNeed).toBe(need===null?null:!need);
 }
 expect(parsed(conditionSamples[0].source.replace('当前现场断网为否。','')).conditionalNeeds![0]).toMatchObject({current:null,currentSpans:[],derivedNeed:null});
});
it('checks literal current/branch claims, refuses reversed or incomplete branches and arbitrary source replacement',()=>{
 const s=snap(conditionSamples[0].source),rule={kind:'conditional-need',name:'离线',condition:'现场断网',whenTrue:true,whenFalse:false};
 expect(checkSourceDecision(s,{claims:[rule,{kind:'condition',name:'现场断网',value:false},{kind:'capability-need',name:'离线',value:false}]}).claimChecks).toEqual(expect.arrayContaining([expect.objectContaining({kind:'conditional-need',status:'supported'})]));
 const bad=checkSourceDecision(s,{claims:[{...rule,whenTrue:false,whenFalse:true}]});expect(bad.claimChecks).toHaveProperty('0.status','unsupported-by-source');expect(bad.canonicalExplanation).toHaveProperty('status','withheld');
 expect(checkSourceDecision(s,{claims:[{kind:'conditional-need',name:'离线',condition:'现场断网',whenTrue:true}]}).status).toBe('validation-failed');
 const wrong=conditionRequest();wrong.view.payload.inputs[0].initial=true;expect(checkSourceDecision(s,wrong).comparison).toHaveProperty('status','mismatch');
 const missing=conditionRequest();missing.view.payload.inputs=[];missing.mapping.inputs=[];missing.view.payload.requirements=[];expect(checkSourceDecision(s,missing).canonicalExplanation).toHaveProperty('status','withheld');
 expect(checkSourceDecision(s,{sourceText:'replacement'}).status).toBe('validation-failed');
});
it('refuses only-if sufficiency, omitted else, contradictory current, overlap, scope or unsupported trailing clauses',()=>{
 const e=conditionSamples[0].source;
 for(const text of [e.replace('若现场断网，则我们需要离线；否则我们不需要离线','只有现场断网才我们需要离线'),e.replace('；否则我们不需要离线',''),e+'当前现场断网为是。',e+'我们需要离线。',e.replace('否则我们不需要离线','否则我们不需要加密'),e+'以后可能迁移。',e.replace('当前现场断网','当前别的条件')]){
  expect(parseDecisionSource(text).status,text).toBe('unsupported');expect(checkSourceDecision(snap(text),{}).canonicalExplanation).toHaveProperty('status','withheld');
 }
});
it('preserves old literal option names beginning with new grammar words',()=>{
 const text='组在选若木与当前树。若木由供应商更新；当前树加密支持未知。两边价格都未知。';
 const s=parsed(text);expect(s.conditionalNeeds).toBeUndefined();expect(s.facts).toEqual(expect.arrayContaining([expect.objectContaining({kind:'actor-updates',option:'若木',actor:'供应商',value:true}),expect.objectContaining({kind:'capability',option:'当前树',name:'加密',value:null})]));
});
