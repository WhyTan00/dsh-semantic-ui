import type { Chart, Decision } from './protocol';
export type InputValues = Record<string, string | number | boolean | null>;
type Truth = boolean | 'unknown';
export function matches(condition: Decision['rules'][number]['when'], inputs: InputValues): Truth {
  const results:Truth[]=condition.clauses.map(c=>{const v=inputs[c.input];if(v===null||v===undefined)return 'unknown';switch(c.op){case'eq':return v===c.value;case'ne':return v!==c.value;case'gt':return typeof v==='number'&&typeof c.value==='number'&&v>c.value;case'gte':return typeof v==='number'&&typeof c.value==='number'&&v>=c.value;case'lt':return typeof v==='number'&&typeof c.value==='number'&&v<c.value;case'lte':return typeof v==='number'&&typeof c.value==='number'&&v<=c.value;}});
  if(condition.mode==='all')return results.includes(false)?false:results.includes('unknown')?'unknown':true;
  return results.includes(true)?true:results.includes('unknown')?'unknown':false;
}
export function decide(p:Decision,inputs:InputValues){
  const evaluated=p.rules.map(rule=>({rule,match:matches(rule.when,inputs)}));
  const matched=evaluated.filter(r=>r.match===true);const priority=Math.max(-1,...matched.map(r=>r.rule.priority));
  const unresolved=evaluated.filter(r=>r.match==='unknown'&&r.rule.priority>=priority);
  const triggered=matched.filter(r=>r.rule.priority===priority).map(r=>r.rule);
  const constraints=p.constraints.map(c=>({constraint:c,match:matches(c.when,inputs)}));
  const blocked=new Set(constraints.filter(c=>c.match===true).map(c=>c.constraint.optionId));
  const recommendations=unresolved.length?[]:p.options.filter(o=>triggered.some(r=>r.recommend.includes(o.id))&&!blocked.has(o.id)).map(o=>o.id);
  const uncertainConstraints=constraints.some(c=>c.match==='unknown'&&recommendations.includes(c.constraint.optionId));
  const pendingConditions=[...unresolved.map(r=>r.rule.when),...constraints.filter(c=>c.match==='unknown'&&recommendations.includes(c.constraint.optionId)).map(c=>c.constraint.when)];
  const missing=new Set(pendingConditions.flatMap(c=>c.clauses.filter(clause=>inputs[clause.input]===null||inputs[clause.input]===undefined).map(clause=>clause.input)));
  const missingInputs=p.inputs.filter(input=>missing.has(input.id)).map(input=>({id:input.id,label:input.label}));
  return {status:unresolved.length||uncertainConstraints?'insufficient':!triggered.length?'no-match':!recommendations.length?'blocked':'matched', recommendations:uncertainConstraints?[]:recommendations,triggered,unresolved:unresolved.map(r=>r.rule),constraints,missingInputs};
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
