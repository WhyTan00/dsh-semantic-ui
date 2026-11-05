import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {localConditions} from '../fixtures/local-conditions';
import {makeConditionDraft,validateConditionDraft,previewConditions,applyConditionPreview,assertConditionDraft} from '../src/condition-form';
import {createResult,readResult,resultDigest,initialInteraction,type ResultContent} from '../src/results';
import {defaultTheme,defaultLayout} from '../src/theme';
import {validateForDelivery} from '../src/core';
const p=localConditions.payload,initial=()=>Object.fromEntries(p.inputs.map(i=>[i.id,i.initial]));
it('uses a delivery-valid fixture with a known independent eligibility oracle',()=>{
 expect(validateForDelivery(localConditions).ok).toBe(true);
 const draft=makeConditionDraft(p,initial()),preview=previewConditions(p,draft,initial(),true,false);
 expect(preview.before.eligibleOptionIds).toEqual(['managed']);expect(preview.before.unknownFeasibilityIds).toEqual(['vm']);
});
it.each(['',' ',' 0','0 ','NaN','Infinity','-Infinity','1e999','0x10','1_000'])('refuses numeric draft %j without changing an applied value or null',text=>{
 const current=initial(),before=structuredClone(current),draft=makeConditionDraft(p,current);draft.fields.demand.text=text;
 expect(validateConditionDraft(p,draft).ok).toBe(false);expect(()=>previewConditions(p,draft,current,true,false)).toThrow('CONDITION_INVALID');expect(current).toEqual(before);expect(current.teamAvailable).toBeNull();
});
it('keeps explicit unknown separate from zero, negative and scientific finite inputs',()=>{
 const draft=makeConditionDraft(p,initial());
 for(const [text,value]of [['0',0],['-2.5',-2.5],['2e2',200]] as const){draft.fields.demand={mode:'value',text};expect(validateConditionDraft(p,draft)).toMatchObject({ok:true,values:{demand:value}});}
 draft.fields.demand={mode:'unknown',text:'not a numeric value'};expect(validateConditionDraft(p,draft)).toMatchObject({ok:true,values:{demand:null}});
 draft.fields.demand={mode:'value',text:'-1'};expect(validateConditionDraft(p,draft,'demand')).toMatchObject({ok:false,errors:{demand:'capacity'}});
});
it('refuses undeclared choices and booleans rather than coercing them',()=>{
 const draft=makeConditionDraft(p,initial());draft.fields.mode.text='invented';draft.fields.networkNeeded.text='1';
 expect(validateConditionDraft(p,draft)).toMatchObject({ok:false,errors:{mode:'choice',networkNeeded:'boolean'}});
});
it('previews multiple changes, applies them together and leaves declarations and source unknowns unchanged',()=>{
 const source=JSON.stringify(p),current=initial(),draft=makeConditionDraft(p,current);
 draft.fields.demand.text='200';draft.fields.teamAvailable={mode:'value',text:'true'};draft.fields.mode.text='高并发';
 const preview=previewConditions(p,draft,current,true,false);expect(current).toEqual(initial());
 expect(preview.after.eligibleOptionIds).toEqual(['vm']);expect(preview.after.excludedOptionIds).toEqual(['managed']);expect(preview.after.recommendations).toEqual([]);
 const applied=applyConditionPreview(p,draft,current,preview,true,false);expect(applied).toMatchObject({demand:200,teamAvailable:true,mode:'高并发'});expect(applied).not.toBe(current);expect(JSON.stringify(p)).toBe(source);expect(p.options.every(o=>o.values.price===null)).toBe(true);
});
it('requires a new preview if the draft, applied base or policy selection changes',()=>{
 const current=initial(),draft=makeConditionDraft(p,current),preview=previewConditions(p,draft,current,true,false);
 expect(()=>applyConditionPreview(p,draft,{...current,demand:101},preview,true,false)).toThrow('STALE');
 expect(()=>applyConditionPreview(p,draft,current,preview,true,true)).toThrow('STALE');
 draft.fields.demand.text='102';expect(()=>applyConditionPreview(p,draft,current,preview,true,false)).toThrow('STALE');expect(current).toEqual(initial());
});
it('rejects extra/missing field IDs and bounded non-data shapes',()=>{
 const draft=makeConditionDraft(p,initial());delete draft.fields.mode;expect(()=>assertConditionDraft(p,draft)).toThrow('CONDITION_FIELDS');
 draft.fields.extra={mode:'value',text:'1'};expect(()=>assertConditionDraft(p,draft)).toThrow('CONDITION_FIELDS');
 const next=makeConditionDraft(p,initial());next.fields.demand.text='x'.repeat(81);expect(()=>assertConditionDraft(p,next)).toThrow();
});
it('carries an invalid raw draft in format 2 while keeping the applied values separate and refusing a mislabeled v1',async()=>{
 const c:ResultContent={view:structuredClone(localConditions),theme:defaultTheme,layout:defaultLayout,locale:'zh-CN',interaction:initialInteraction(localConditions)};
 if(c.interaction.component!=='DecisionExplorer')throw Error('fixture');
 c.interaction.conditionDraft=makeConditionDraft(p,c.interaction.values);c.interaction.conditionDraft.fields.demand.text='NaN';
 const result=await createResult(c);expect(result.manifest.version).toBe(2);expect((await readResult(JSON.parse(JSON.stringify(result)))).content).toEqual(c);expect(c.interaction.values.demand).toBe(100);
 result.manifest.version=1;result.sha256=await resultDigest({manifest:result.manifest,content:result.content});await expect(readResult(result)).rejects.toThrow('RESULT_FORMAT');
});
it('reads the published preview.28 format 1 bytes without requiring migration or writing them',async()=>{
 const bytes=readFileSync('docs/evidence/result-package/examples/1.json','utf8'),old=JSON.parse(bytes),r=await readResult(old);
 expect(r.manifest.version).toBe(1);expect(r.content).toEqual(old.content);expect(readFileSync('docs/evidence/result-package/examples/1.json','utf8')).toBe(bytes);
});
