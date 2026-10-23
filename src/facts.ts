import type {Chart,Decision} from './protocol';
import{decide,histogram,numericStats,sortedRows}from'./math';
const finiteOrNull=(value:number)=>Number.isFinite(value)?value:null;
/** Declared policy evaluation is evidence about the policy, not its truth. */
export function decisionFacts(decision:Decision){
 const inputs=Object.fromEntries(decision.inputs.map(input=>[input.id,input.initial]));
 const result=decide(decision,inputs);
 return {scope:'declared-policy-under-original-conditions',status:result.status,recommendedOptionIds:result.recommendations,matchedRuleIds:result.triggered.map(rule=>rule.id),pendingRuleIds:result.unresolved.map(rule=>rule.id),missingInputs:result.missingInputs,activeConstraintIds:result.constraints.filter(c=>c.match===true).map(c=>c.constraint.id),unknownConstraintIds:result.constraints.filter(c=>c.match==='unknown').map(c=>c.constraint.id),declaredOriginCounts:{given:decision.rules.filter(rule=>rule.origin==='given').length,modelJudgment:decision.rules.filter(rule=>rule.origin==='model-judgment').length},boundary:'Evaluates supplied rules and initial conditions only; does not independently verify their origin, facts or suitability. Insufficient conditions do not establish a winner.'};
}
/** Bounded, deterministic full-data facts; no model interpretation or spec echo. */
export function chartFacts(chart:Chart){
 if(chart.chartType==='histogram'){
  const bins=chart.source.boundaries.length-1;const includeBins=bins<=12;
  return {scope:'original-full-data',chartType:'histogram' as const,unit:chart.unit,source:chart.source.mode,bins,boundaries:includeBins?chart.source.boundaries:null,binDetails:includeBins?'all':'omitted: more than 12 bins; inspect the rendered source table',boundaryRule:'[lower, upper); final bin includes upper',proportionDenominator:'valid observations in each full group; missing excluded',groups:histogram(chart.source).map(g=>({id:g.id,valid:g.n,missing:g.missing,counts:includeBins?g.counts:null,proportions:includeBins?g.proportions:null}))};
 }
 const rows=sortedRows(chart);
 const endpoint=(row:typeof rows[number]|undefined)=>row?{id:row.id,x:row.x.length>120?row.x.slice(0,120)+'…':row.x,xTruncated:row.x.length>120}:null;
 return {scope:'original-full-data',chartType:chart.chartType,unit:chart.unit,order:chart.x.order,...(chart.x.kind==='time'?{timezone:chart.x.timezone,granularity:chart.x.granularity}:{}),rows:rows.length,firstRow:endpoint(rows[0]),lastRow:endpoint(rows.at(-1)),series:chart.series.map(series=>{
  const values=rows.map(row=>row.values[series.id]);const stats=numericStats(values);const first=values[0]??null,last=values.at(-1)??null;
  return {id:series.id,valid:stats.n,missing:stats.missing,mean:stats.mean,minimum:stats.min,maximum:stats.max,firstValue:first,lastValue:last,netChange:first===null||last===null?null:finiteOrNull(last-first),adjacentValidDecreases:values.filter((value,i)=>i>0&&value!==null&&values[i-1]!==null&&value<values[i-1]!).length};
 })};
}
