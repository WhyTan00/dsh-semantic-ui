import type {Decision,Issue} from './protocol';
import {decisionInputEffects} from './math';

const rolePairs={supports:['capability-support','capability-need'],'requires-availability':['resource-need','resource-available']} as const;

/** Only checks supplied declarations against each other, never against prose or a source. */
export function decisionDeclarationIssues(p:Decision):Issue[]{
 const issues:Issue[]=[];
 const add=(path:string,code:string,reason:string,hint:string)=>issues.push({path:'$.payload.'+path,code,reason,hint});
 for(const [n,d] of p.dimensions.entries())if(d.semanticRole&&(d.kind!=='boolean'||!!d.unit))add(`dimensions.${n}.semanticRole`,'ROLE_TYPE','Capability/resource roles require a unitless boolean dimension.','Use a boolean field for this role, or remove the role. Do not infer a role from its label.');
 for(const [n,i] of p.inputs.entries())if(i.semanticRole&&(i.type!=='boolean'||!!i.unit))add(`inputs.${n}.semanticRole`,'ROLE_TYPE','Capability/resource roles require a unitless boolean input.','Use a boolean input for this role, or remove the role.');
 for(const [n,r] of (p.requirements??[]).entries()){
  if(r.relation!=='supports'&&r.relation!=='requires-availability')continue;
  const pair=rolePairs[r.relation],di=p.dimensions.findIndex(d=>d.id===r.dimension),ii=p.inputs.findIndex(i=>i.id===r.input);
  if(di<0||ii<0)continue; // Reference validation owns unknown IDs.
  const d=p.dimensions[di],i=p.inputs[ii];
  if(!d.semanticRole)add(`dimensions.${di}.semanticRole`,'DECLARATION_MISSING',`Requirement ${r.id} needs an explicit option-field role.`,`For ${r.relation}, declare ${pair[0]} on dimension ${d.id}. Verify against the source; do not guess from labels.`);
  if(!i.semanticRole)add(`inputs.${ii}.semanticRole`,'DECLARATION_MISSING',`Requirement ${r.id} needs an explicit local-input role.`,`For ${r.relation}, declare ${pair[1]} on input ${i.id}. Preserve unknown initial values.`);
  if(d.semanticRole&&d.semanticRole!==pair[0]||i.semanticRole&&i.semanticRole!==pair[1])add(`requirements.${n}.relation`,'ROLE_RELATION',`Requirement ${r.id}: ${r.relation} contradicts the declared field/input roles.`,`Expected ${pair[0]} → ${pair[1]}. Recheck the roles and relation against the source; do not silently reverse either.`);
 }
 for(const [n,effect] of decisionInputEffects(p).entries()){
  const input=p.inputs[n];
  if(effect.scope==='unused')add(`inputs.${n}`,'UNUSED_INPUT',`Local input ${input.id} has no dependency.`,'Remove unused controls; do not invent a rule to justify a control.');
  if(!input.expectedEffect)add(`inputs.${n}.expectedEffect`,'DECLARATION_MISSING',`Input ${input.id} must declare its expected dependency scope.`,'Declare hard, preference-only or hard-and-preference, then link the input to the corresponding requirements/constraints/rules. Unused controls must be removed.');
  else if(input.expectedEffect!==effect.scope)add(`inputs.${n}.expectedEffect`,'INPUT_EFFECT',`Input ${input.id}: expected ${input.expectedEffect}, actual ${effect.scope}.`,'Compare requirement/constraint predicates (hard) and preference-rule predicates. Correct the declaration or explicit links; no automatic policy rewrite.');
 }
 return issues;
}

/** Lossless IDs/roles/links within protocol bounds, without labels, prose or model facts. */
export function decisionDeclarationFacts(p:Decision){
 return {scope:'declared-fields-and-dependencies',sourceFactsVerified:false,
  requirements:(p.requirements??[]).map(r=>({requirementId:r.id,dimensionId:r.dimension,dimensionRole:p.dimensions.find(d=>d.id===r.dimension)?.semanticRole??null,inputId:r.input,inputRole:p.inputs.find(i=>i.id===r.input)?.semanticRole??null,relation:r.relation,unit:p.dimensions.find(d=>d.id===r.dimension)?.unit??null})),
  inputs:decisionInputEffects(p).map(e=>({inputId:e.inputId,scope:e.scope,expectedEffect:p.inputs.find(i=>i.id===e.inputId)?.expectedEffect??null})),
  dependencyLinks:'decisionFacts.inputEffects',
  boundary:'Internal declaration consistency only. Roles and expectations are supplied data, not independent source facts. Links include inactive/conditional predicates; a dependency does not guarantee every value change alters the result. Free prose is not certified.'};
}
