import {it,expect,vi} from 'vitest';
import {bindDecisionView} from '../src/source-delivery';
import {validateForDelivery,analyzeValidated} from '../src/core';
import {checkSourceDecision} from '../src/source-decision';
import {readSourceSnapshot} from '../src/source-input';
import {currentSourceProjection} from '../src/dsh/source';
import {apply} from '../src/dsh/host';
import {definition,checkpointOf} from '../src/dsh/definition';
import {META} from '../src/dsh/events';
import {d1Record,d1Mapping} from '../fixtures/source-decision';
import {annotatedDecision} from '../fixtures/decision-delivery';
import {decisionFacts} from '../src/facts';

function setup(text=d1Record.question){
 let state=currentSourceProjection.init({id:'decision-delivery-fixture'} as any,0 as any);
 const turn=(text:string,n=1)=>{state=currentSourceProjection.apply(state,{type:'turn/start',seq:n*10,data:{turn:n}} as any);state=currentSourceProjection.apply(state,{type:'user/message',seq:n*10+1,data:{id:'message-'+n,role:'user',source:{kind:'user'},content:[{type:'text',text}]}} as any);};turn(text);
 const ctx={tools:{register:vi.fn()},sessionProjections:{register:vi.fn(),stateOf:vi.fn((_s,key)=>key==='turnBoundary'?{lastTurn:state.turn,openTurnStartSeq:state.startSeq}:state)},systemPrompt:{section:vi.fn()},inject:vi.fn()};apply(ctx as any);
 return {tool:ctx.tools.register.mock.calls[0][0],exec:{signal:new AbortController().signal,callId:'fixture',agent:{session:{id:'decision-delivery-fixture'}}},turn};
}
it('rebuilds only source-matched cells/conditions and replaces all free notes without inventing opposite facts, price units or policy',async()=>{
 const source=await readSourceSnapshot({file:'docs/evidence/natural/r9-D1.json',jsonPointer:'/question',kind:'decision-zh'}),input=annotatedDecision(),before=JSON.stringify(input),v=validateForDelivery(input);if(!v.ok)throw Error();
 const r=bindDecisionView(source,v.value,d1Mapping);expect(r.ok).toBe(true);if(!r.ok||r.view.component!=='DecisionExplorer')throw Error();expect(JSON.stringify(input)).toBe(before);expect(JSON.stringify(r.view)).not.toContain('UNVERIFIED_');
 expect(r.view.payload.options[0].values.team_maint).toBeNull();expect(r.view.payload.options[1].values.vendor_managed).toBeNull();expect(r.view.payload.inputs[1].initial).toBeNull();expect(r.view.payload.dimensions[3]).not.toHaveProperty('unit');expect(r.view.payload.options.map(o=>o.values.price)).toEqual([null,null]);expect(r.view.payload.rules).toEqual([]);
 const checked=checkSourceDecision(source,{view:r.view,mapping:d1Mapping});expect(checked).toHaveProperty('comparison.status','matched');expect(r.explanation).toContain('团队维护余力未声明');expect(decisionFacts(r.view.payload,true).inputEffects.map(i=>i.scope)).toEqual(['hard','hard']);
});
it('rejects structurally valid inverse facts, invented price zero/currency, reversed initial need and unsupported policy',async()=>{
 const {tool,exec}=setup();const bad=[(()=>{const v=annotatedDecision();v.payload.options[0].values.team_maint=false;return v;})(),(()=>{const v=annotatedDecision();v.payload.options[1].values.vendor_managed=false;return v;})(),(()=>{const v=annotatedDecision();v.payload.options[0].values.price=0;v.payload.dimensions[3].kind='number';v.payload.dimensions[3].unit='USD/month';return v;})(),(()=>{const v=annotatedDecision();v.payload.dimensions[3].kind='number';v.payload.dimensions[3].unit='元/月';return v;})(),(()=>{const v=annotatedDecision();v.payload.inputs[0].initial=true;return v;})()];
 for(const view of bad){expect(validateForDelivery(view).ok).toBe(true);expect(await tool.execute({action:'render',view,mapping:d1Mapping},exec)).toHaveProperty('status','validation-failed');}
 const policy=annotatedDecision();policy.payload.inputs[0].expectedEffect='hard-and-preference';policy.payload.rules=[{id:'invented',priority:1,when:{mode:'all',clauses:[{input:'need_private_net',op:'eq',value:false}]},recommend:['hosted'],reason:'UNVERIFIED_WINNER',origin:'given',evidence:[]}];expect(validateForDelivery(policy).ok).toBe(true);const refused=await tool.execute({action:'render',view:policy,mapping:d1Mapping},exec);expect(refused).toHaveProperty('status','validation-failed');expect(refused.issues.some((i:{code:string})=>i.code==='SOURCE_POLICY_UNSUPPORTED')).toBe(true);
});
it('requires complete mapping and source coverage, and keeps mapping coordinates from declaring their own truth',async()=>{
 const {tool,exec}=setup();expect(await tool.execute({action:'render',view:annotatedDecision()},exec)).toHaveProperty('issues.0.code','SOURCE_MAPPING_REQUIRED');
 const mapping=structuredClone(d1Mapping);mapping.inputs[1].actor='另一个团队';expect(await tool.execute({action:'render',view:annotatedDecision(),mapping},exec)).toHaveProperty('status','validation-failed');
 const contradictory=setup(d1Record.question+'。团队有维护余力。团队没有维护余力。');expect(await contradictory.tool.execute({action:'render',view:annotatedDecision(),mapping:d1Mapping},contradictory.exec)).toHaveProperty('status','validation-failed');
});
it('supports changed source names, field/option IDs and row order without reusing old source coordinates',async()=>{
 const replacements:Record<string,string>={'托管平台':'方案甲','虚拟机':'方案乙','供应商':'运营方','团队':'小组','私网':'专网'},rename=(s:string)=>Object.entries(replacements).reduce((s,[a,b])=>s.replaceAll(a,b),s);
 const v=annotatedDecision(),mapping=structuredClone(d1Mapping),dims=new Map(v.payload.dimensions.map((d,i)=>[d.id,'field-'+i])),inputs=new Map(v.payload.inputs.map((i,n)=>[i.id,'input-'+n]));
 v.payload.dimensions.forEach(d=>{d.id=dims.get(d.id)!;d.label=rename(d.label);});v.payload.inputs.forEach(i=>{i.id=inputs.get(i.id)!;i.label=rename(i.label);});v.payload.options.forEach((o,i)=>{o.id='option-'+i;o.label=rename(o.label);o.values=Object.fromEntries(Object.entries(o.values).map(([k,v])=>[dims.get(k)!,v]));});v.payload.requirements!.forEach((r,i)=>{r.id='requirement-'+i;r.dimension=dims.get(r.dimension)!;r.input=inputs.get(r.input)!;});
 mapping.dimensions.forEach(b=>{b.id=dims.get(b.id)!;if(typeof b.name==='string')b.name=rename(b.name);if(typeof b.actor==='string')b.actor=rename(b.actor);});mapping.inputs.forEach(b=>{b.id=inputs.get(b.id)!;if(typeof b.name==='string')b.name=rename(b.name);if(typeof b.actor==='string')b.actor=rename(b.actor);});v.payload.options.reverse();v.payload.dimensions.reverse();
 const {tool,exec}=setup(rename(d1Record.question)),r=await tool.execute({action:'render',view:v,mapping},exec);expect(r.sourceDeliveryStatus).toBe('bound');expect(JSON.stringify(r)).not.toContain('UNVERIFIED_');
});
it('freshly checks current turn/revision and persists precisely the derived Decision with original source conditions',async()=>{
 const {tool,exec,turn}=setup();await tool.execute({action:'source-check',view:annotatedDecision(),mapping:d1Mapping},exec);const args={action:'render',view:annotatedDecision(),mapping:d1Mapping},r=await tool.execute(args,exec);args.view.revision=999;args.view.summary='UNVERIFIED_MUTATION';
 const meta=tool.output.presentationMeta(args,JSON.parse(JSON.stringify(r))),cp=checkpointOf({type:'tool/ptc-dispatch',data:{meta}})!;expect(cp.view?.revision).toBe(1);expect(cp.sourceDelivery).toHaveProperty('kind','decision-zh');expect(JSON.stringify(cp)).not.toContain('UNVERIFIED_');
 const restored=definition.start!({} as any,{event:{type:'tool/result',data:{meta}}} as any,{} as any);expect(restored).toMatchObject({view:cp.view,sourceDelivery:cp.sourceDelivery});const stale=structuredClone(cp);stale.view!.revision=2;expect(definition.start!({} as any,{event:{type:'tool/result',data:{meta:{[META]:stale}}}} as any,{} as any)).toHaveProperty('issues.0.code','SOURCE_CHECKPOINT_MISMATCH');
 turn(d1Record.question.replace('暂时不需要私网','现在需要私网'),2);expect(await tool.execute({action:'render',view:annotatedDecision(2),mapping:d1Mapping},exec)).toHaveProperty('status','validation-failed');
});
it('keeps option unknowns and preference withheld under local what-if availability/capability changes',()=>{
 const v=annotatedDecision(),original=decisionFacts(v.payload,true),available=structuredClone(v.payload);available.inputs[1].initial=true;const a=decisionFacts(available,true);expect(original.unknownFeasibilityIds).toEqual(['hosted','vm']);expect(a.eligibleOptionIds).toEqual(['vm']);expect(a.unknownFeasibilityIds).toEqual(['hosted']);
 available.inputs[0].initial=true;const need=decisionFacts(available,true);expect(need.eligibleOptionIds).toEqual(['vm']);expect(need.excludedOptionIds).toEqual(['hosted']);expect(need.recommendedOptionIds).toEqual([]);expect(v.payload.inputs[1].initial).toBeNull();expect(v.payload.options[0].values.team_maint).toBeNull();
});
