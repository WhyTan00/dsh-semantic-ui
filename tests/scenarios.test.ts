import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {localConditions} from '../fixtures/local-conditions';
import {captureDecision,compareDecisionScenarios,assertDecisionSnapshot} from '../src/scenarios';
import {initialInteraction,createResult,readResult,resultDigest,type ResultContent} from '../src/results';
import {defaultTheme,defaultLayout} from '../src/theme';
const p=localConditions.payload,initial=()=>Object.fromEntries(p.inputs.map(i=>[i.id,i.initial])),dimensions=p.dimensions.map(d=>d.id);
const a=()=>captureDecision(p,initial(),dimensions,false);
const b=()=>captureDecision(p,{networkNeeded:false,teamAvailable:true,demand:200,mode:'高并发'},dimensions,false);
it('captures an independent A without sharing applied values or dimension arrays',()=>{
 const values=initial(),selected=[...dimensions],snapshot=captureDecision(p,values,selected,false);values.demand=999;selected.pop();expect(snapshot.values.demand).toBe(100);expect(snapshot.values.teamAvailable).toBeNull();expect(snapshot.dimensions).toEqual(dimensions);
});
it('changes only local hypotheses with an independent numeric and resource eligibility oracle',()=>{
 const original=JSON.stringify(p),left=a(),right=b(),result=compareDecisionScenarios(p,left,right,true);
 expect(result.a.eligibleOptionIds).toEqual(['managed']);expect(result.a.unknownFeasibilityIds).toEqual(['vm']);expect(result.a.excludedOptionIds).toEqual([]);
 expect(result.b.eligibleOptionIds).toEqual(['vm']);expect(result.b.unknownFeasibilityIds).toEqual([]);expect(result.b.excludedOptionIds).toEqual(['managed']);expect(result.b.recommendations).toEqual([]);
 expect(result.outcomeChanged).toBe(true);expect(result.conditions.filter(c=>c.changed).map(c=>c.id)).toEqual(['teamAvailable','demand','mode']);expect(left).toEqual(a());expect(JSON.stringify(p)).toBe(original);
 expect(result.a.unknownComparisonCells).toEqual([{optionId:'managed',dimensionId:'price'},{optionId:'vm',dimensionId:'price'}]);expect(result.b.unknownComparisonCells).toEqual(result.a.unknownComparisonCells);
});
it('does not treat display selections as conditions or invent an outcome change below a threshold',()=>{
 const left=a(),right=a();right.dimensions=['price'];right.values.demand=101;const result=compareDecisionScenarios(p,left,right,true);
 expect(result.dimensionsChanged).toBe(true);expect(result.conditions.filter(c=>c.changed).map(c=>c.id)).toEqual(['demand']);expect(result.outcomeChanged).toBe(false);expect(result.requirementChanges).toEqual([]);expect(result.a.eligibleOptionIds).toEqual(['managed']);expect(result.b.eligibleOptionIds).toEqual(['managed']);
});
it('does not turn unknown demand into zero or unknown team availability into false',()=>{
 const left=b(),right=b();left.values.demand=null;left.values.teamAvailable=null;right.values.demand=0;right.values.teamAvailable=false;right.values.mode='常规';const result=compareDecisionScenarios(p,left,right,true);
 expect(result.a.requirements.filter(r=>r.inputId==='demand').map(r=>r.status)).toEqual(['unknown','unknown']);expect(result.a.requirements.find(r=>r.optionId==='vm'&&r.inputId==='teamAvailable')!.status).toBe('unknown');
 expect(result.b.requirements.filter(r=>r.inputId==='demand').map(r=>r.status)).toEqual(['pass','pass']);expect(result.b.requirements.find(r=>r.optionId==='vm'&&r.inputId==='teamAvailable')!.status).toBe('fail');expect(result.b.eligibleOptionIds).toEqual(['managed']);expect(result.b.excludedOptionIds).toEqual(['vm']);expect(result.conditions.find(c=>c.id==='demand')).toMatchObject({a:null,b:0});
});
it('keeps explicit local policy selection in each snapshot without promoting unknown facts to an approved winner',()=>{
 const left=a(),right=a();right.exploreProposals=true;const result=compareDecisionScenarios(p,left,right,true);expect(result.policySelectionChanged).toBe(true);expect(result.outcomeChanged).toBe(false);expect(result.b.recommendations).toEqual([]);expect(result.a.unknownComparisonCells).toHaveLength(2);
});
it.each(['missing','extra','wrong-type','unknown-choice','unknown-dimension','duplicate-dimension'])('rejects %s fields in a retained A',kind=>{
 const snapshot=a();if(kind==='missing')delete snapshot.values.mode;if(kind==='extra')snapshot.values.extra=1;if(kind==='wrong-type')snapshot.values.networkNeeded=0;if(kind==='unknown-choice')snapshot.values.mode='invented';if(kind==='unknown-dimension')snapshot.dimensions.push('invented');if(kind==='duplicate-dimension')snapshot.dimensions.push(snapshot.dimensions[0]);expect(()=>assertDecisionSnapshot(p,snapshot)).toThrow();
});
function content(viewing:'a'|'b'):ResultContent{
 const interaction=initialInteraction(localConditions);if(interaction.component!=='DecisionExplorer')throw Error('fixture');const right=b();Object.assign(interaction,right);interaction.conditionDraft={version:1,fields:Object.fromEntries(p.inputs.map(i=>[i.id,{mode:right.values[i.id]===null?'unknown':'value',text:String(right.values[i.id]??'')}]))};interaction.conditionDraft.fields.demand.text='NaN';interaction.scenarioComparison={version:1,a:a(),viewing};
 return {view:structuredClone(localConditions),theme:defaultTheme,layout:defaultLayout,locale:'zh-CN',interaction};
}
it.each(['a','b'] as const)('round-trips both scenarios, current %s selection and invalid independent B draft',async viewing=>{
 const c=content(viewing),r=await createResult(c);expect(r.manifest.version).toBe(3);expect((await readResult(JSON.parse(JSON.stringify(r)))).content).toEqual(c);
 const state=r.content.interaction;if(state.component!=='DecisionExplorer')throw Error('fixture');expect(state.values.demand).toBe(200);expect(state.conditionDraft!.fields.demand.text).toBe('NaN');expect(state.scenarioComparison!.a.values.demand).toBe(100);expect(state.scenarioComparison!.a.values.teamAvailable).toBeNull();
});
it.each([1,2])('refuses to label a comparison as old result format %s even with a recomputed digest',async version=>{
 const r=await createResult(content('a'));if(r.content.interaction.component!=='DecisionExplorer')throw Error('fixture');delete r.content.interaction.conditionDraft;r.manifest.version=version as 1|2;r.sha256=await resultDigest({manifest:r.manifest,content:r.content});await expect(readResult(r)).rejects.toThrow('RESULT_FORMAT');
});
it('rejects an imported malformed A rather than substituting source defaults or touching B',async()=>{
 const r=await createResult(content('b')),before=JSON.stringify(r.content);if(r.content.interaction.component!=='DecisionExplorer')throw Error('fixture');r.content.interaction.scenarioComparison!.a.values.mode='invented';r.sha256=await resultDigest({manifest:r.manifest,content:r.content});await expect(readResult(r)).rejects.toThrow('SCENARIO_VALUE');expect(r.content.interaction.values.demand).toBe(200);expect(before).toContain('高并发');
});
it('reads the exact previous synthetic preview30 format2 export and the existing preview28 format1 fixture',async()=>{
 for(const file of ['fixtures/result-compat/preview30.json','docs/evidence/result-package/examples/1.json']){
  const bytes=readFileSync(file,'utf8'),old=JSON.parse(bytes),result=await readResult(old);expect(result.content).toEqual(old.content);expect(result.manifest.version).toBe(old.manifest.version);expect(readFileSync(file,'utf8')).toBe(bytes);
 }
});
