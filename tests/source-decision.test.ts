import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {checkSourceDecision,parseDecisionSource} from '../src/source-decision';
import {readSourceSnapshot} from '../src/source-input';
import type {SourceSnapshot} from '../src/source-graph';
import {validateEnvelope} from '../src/protocol';
import {d1Record,d1FirstView,d1Mapping,sourceAlignedD1} from '../fixtures/source-decision';
const file='docs/evidence/natural/r9-D1.json';
const hash=(b:string|Buffer)=>createHash('sha256').update(b).digest('hex');
const snapshot=(text:string):SourceSnapshot=>({kind:'decision-zh',documentSha256:hash(text),textSha256:hash(text),excerptSha256:hash(text),jsonPointer:null,textBytes:Buffer.byteLength(text),textByteStart:0,textByteEnd:Buffer.byteLength(text),excerpt:text});
const issues=(r:Record<string,unknown>)=>(r.issues as {code:string}[]).map(i=>i.code);
const source=()=>readSourceSnapshot({file,jsonPointer:'/question',kind:'decision-zh'});

it('parses the actual full original question against expectations frozen before implementation, including unknown opposite responsibilities',async()=>{
 const expected=JSON.parse(readFileSync('fixtures/source-decision-expectations.json','utf8'));
 expect(hash(readFileSync(file))).toBe(expected.source.sha256);expect(hash(d1Record.question)).toBe(expected.source.textSha256);
 const s=await source(),result=checkSourceDecision(s,{});
 expect(result.status).toBe('compared');expect(result.sourceFactsVerified).toBe(false);expect(result.source).toHaveProperty('identityVerified',false);
 const parsed=parseDecisionSource(s.excerpt);if(parsed.status!=='ready')throw Error('Original supported source rejected.');
 const facts=parsed.value.facts;
 expect(facts.filter(f=>f.kind==='capability').map(f=>[f.option,f.value])).toEqual([['托管平台',false],['虚拟机',true]]);
 expect(facts.filter(f=>f.kind==='maintenance-need').map(f=>[f.option,f.actor,f.value])).toEqual([['虚拟机','团队',true]]);
 expect(facts.filter(f=>f.kind==='actor-updates').map(f=>[f.option,f.actor,f.value])).toEqual([['托管平台','供应商',true]]);
 expect(facts.filter(f=>f.kind==='capability-need').map(f=>f.value)).toEqual([false]);expect(facts.filter(f=>f.kind==='actor-available')).toEqual([]);
 expect(facts.filter(f=>f.kind==='price').map(f=>f.value)).toEqual([null,null]);
 expect(result.canonicalExplanation).toHaveProperty('status','available');
 const text=(result.canonicalExplanation as {text:string}).text;expect(text).toContain('托管平台是否需要团队维护未声明');expect(text).toContain('虚拟机是否由供应商更新未声明');expect(text).toContain('团队维护余力未声明');expect(text).toContain('不据此排除');
 for(const f of facts)for(const span of f.spans)expect(Buffer.from(d1Record.question).subarray(span.textByteStart,span.textByteEnd).toString()).not.toBe('');
});

it('rejects the actual first wrong relation, invented opposite facts and billing units without rewriting the recorded output',async()=>{
 const before=JSON.stringify(d1FirstView),s=await source();
 const r=checkSourceDecision(s,{view:d1FirstView,mapping:d1Mapping,prose:d1Record.finalAnswer});
 expect(r.comparison).toHaveProperty('status','mismatch');expect(issues(r)).toEqual(expect.arrayContaining(['SOURCE_VALUE','SOURCE_REQUIREMENT_ROLE','SOURCE_FIELD_TYPE']));expect(r.canonicalExplanation).toHaveProperty('status','withheld');expect(r.freeProse).toHaveProperty('status','not-verified');
 expect(JSON.stringify(d1FirstView)).toBe(before);
});

it('accepts an explicitly authored source-aligned view while keeping unknowns/prose and the original natural failure separate',async()=>{
 const r=checkSourceDecision(await source(),{view:sourceAlignedD1(),mapping:d1Mapping,prose:d1Record.finalAnswer});
 expect(r.comparison).toHaveProperty('status','matched');expect(r.issues).toEqual([]);expect(r.computedDecision).toHaveProperty('recommendedOptionIds',[]);expect(r.freeProse).toHaveProperty('status','not-verified');expect(r.sourceFactsVerified).toBe(false);
});

