import type { Chart, Decision } from './protocol';
export type InputValues = Record<string, string | number | boolean | null>;
type Truth = boolean | 'unknown';
export function matches(condition: Decision['rules'][number]['when'], inputs: InputValues): Truth {
  const results:Truth[]=condition.clauses.map(c=>{const v=inputs[c.input];if(v===null||v===undefined)return 'unknown';switch(c.op){case'eq':return v===c.value;case'ne':return v!==c.value;case'gt':return typeof v==='number'&&typeof c.value==='number'&&v>c.value;case'gte':return typeof v==='number'&&typeof c.value==='number'&&v>=c.value;case'lt':return typeof v==='number'&&typeof c.value==='number'&&v<c.value;case'lte':return typeof v==='number'&&typeof c.value==='number'&&v<=c.value;}});
  if(condition.mode==='all')return results.includes(false)?false:results.includes('unknown')?'unknown':true;
  return results.includes(true)?true:results.includes('unknown')?'unknown':false;
}
export function referencedDecisionInputs(p:Decision){
 return new Set([...(p.requirements??[]).map(r=>r.input),...[...p.rules,...p.constraints,...(p.requirements??[]).filter(r=>r.when).map(r=>({when:r.when!}))].flatMap(r=>r.when.clauses.map(c=>c.input))]);
}
export function requirementChecks(p:Decision,inputs:InputValues){
 return (p.requirements??[]).flatMap(r=>p.options.map(option=>{
  const dimension=p.dimensions.find(d=>d.id===r.dimension)!,actual=option.values[r.dimension]??null,needed=inputs[r.input]??null,active=r.when?matches(r.when,inputs):true;
  const status=active===false||r.relation==='supports'&&needed===false?'inactive':active==='unknown'||actual===null||needed===null?'unknown':r.relation==='supports'?(actual===true?'pass':'fail'):typeof actual==='number'&&typeof needed==='number'&&(r.relation==='at-least'?actual>=needed:actual<=needed)?'pass':'fail';
  return {requirementId:r.id,optionId:option.id,dimensionId:r.dimension,inputId:r.input,unit:dimension.unit??null,actual,needed,relation:r.relation,active,status};
 }));
}
export function decide(p:Decision,inputs:InputValues,strictPolicy=false,exploreProposals=false){
  const evaluated=p.rules.map(rule=>({rule,match:matches(rule.when,inputs)}));
  const matched=evaluated.filter(r=>r.match===true);const priority=Math.max(-1,...matched.map(r=>r.rule.priority));
  const unresolved=evaluated.filter(r=>r.match==='unknown'&&r.rule.priority>=priority);
  const triggered=matched.filter(r=>r.rule.priority===priority).map(r=>r.rule);
  const constraints=p.constraints.map(c=>({constraint:c,match:matches(c.when,inputs)}));
  const blocked=new Set(constraints.filter(c=>c.match===true).map(c=>c.constraint.optionId));
  const requirements=requirementChecks(p,inputs);requirements.filter(r=>r.status==='fail').forEach(r=>blocked.add(r.optionId));
  const unknownComparisonCells=p.options.flatMap(o=>p.dimensions.filter(d=>o.values[d.id]===null).map(d=>({optionId:o.id,dimensionId:d.id})));
  const proposalWithMissingFacts=strictPolicy&&triggered.length>0&&unknownComparisonCells.length>0;
  // A model-supplied origin label cannot authorize a preference. Quantitative
  // eligibility stays useful while all preference policies require local opt-in.
  const requiresPolicyReview=strictPolicy&&p.rules.length>0&&!exploreProposals;
  const recommendations=unresolved.length?[]:p.options.filter(o=>triggered.some(r=>r.recommend.includes(o.id))&&!blocked.has(o.id)).map(o=>o.id);
  const uncertainConstraints=constraints.some(c=>c.match==='unknown'&&recommendations.includes(c.constraint.optionId))||requirements.some(r=>r.status==='unknown'&&recommendations.includes(r.optionId));
  const pendingConditions=[...unresolved.map(r=>r.rule.when),...constraints.filter(c=>c.match==='unknown'&&recommendations.includes(c.constraint.optionId)).map(c=>c.constraint.when),...(p.requirements??[]).filter(r=>r.when&&requirements.some(check=>check.requirementId===r.id&&check.status==='unknown')).map(r=>r.when!)];
  const missing=new Set(pendingConditions.flatMap(c=>c.clauses.filter(clause=>inputs[clause.input]===null||inputs[clause.input]===undefined).map(clause=>clause.input)));
  requirements.filter(r=>r.status==='unknown'&&inputs[r.inputId]===null).forEach(r=>missing.add(r.inputId));
  const missingInputs=p.inputs.filter(input=>missing.has(input.id)).map(input=>({id:input.id,label:input.label}));
  const unknownFeasibilityIds=p.options.filter(o=>!blocked.has(o.id)&&(constraints.some(c=>c.constraint.optionId===o.id&&c.match==='unknown')||requirements.some(r=>r.optionId===o.id&&r.status==='unknown'))).map(o=>o.id);
  return {unusedInputIds:p.inputs.filter(i=>!referencedDecisionInputs(p).has(i.id)).map(i=>i.id),status:unresolved.length||uncertainConstraints||proposalWithMissingFacts?'insufficient':requiresPolicyReview?'review-required':!triggered.length?'no-match':!recommendations.length?'blocked':'matched', recommendations:uncertainConstraints||proposalWithMissingFacts||requiresPolicyReview?[]:recommendations,triggered,unresolved:unresolved.map(r=>r.rule),constraints,requirements,missingInputs,unknownComparisonCells,proposalWithMissingFacts,requiresPolicyReview,preferenceMode:strictPolicy?(exploreProposals?'explicit-local-exploration':'withheld-pending-local-review'):'legacy-declared-policy',excludedOptionIds:[...blocked],unknownFeasibilityIds,eligibleOptionIds:p.options.filter(o=>!blocked.has(o.id)&&!unknownFeasibilityIds.includes(o.id)).map(o=>o.id)};
}
export function numericStats(values:(number|null)[]){
  let n=0,missing=0,sum=0,min=Infinity,max=-Infinity;
  for(const x of values)if(x===null)missing++;else{n++;sum+=x;min=Math.min(min,x);max=Math.max(max,x);}
  return {n,missing,sum:n&&Number.isFinite(sum)?sum:null,mean:n&&Number.isFinite(sum)?sum/n:null,min:n?min:null,max:n?max:null};
}
export function histogram(source:Extract<Chart,{chartType:'histogram'}>['source']){
  const b=source.boundaries;
  return source.groups.map(group=>{
    const counts=Array<number>(b.length-1).fill(0);let missing=0;
    if('observations'in group){for(const x of group.observations){if(x===null){missing++;continue;}if(x<b[0]||x>b[b.length-1])throw Error('Observation outside bins');let i=b.length-2;for(let j=0;j<b.length-1;j++)if(x>=b[j]&&x<b[j+1]){i=j;break;}counts[i]++;}}else{counts.splice(0,counts.length,...group.counts);missing=group.missing;}
    const n=counts.reduce((a,c)=>a+c,0);
    return {id:group.id,label:group.label,counts,n,missing,proportions:counts.map(c=>n?c/n:null)};
  });
}
export function sortedRows(p:Exclude<Chart,{chartType:'histogram'}>){
  return p.x.order==='input'?[...p.rows]:[...p.rows].sort((a,b)=>p.x.kind==='time'?Date.parse(a.x)-Date.parse(b.x):a.x.localeCompare(b.x,'en'));
}
