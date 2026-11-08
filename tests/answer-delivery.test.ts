import {it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {readFileSync} from 'node:fs';
import * as core from '../src/core';
import {sourceReferenceFromSnapshot} from '../src/source-reference.mjs';
import {checkAnswerDelivery} from '../src/answer-delivery';
import {reviewProse} from '../src/prose';
import {checkResultPackage} from '../src/result-interop';
import {createResult,initialInteraction,resultDigest} from '../src/results';
import {defaultTheme,defaultLayout} from '../src/theme';
import type {SourceSnapshot} from '../src/source-graph';
import type {Envelope} from '../src/protocol';
const hash=(s:string)=>createHash('sha256').update(s).digest('hex');
const original=JSON.parse(readFileSync('docs/evidence/prose-review/N2.json','utf8'));
const snapshot=(text:string):SourceSnapshot=>({documentSha256:hash(text),textSha256:hash(text),excerptSha256:hash(text),jsonPointer:null,textBytes:Buffer.byteLength(text),textByteStart:0,textByteEnd:Buffer.byteLength(text),excerpt:text,kind:'observations-zh'});
function fixture(){const source=snapshot(original.sourceText),ref=sourceReferenceFromSnapshot(core,source,'observations-zh');if(ref.status!=='ready')throw Error('reference');return {source,view:ref.request.view as Envelope,mapping:ref.request.mapping};}
const mixed='已观测3个读数的均值为0摄氏度，并且这证明设备永不故障。';

it('reproduces the real partial-assertion gap, then never promotes its mixed sentence or omitted tail',async()=>{
 const f=fixture(),old=await reviewProse(f.source.excerpt,mixed);expect(old.claims.some(c=>c.status==='supported')).toBe(true);expect(old.uncovered).toHaveLength(0);
 const r=await checkAnswerDelivery({...f,answer:mixed},f.source);expect(r.status).toBe('limited-source-output');if(r.status!=='limited-source-output')throw Error(r.code);expect(r.wholeCandidateVerified).toBe(false);expect(r.originalAnswer).toBe(mixed);expect(r.coverage.representations.find(x=>x.origin==='answer')?.unverifiedRanges).toEqual([{utf16Start:0,utf16End:mixed.length}]);expect(r.text).not.toContain('永不故障');expect(r.text).toContain('未知');
});
it('distinguishes contradicted assertions from unsupported source content without delivering either as candidate text',async()=>{
 const f=fixture(),r=await checkAnswerDelivery({...f,answer:'已观测3个读数的均值为7摄氏度。另有无法识别的结论。'},f.source);expect(r.status).toBe('limited-source-output');if(r.status!=='limited-source-output')throw Error(r.code);expect(r.diagnostics.flatMap(d=>d.assertions).some(c=>c.status==='contradicted')).toBe(true);expect(r.diagnostics.some(d=>d.uncovered.length)).toBe(true);expect(r.text).not.toContain('为7');expect(r.wholeCandidateVerified).toBe(false);
});
it.each(['candidate','summary','other-view-text','source-document','source-selection','mapping'])('refuses stale %s binding, retaining the changed original as unverified',async which=>{
 const f=fixture(),input={view:structuredClone(f.view),mapping:structuredClone(f.mapping),answer:mixed},first=await checkAnswerDelivery(input,f.source),s=structuredClone(f.source);if(first.status!=='limited-source-output')throw Error(first.code);
 if(which==='candidate')input.answer+=' 新内容。';if(which==='summary')input.view.summary+=' 新摘要。';if(which==='other-view-text')input.view.payload.title+='新标题';if(which==='source-document')s.documentSha256='1'.repeat(64);if(which==='source-selection')s.jsonPointer='/new-revision';if(which==='mapping')input.mapping={...(input.mapping as Record<string,unknown>),seriesId:'stale'};
 const r=await checkAnswerDelivery({...input,expectedBinding:first.binding},s);expect(r.status).toBe('refused');expect(r.code).toBe('ANSWER_BINDING_STALE');expect(r.text).toBeNull();expect(r.wholeCandidateVerified).toBe(false);
});
it('refuses forged source hashes and partial-source scope even if its structured fields happen to match',async()=>{
 const f=fixture();for(const source of [{...f.source,textSha256:'0'.repeat(64)},{...f.source,excerptSha256:'0'.repeat(64)},{...f.source,textByteStart:5},{...f.source,textBytes:f.source.textBytes+1}]){const r=await checkAnswerDelivery({...f,answer:mixed},source);expect(r.code).toBe('ANSWER_SOURCE_SNAPSHOT');expect(r.text).toBeNull();}
});
it('cannot inherit saved bound status, pass without an independent source, or imply an unprovided assistant body was checked',async()=>{
 const f=fixture(),missing=await checkAnswerDelivery({...f,answer:mixed});expect(missing.code).toBe('ANSWER_SOURCE_MISSING');expect(missing.originalAnswer).toBe(mixed);
 const old=await checkAnswerDelivery({...f,answer:mixed,recordedSourceTextSha256:'0'.repeat(64)},f.source);expect(old.code).toBe('ANSWER_RECORDED_SOURCE_STALE');
 const absent=await checkAnswerDelivery(f,f.source);expect(absent.status).toBe('limited-source-output');expect(absent.answerProvidedByCaller).toBe(false);expect(absent.externalAssistantBodyIntercepted).toBe(false);expect(absent.wholeCandidateVerified).toBe(false);
});
it('uses the same delivery gate in the existing result consumer and preserves every original byte-level value',async()=>{
 const f=fixture(),document=await createResult({view:f.view,interaction:initialInteraction(f.view),theme:defaultTheme,layout:defaultLayout,locale:'zh-CN'}),before=JSON.stringify(document),r=await checkResultPackage({document,mapping:f.mapping,answer:original.candidate},f.source);
 expect(r.status).toBe('limited-delivery');expect(r.structuredStatus).toBe('checked');expect(r.document).toEqual(document);expect(JSON.stringify(document)).toBe(before);expect(r).toHaveProperty('answerDelivery.originalAnswer',original.candidate);expect(r).toHaveProperty('answerDelivery.coverage.allViewFieldsIncludedInDigest',true);expect(r).toHaveProperty('answerDelivery.wholeCandidateVerified',false);expect(r.freeProseVerified).toBe(false);
});
it('rejects imported verified proofs, hidden coverage, and source replacement instead of trusting recomputed package hashes',async()=>{
 const f=fixture(),document=await createResult({view:f.view,interaction:initialInteraction(f.view),theme:defaultTheme,layout:defaultLayout,locale:'zh-CN'});
 for(const request of [{document,verified:true},{document,source:f.source},{document,answer:mixed,expectedBinding:{verified:true}}])expect((await checkResultPackage(request,f.source)).status).toBe('invalid-request');
 const forged={...structuredClone(document),answerDelivery:{wholeCandidateVerified:true}};forged.sha256=await resultDigest({manifest:forged.manifest,content:forged.content});expect((await checkResultPackage({document:forged},f.source)).status).toBe('invalid-result');
});
it('refuses oversized candidates and never upgrades even an exact program projection into a verified model answer',async()=>{
 const f=fixture(),a=await checkAnswerDelivery({...f,answer:'x'.repeat(24001)},f.source);expect(a.status).toBe('refused');expect(a.text).toBeNull();const safe=await checkAnswerDelivery(f,f.source);if(!safe.text)throw Error();const same=await checkAnswerDelivery({...f,answer:safe.text},f.source);expect(same.status).toBe('limited-source-output');expect(same.wholeCandidateVerified).toBe(false);
});
it('binds the checker revision, explicit rule hash and full view revision before reusing an earlier receipt',async()=>{
 const text=JSON.parse(readFileSync('fixtures/capacity-source.json','utf8')).text,source={...snapshot(text),kind:'capacity-zh' as const},ref=sourceReferenceFromSnapshot(core,source,'capacity-zh');if(ref.status!=='ready')throw Error('reference');
 const first=await checkAnswerDelivery({...ref.request,answer:mixed},source);if(first.status!=='limited-source-output')throw Error(first.code);
 expect(first.binding.checkerVersion).toBe('answer-delivery-1');expect(first.binding.rulesSha256).toMatch(/^[a-f0-9]{64}$/);
 const unchanged=await checkAnswerDelivery({...ref.request,answer:mixed,expectedBinding:first.binding},source);expect(unchanged.status).toBe('limited-source-output');
 const view=structuredClone(ref.request.view);if(view.component!=='DecisionExplorer')throw Error();view.payload.requirements![0].relation='at-most';
 const changed=await checkAnswerDelivery({...ref.request,view,answer:mixed,expectedBinding:first.binding},source);expect(changed.code).toBe('ANSWER_BINDING_STALE');
 const forged={...first.binding,checkerVersion:'old-checker'};const stale=await checkAnswerDelivery({...ref.request,answer:mixed,expectedBinding:forged as typeof first.binding},source);expect(stale.code).toBe('ANSWER_BINDING_STALE');expect(stale.text).toBeNull();
});