it('does not depend on original entity names, actors, IDs or option order aliases',async()=>{
 const text=d1Record.question.replaceAll('托管平台','方案红').replaceAll('虚拟机','方案蓝').replaceAll('供应商','供应方').replaceAll('团队维护','运营组维护');
 const view=sourceAlignedD1();if(view.component!=='DecisionExplorer')throw Error();
 const p=view.payload;p.options[0].label='方案红';p.options[1].label='方案蓝';
 p.dimensions[1].label='供应方负责更新';p.dimensions[2].label='需运营组自行维护';p.inputs[1].label='运营组有维护余力';
 const mapping=structuredClone(d1Mapping);mapping.dimensions[1].actor='供应方';mapping.dimensions[2].actor='运营组';mapping.inputs[1].actor='运营组';
 const dims=new Map<string,string>(p.dimensions.map((d,i)=>[d.id,'field-'+i])),inputs=new Map<string,string>(p.inputs.map((v,i)=>[v.id,'control-'+i]));
 for(const o of p.options){o.id='option-'+o.id;const next:typeof o.values={};for(const [k,v]of Object.entries(o.values))next[dims.get(k)!]=v;o.values=next;}
 p.dimensions.forEach(d=>d.id=dims.get(d.id)!);p.inputs.forEach(i=>i.id=inputs.get(i.id)!);p.requirements!.forEach(r=>{r.dimension=dims.get(r.dimension)!;r.input=inputs.get(r.input)!;});mapping.dimensions.forEach(d=>d.id=dims.get(d.id)!);mapping.inputs.forEach(i=>i.id=inputs.get(i.id)!);
 p.options.reverse();
 expect(checkSourceDecision(snapshot(text),{view,mapping}).comparison).toHaveProperty('status','matched');
 p.options[0].label='未给的别名';expect(checkSourceDecision(snapshot(text),{view,mapping}).comparison).toHaveProperty('status','mismatch');
});

it('changes the hard exclusion with swapped capabilities and a true need, not with a preference',()=>{
 const text=d1Record.question.replace('没有私网','支持私网').replace('后者支持私网','后者没有私网').replace('暂时不需要私网','现在需要私网');
 const view=sourceAlignedD1();if(view.component!=='DecisionExplorer')throw Error();view.payload.options[0].values.private_net=true;view.payload.options[1].values.private_net=false;view.payload.inputs[0].initial=true;
 const result=checkSourceDecision(snapshot(text),{view,mapping:d1Mapping});expect(result.comparison).toHaveProperty('status','matched');expect(result.computedDecision).toHaveProperty('eligibleOptionIds',[]);expect(result.computedDecision).toHaveProperty('unknownFeasibilityIds',['hosted']);
 const pref=d1Record.question.replace('我们暂时不需要私网','我们更看重私网'),legacy=sourceAlignedD1();if(legacy.component!=='DecisionExplorer')throw Error();legacy.payload.inputs[0].initial=null;
 const wrong=checkSourceDecision(snapshot(pref),{view:legacy,mapping:d1Mapping});expect(issues(wrong)).toContain('SOURCE_PREFERENCE_AS_REQUIREMENT');expect(wrong.canonicalExplanation).toHaveProperty('status','withheld');
 const preferenceView=sourceAlignedD1();if(preferenceView.component!=='DecisionExplorer')throw Error();preferenceView.payload.inputs.splice(0,1);preferenceView.payload.requirements!.splice(0,1);const preferenceMap=structuredClone(d1Mapping);preferenceMap.inputs.splice(0,1);
 expect(checkSourceDecision(snapshot(pref),{view:preferenceView,mapping:preferenceMap}).comparison).toHaveProperty('status','matched');
});

it('keeps maintenance negation, actor direction and availability distinct',()=>{
 const text='测试小组在选方案甲与方案乙。前者不需要团队维护、由供应方更新；后者需要团队维护、没有私网。团队没有维护余力。两边价格都未知。我们需要私网，该怎样权衡？';
 const parsed=parseDecisionSource(text);if(parsed.status!=='ready')throw Error();
 expect(parsed.value.facts.filter(f=>f.kind==='maintenance-need').map(f=>[f.option,f.actor,f.value])).toEqual([['方案甲','团队',false],['方案乙','团队',true]]);
 expect(parsed.value.facts.find(f=>f.kind==='actor-available')).toMatchObject({actor:'团队',value:false});expect(parsed.value.facts.find(f=>f.kind==='actor-updates')).toMatchObject({actor:'供应方',value:true});
 const r=checkSourceDecision(snapshot(text),{claims:[{kind:'maintenance-need',option:'方案甲',actor:'团队',value:false},{kind:'actor-available',actor:'团队',value:false},{kind:'actor-updates',option:'方案乙',actor:'供应方',value:false}]});
 expect((r.claimChecks as {status:string}[]).map(c=>c.status)).toEqual(['supported','supported','unsupported-by-source']);
});

