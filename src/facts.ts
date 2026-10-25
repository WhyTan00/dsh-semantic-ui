import type {Chart,Decision,Architecture} from './protocol';
import{decide,histogram,numericStats,sortedRows}from'./math';
const finiteOrNull=(value:number)=>Number.isFinite(value)?value:null;
/** Declared policy evaluation is evidence about the policy, not its truth. */
export function decisionFacts(decision:Decision,strictPolicy=false){
 const inputs=Object.fromEntries(decision.inputs.map(input=>[input.id,input.initial]));
 const result=decide(decision,inputs,strictPolicy);
 return {scope:'declared-policy-under-original-conditions',status:result.status,strictPolicy,inputEffects:result.inputEffects,unusedInputIds:result.unusedInputIds,requiresPolicyReview:result.requiresPolicyReview,preferenceMode:result.preferenceMode,eligibilityOnly:true,eligibilityAssessed:!!decision.requirements?.length||decision.constraints.length>0,eligibleOptionIds:result.eligibleOptionIds,excludedOptionIds:result.excludedOptionIds,unknownFeasibilityIds:result.unknownFeasibilityIds,requirements:result.requirements,unknownComparisonCells:result.unknownComparisonCells,proposalWithMissingFacts:result.proposalWithMissingFacts,resultBasis:result.status==='matched'?(result.triggered.some(rule=>rule.origin==='model-judgment')?'proposed-policy':'declared-given-policy'):null,sourceFactsVerified:false,recommendedOptionIds:result.recommendations,matchedRuleIds:result.triggered.map(rule=>rule.id),pendingRuleIds:result.unresolved.map(rule=>rule.id),missingInputs:result.missingInputs,activeConstraintIds:result.constraints.filter(c=>c.match===true).map(c=>c.constraint.id),unknownConstraintIds:result.constraints.filter(c=>c.match==='unknown').map(c=>c.constraint.id),declaredOriginCounts:{given:decision.rules.filter(rule=>rule.origin==='given').length,modelJudgment:decision.rules.filter(rule=>rule.origin==='model-judgment').length},boundary:'Evaluates supplied rules and initial conditions only; does not independently verify their origin, facts or suitability. Insufficient conditions do not establish a winner.'};
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
  const zeroMean=stats.sum===null||!values.length?null:finiteOrNull(stats.sum/values.length),difference=stats.mean===null||zeroMean===null?null:finiteOrNull(zeroMean-stats.mean);
  return {id:series.id,valid:stats.n,missing:stats.missing,mean:stats.mean,zeroFillIllustration:{assumption:'Replace only declared nulls with zero; hypothetical, not observed data or an estimate of the full population.',count:values.length,mean:zeroMean,differenceFromObservedMean:difference,directionRelativeToObservedMean:difference===null?'unknown':difference===0?'same':difference<0?'lower':'higher',completeDataMeanKnown:stats.missing===0&&stats.mean!==null},minimum:stats.min,maximum:stats.max,firstValue:first,lastValue:last,netChange:first===null||last===null?null:finiteOrNull(last-first),adjacentValidDecreases:values.filter((value,i)=>i>0&&value!==null&&values[i-1]!==null&&value<values[i-1]!).length};
 })};
}

/** Bounded computed topology, not proof of causality or the supplied descriptions. */
export function graphFacts(p:Architecture){
 const directed=p.edges.filter(e=>e.directed),shared=p.nodes.map(n=>({nodeId:n.id,sourceNodeIds:[...new Set(directed.filter(e=>e.target===n.id&&e.source!==n.id).map(e=>e.source))]})).filter(n=>n.sourceNodeIds.length>1);
 const pairs=p.scenarios.flatMap((a,i)=>p.scenarios.slice(i+1).map(b=>({scenarioIds:[a.id,b.id],sharedNodeIds:[...new Set(a.nodeIds.filter(id=>b.nodeIds.includes(id)))]}))).filter(x=>x.sharedNodeIds.length);
 return {scope:'declared-graph-only',sourceFactsVerified:false,nodeCount:p.nodes.length,edgeCount:p.edges.length,directedEdgeCount:directed.length,directedEdges:directed.slice(0,24).map(({id,source,target})=>({id,source,target})),directedEdgesOmitted:Math.max(0,directed.length-24),sharedTargets:shared.slice(0,12).map(s=>({...s,sourceNodeIds:s.sourceNodeIds.slice(0,12),sourcesOmitted:Math.max(0,s.sourceNodeIds.length-12)})),sharedTargetsOmitted:Math.max(0,shared.length-12),scenarioIntersections:pairs.slice(0,12).map(s=>({...s,sharedNodeIds:s.sharedNodeIds.slice(0,12),nodesOmitted:Math.max(0,s.sharedNodeIds.length-12)})),scenarioIntersectionsOmitted:Math.max(0,pairs.length-12),boundary:'Only supplied edges and paths. Missing edges do not prove forbidden access, unique ownership or fault independence. An edge does not define rollback, retries or failure propagation. Never invent a reverse route.'};
}
