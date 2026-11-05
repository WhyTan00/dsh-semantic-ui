import {z} from 'zod';
import type {Decision} from './protocol';
import {decide,type InputValues} from './math';
import {validCapacityAmount} from './capacity-domain';

/** Raw edits are data, including invalid text. Only a validated preview can be applied. */
export const conditionDraftSchema=z.strictObject({version:z.literal(1),fields:z.record(z.string().max(80),z.strictObject({mode:z.enum(['unknown','value']),text:z.string().max(80)})).refine(fields=>Object.keys(fields).length<=12)});
export type ConditionDraft=z.infer<typeof conditionDraftSchema>;
export function makeConditionDraft(p:Decision,values:InputValues):ConditionDraft{
 return {version:1,fields:Object.fromEntries(p.inputs.map(i=>[i.id,{mode:values[i.id]===null?'unknown':'value',text:values[i.id]===null?'':String(values[i.id])}]))};
}
export function assertConditionDraft(p:Decision,draft:ConditionDraft){
 conditionDraftSchema.parse(draft);
 if(Object.keys(draft.fields).length!==p.inputs.length||!p.inputs.every(i=>Object.hasOwn(draft.fields,i.id)))throw Error('CONDITION_FIELDS');
}
export type ConditionError='empty'|'number'|'capacity'|'boolean'|'choice';
export function validateConditionDraft(p:Decision,draft:ConditionDraft,capacityDemandId?:string){
 assertConditionDraft(p,draft);
 const errors:Record<string,ConditionError>={},pairs:[string,InputValues[string]][]=[];
 for(const input of p.inputs){
  const field=draft.fields[input.id],text=field.text;
  if(field.mode==='unknown'){pairs.push([input.id,null]);continue;}
  let value:InputValues[string]=null,error:ConditionError|undefined;
  if(!text.trim())error='empty';
  else if(input.type==='number'){
   if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(text)||!Number.isFinite(Number(text)))error='number';
   else if(input.id===capacityDemandId&&!validCapacityAmount(Number(text)))error='capacity';
   else value=Number(text);
  }else if(input.type==='boolean'){
   if(text!=='true'&&text!=='false')error='boolean';else value=text==='true';
  }else if(!input.choices?.includes(text))error='choice';else value=text;
  if(error)errors[input.id]=error;
  pairs.push([input.id,value]);
 }
 return Object.keys(errors).length?{ok:false as const,errors}:{ok:true as const,values:Object.fromEntries(pairs),errors};
}
const valuesKey=(p:Decision,values:InputValues)=>JSON.stringify(p.inputs.map(i=>[i.id,values[i.id]]));
const draftKey=(p:Decision,draft:ConditionDraft)=>JSON.stringify(p.inputs.map(i=>[i.id,draft.fields[i.id].mode,draft.fields[i.id].text]));
export function previewConditions(p:Decision,draft:ConditionDraft,current:InputValues,strictPolicy:boolean,exploreProposals:boolean,capacityDemandId?:string){
 const valid=validateConditionDraft(p,draft,capacityDemandId);
 if(!valid.ok)throw Error('CONDITION_INVALID');
 return {draftKey:draftKey(p,draft),baseKey:valuesKey(p,current),strictPolicy,exploreProposals,capacityDemandId,
  changes:p.inputs.map(i=>({id:i.id,source:i.initial,current:current[i.id],proposed:valid.values[i.id]})),
  before:decide(p,current,strictPolicy,exploreProposals),after:decide(p,valid.values,strictPolicy,exploreProposals)};
}
export type ConditionPreview=ReturnType<typeof previewConditions>;
export function applyConditionPreview(p:Decision,draft:ConditionDraft,current:InputValues,preview:ConditionPreview,strictPolicy:boolean,exploreProposals:boolean,capacityDemandId?:string):InputValues{
 if(preview.draftKey!==draftKey(p,draft)||preview.baseKey!==valuesKey(p,current)||preview.strictPolicy!==strictPolicy||preview.exploreProposals!==exploreProposals||preview.capacityDemandId!==capacityDemandId)throw Error('CONDITION_PREVIEW_STALE');
 const valid=validateConditionDraft(p,draft,capacityDemandId);
 if(!valid.ok)throw Error('CONDITION_INVALID');
 return valid.values;
}