it('reports missing fields or explicit unknowns as unknown and refuses unsupported values, rules and source replacement',async()=>{
 const s=await source();
 const claims=checkSourceDecision(s,{claims:[{kind:'actor-available',actor:'团队',value:null},{kind:'price',option:'虚拟机',value:null},{kind:'maintenance-need',option:'托管平台',actor:'团队',value:true},{kind:'recommendation',text:'托管平台更便宜且应该优先。'}]});
 expect((claims.claimChecks as {status:string}[]).map(c=>c.status)).toEqual(['unknown','declared-unknown','unsupported-by-source','not-assessed']);expect(claims.canonicalExplanation).toHaveProperty('status','withheld');
 const view=sourceAlignedD1();if(view.component!=='DecisionExplorer')throw Error();view.payload.inputs[1].initial=true;expect(issues(checkSourceDecision(s,{view,mapping:d1Mapping}))).toContain('SOURCE_INITIAL');
 for(const field of ['sourceText','sourceFile','claimedAuthority','sourceFactsVerified','sourceKind'])expect(checkSourceDecision(s,{[field]:true}).status).toBe('validation-failed');
 const wrong=sourceAlignedD1();if(wrong.component!=='DecisionExplorer')throw Error();wrong.payload.inputs[0].expectedEffect='hard-and-preference';wrong.payload.rules=[{id:'prefer',priority:1,when:{mode:'all',clauses:[{input:'need_private_net',op:'eq',value:false}]},recommend:['hosted'],reason:'Source did not supply this policy.',origin:'given',evidence:[]}];expect(issues(checkSourceDecision(s,{view:wrong,mapping:d1Mapping}))).toContain('SOURCE_POLICY_UNSUPPORTED');
});

it('fails closed on contradictions, ambiguous references and unsupported clauses, rather than skipping them',()=>{
 const snippets=[
  '团队在选甲与乙。前者没有私网、支持私网。',
  '团队在选甲与乙。前者需要团队维护、不需要团队维护。',
  '团队在选甲与乙。我们需要私网、我们不需要私网。',
  '前者支持私网，后者没有私网。',
  '团队在选甲与乙。它支持私网。',
  '团队在选甲与乙。前者支持私网。两边价格都未知。以后可能自动迁移。',
  '团队在选甲与乙。前者没有私网但需要备份。',
  '团队在选甲与乙。前者由供应商负责更新。',
  '团队在选甲与乙。前者支持私网。需要团队维护。',
  '团队在选甲与乙。前者需要团队维护。团队已有维护余力。',
  '团队在选甲与乙。后者需要维护。',
  '团队在选甲与乙。后者需要团队维护。我们有维护余力。',
  '团队在选甲与乙与丙。前者支持私网。',
 ];
 for(const text of snippets){expect(parseDecisionSource(text).status,text).toBe('unsupported');expect(checkSourceDecision(snapshot(text),{}).canonicalExplanation).toHaveProperty('status','withheld');}
});

it('preserves an omitted source capability and omitted prices rather than borrowing the opposite values',()=>{
 const text=d1Record.question.replace('、没有私网','').replace('两边价格都未知。','');
 const view=sourceAlignedD1();if(view.component!=='DecisionExplorer')throw Error();
 expect(issues(checkSourceDecision(snapshot(text),{view,mapping:d1Mapping}))).toContain('SOURCE_VALUE');
 view.payload.options[0].values.private_net=null;
 const r=checkSourceDecision(snapshot(text),{view,mapping:d1Mapping});expect(r.comparison).toHaveProperty('status','matched');
 expect((r.fieldChecks as {dimensionId:string;status:string}[]).filter(f=>f.dimensionId==='price').map(f=>f.status)).toEqual(['unknown','unknown']);
});

