import {it,expect} from 'vitest';
import {createHash} from 'node:crypto';
import {checkSourceCapacity,parseCapacitySource} from '../src/source-capacity';
import {bindCapacityView} from '../src/source-delivery';
import {decide} from '../src/math';
import {sourceOptions} from '../src/source-input';
import type {SourceSnapshot} from '../src/source-graph';
import {capacityExpectations,capacityRequest} from '../fixtures/source-capacity';
const snapshot=(text=capacityExpectations.cases[0].source):SourceSnapshot=>{const h=createHash('sha256').update(text).digest('hex');return {kind:'capacity-zh',textSha256:h,excerptSha256:h,textBytes:Buffer.byteLength(text),textByteStart:0,textByteEnd:Buffer.byteLength(text),excerpt:text};};

it('binds original and renamed capacity quantities, units and source spans to the existing hard core',()=>{
 for(const [index,s] of capacityExpectations.cases.entries()){
  const parsed=parseCapacitySource(s.source);expect(parsed.status).toBe('ready');if(parsed.status!=='ready')throw Error('source');
  expect(parsed.value.options.map(o=>o.ceiling.value)).toEqual(s.ceilings);expect(parsed.value.current.value).toBe(s.current);expect(parsed.value.possibleFuture?.value).toBe(s.possible);
  expect(parsed.value.options.map(o=>o.deployment.value)).toEqual(s.deployment);expect(parsed.value.options.map(o=>o.maintenance.value)).toEqual(s.maintenance);expect(parsed.value.confirmedFuturePlan).toBe(null);
  const r=capacityRequest(index,'arbitrary-'+index),checked=checkSourceCapacity(snapshot(s.source),r);
  expect(checked.comparison).toHaveProperty('status','matched');expect(checked).toHaveProperty('sourceFactsVerified',false);
  const c=checked.computedCapacity as any;expect(c.current.eligibleOptionIds).toEqual(r.view.payload.options.map(o=>o.id));expect(c.possibleFutureHypothesis.excludedOptionIds).toEqual([r.view.payload.options[0].id]);
  for(const o of parsed.value.options){const span=o.ceiling.spans[0],selected=Buffer.from(s.source).subarray(span.textByteStart,span.textByteEnd).toString();expect(selected).toContain(String(o.ceiling.value));expect(selected).toContain(s.unit);}
 }
});

it('rejects swapped values, wrong units/current initial/direction, missing links and invented policies before projection',()=>{
 const mutations=[
  (r:ReturnType<typeof capacityRequest>)=>{r.view.payload.options[0].values[r.mapping.capacityDimensionId]=1000;},
  (r:ReturnType<typeof capacityRequest>)=>{r.view.payload.dimensions[0].unit='MB';},
  (r:ReturnType<typeof capacityRequest>)=>{r.view.payload.inputs[0].initial=300;},
  (r:ReturnType<typeof capacityRequest>)=>{r.view.payload.requirements![0].relation='at-most';},
  (r:ReturnType<typeof capacityRequest>)=>{r.view.payload.requirements=[];},
  (r:ReturnType<typeof capacityRequest>)=>{r.view.payload.inputs[0].expectedEffect='preference-only';},
  (r:ReturnType<typeof capacityRequest>)=>{r.view.payload.dimensions[0].label='维护简单';},
  (r:ReturnType<typeof capacityRequest>)=>{r.view.payload.rules=[{id:'invented',priority:1,when:{mode:'all',clauses:[{input:r.mapping.demandInputId,op:'gt',value:0}]},recommend:[r.view.payload.options[0].id],reason:'cost',origin:'model-judgment',evidence:[]}];},
 ];
 for(const mutate of mutations){const r=capacityRequest();mutate(r);expect((checkSourceCapacity(snapshot(),r).comparison as any).status).not.toBe('matched');expect(bindCapacityView(snapshot(),r.view,r.mapping).ok).toBe(false);}
});

it('keeps deployment, maintenance, possible quantity and a confirmed plan as separate source claims',()=>{
 const good=checkSourceCapacity(snapshot(),{claims:[{kind:'deployment',option:'A',value:'simple'},{kind:'maintenance',option:'A',value:null},{kind:'confirmed-future-plan',value:null}]});expect((good.claimChecks as any[]).map(c=>c.status)).toEqual(['supported','unknown','unknown']);
 for(const claim of [{kind:'maintenance',option:'A',value:'simple'},{kind:'deployment',option:'B',value:'complex'},{kind:'confirmed-future-plan',value:true},{kind:'current-demand',value:300,unit:'GB'},{kind:'capacity-limit',option:'A',value:100,unit:'MB'}])expect(checkSourceCapacity(snapshot(),{claims:[claim]}).canonicalExplanation).toHaveProperty('status','withheld');
});

it('creates a fresh normal component projection whose local quantity actually changes capacity, without changing source or input',()=>{
 const r=capacityRequest(),before=JSON.stringify(r),s=snapshot(),bound=bindCapacityView(s,r.view,r.mapping);expect(bound.ok).toBe(true);expect(JSON.stringify(r)).toBe(before);if(!bound.ok||bound.view.component!=='DecisionExplorer')throw Error('bind');
 expect(JSON.stringify(bound)).not.toContain('UNVERIFIED_');const p=bound.view.payload;
 const current=decide(p,{[r.mapping.demandInputId]:80},true),future=decide(p,{[r.mapping.demandInputId]:300},true);
 expect(current.eligibleOptionIds).toEqual(p.options.map(o=>o.id));expect(future.excludedOptionIds).toEqual([p.options[0].id]);expect(future.recommendations).toEqual([]);expect(p.inputs[0].initial).toBe(80);expect(p.inputs[0].label).toContain('本地假设');expect(s.excerpt).toBe(capacityExpectations.cases[0].source);
 expect(bound.explanation).toContain('不是已确认');expect(p.options[0].suitableWhen).toContain('维护：未声明');
});

it('rechecks changed complete source rather than a prior matched view, and refuses hidden clauses/unknown units/excerpts',()=>{
 const r=capacityRequest();expect(checkSourceCapacity(snapshot(),r).comparison).toHaveProperty('status','matched');
 for(const text of [capacityExpectations.cases[0].source.replace('100GB','120GB'),capacityExpectations.cases[0].source.replace('80GB','90GB')])expect(checkSourceCapacity(snapshot(text),r).comparison).toHaveProperty('status','mismatch');
 const changed=checkSourceCapacity(snapshot(capacityExpectations.cases[0].source.replace('300GB','400GB')),{});expect(changed.computedCapacity).toHaveProperty('possibleFutureHypothesis.demand',400);
 const missing=checkSourceCapacity(snapshot(capacityExpectations.cases[0].source.replace('，以后可能到 300GB','')),{});expect(missing.computedCapacity).toHaveProperty('possibleFutureHypothesis',null);
 for(const text of [capacityExpectations.cases[0].source.replaceAll('GB','widgets'),capacityExpectations.cases[0].source.replace('100GB','1000000000000.000001GB'),capacityExpectations.cases[0].source+'价格每月十元。'])expect(checkSourceCapacity(snapshot(text),{})).toHaveProperty('status','source-unsupported');
 expect(checkSourceCapacity({...snapshot(),textByteStart:3},{})).toHaveProperty('status','source-unsupported');expect(sourceOptions(['--source-file','one.txt','--source-kind','capacity-zh'])).toHaveProperty('kind','capacity-zh');
});