it('supports explicit unknown conditions without resolving them or confusing source IDs with labels',()=>{
 const text='小组在选择甲与乙。前者私网支持未知；后者需要团队维护。团队维护余力未知。我们对私网的需求未知，如何权衡？';
 const r=checkSourceDecision(snapshot(text),{});expect(r.status).toBe('compared');const parsed=parseDecisionSource(text);if(parsed.status!=='ready')throw Error();expect(parsed.value.facts.filter(f=>f.kind==='capability'||f.kind==='capability-need'||f.kind==='actor-available').map(f=>f.value)).toEqual([null,null,null]);
});

it('preserves historical contracts and refuses omitted coordinate mappings or missing source conditions',async()=>{
 const s=await source(),base=sourceAlignedD1();
 for(const protocolVersion of ['1.3','1.4'] as const){const view=structuredClone(base);view.protocolVersion=protocolVersion;if(view.component!=='DecisionExplorer')throw Error();if(protocolVersion!=='1.4'){view.payload.dimensions.forEach(d=>delete d.semanticRole);view.payload.inputs.forEach(i=>{delete i.semanticRole;delete i.expectedEffect;});}expect(checkSourceDecision(s,{view,mapping:d1Mapping}).comparison).toHaveProperty('status','matched');}
 for(const protocolVersion of ['1.0','1.1','1.2'] as const){const old=structuredClone(d1FirstView);old.protocolVersion=protocolVersion;if(old.component!=='DecisionExplorer')throw Error();if(protocolVersion!=='1.2'){old.payload.dimensions.forEach(d=>{delete d.kind;delete d.unit;});old.payload.options.forEach(o=>{for(const k of Object.keys(o.values))if(typeof o.values[k]==='boolean')o.values[k]=String(o.values[k]);});delete old.payload.requirements;}const before=JSON.stringify(old);expect(validateEnvelope(old).ok).toBe(true);expect(checkSourceDecision(s,{view:old,mapping:d1Mapping}).comparison).not.toHaveProperty('status','matched');expect(JSON.stringify(old)).toBe(before);}
 expect(issues(checkSourceDecision(s,{view:base}))).toContain('SOURCE_MAPPING_REQUIRED');
 const map=structuredClone(d1Mapping);map.dimensions.pop();expect(issues(checkSourceDecision(s,{view:base,mapping:map}))).toContain('SOURCE_FACT_MISSING');
 const wrong=structuredClone(base);if(wrong.component!=='DecisionExplorer')throw Error();wrong.protocolVersion='1.2';wrong.payload.dimensions.forEach(d=>delete d.semanticRole);wrong.payload.inputs.forEach(i=>{delete i.semanticRole;delete i.expectedEffect;});wrong.payload.requirements=[];expect(issues(checkSourceDecision(s,{view:wrong,mapping:d1Mapping}))).toContain('SOURCE_REQUIREMENT_MISSING');
});

it('uses explicit availability and explicit no-maintenance facts instead of inferring them from updater identity',()=>{
 for(const [sentence,initial] of [['团队有维护余力',true],['团队没有维护余力',false]] as const){
  const view=sourceAlignedD1();if(view.component!=='DecisionExplorer')throw Error();view.payload.inputs[1].initial=initial;
  const r=checkSourceDecision(snapshot(d1Record.question+'。'+sentence+'。'),{view,mapping:d1Mapping});expect(r.comparison).toHaveProperty('status','matched');
  // Resource availability does not turn an undeclared option fact into a known
  // maintenance requirement. Preserve the existing conservative null contract.
  expect(r.computedDecision).toHaveProperty('eligibleOptionIds',initial?['vm']:[]);expect(r.computedDecision).toHaveProperty('unknownFeasibilityIds',['hosted']);
 }
 const explicit=d1Record.question.replace('前者由供应商更新','前者由供应商更新、不需要团队维护')+'。团队没有维护余力。';
 const view=sourceAlignedD1();if(view.component!=='DecisionExplorer')throw Error();view.payload.options[0].values.team_maint=false;view.payload.inputs[1].initial=false;
 const r=checkSourceDecision(snapshot(explicit),{view,mapping:d1Mapping});expect(r.comparison).toHaveProperty('status','matched');expect(r.computedDecision).toHaveProperty('eligibleOptionIds',['hosted']);expect(r.computedDecision).toHaveProperty('unknownFeasibilityIds',[]);
});
