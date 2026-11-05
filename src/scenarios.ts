import {z} from 'zod';
import type {Decision} from './protocol';
import {decide,type InputValues} from './math';

const selections=z.array(z.string().max(80)).max(12).refine(ids=>new Set(ids).size===ids.length);
export const decisionSnapshotSchema=z.strictObject({
 values:z.record(z.string().max(80),z.union([z.number().finite(),z.boolean(),z.string().max(80),z.null()])).refine(v=>Object.keys(v).length<=12),
 dimensions:selections,exploreProposals:z.boolean(),
});
export const scenarioComparisonSchema=z.strictObject({version:z.literal(1),a:decisionSnapshotSchema,viewing:z.enum(['a','b'])});
export type DecisionSnapshot=z.infer<typeof decisionSnapshotSchema>;
export type ScenarioComparison=z.infer<typeof scenarioComparisonSchema>;
export function assertDecisionSnapshot(p:Decision,snapshot:DecisionSnapshot){
 decisionSnapshotSchema.parse(snapshot);
 if(Object.keys(snapshot.values).length!==p.inputs.length||!p.inputs.every(i=>Object.hasOwn(snapshot.values,i.id))||!snapshot.dimensions.every(id=>p.dimensions.some(d=>d.id===id)))throw Error('SCENARIO_SELECTION');
 for(const input of p.inputs){
  const value=snapshot.values[input.id];
  if(value!==null&&(input.type==='number'?typeof value!=='number':input.type==='boolean'?typeof value!=='boolean':typeof value!=='string'||!input.choices?.includes(value)))throw Error('SCENARIO_VALUE');
 }
}
/** A captures applied values and display/policy selections, never an unapplied draft or a source claim. */
export function captureDecision(p:Decision,values:InputValues,dimensions:string[],exploreProposals:boolean):DecisionSnapshot{
 const snapshot={values:structuredClone(values),dimensions:[...dimensions],exploreProposals};assertDecisionSnapshot(p,snapshot);return snapshot;
}
const sorted=(ids:string[])=>[...ids].sort();
const requirementKey=(r:{requirementId:string;optionId:string})=>JSON.stringify([r.requirementId,r.optionId]);
function outcome(result:ReturnType<typeof decide>){
 return {status:result.status,recommendations:sorted(result.recommendations),eligible:sorted(result.eligibleOptionIds),excluded:sorted(result.excludedOptionIds),unknown:sorted(result.unknownFeasibilityIds),missing:sorted(result.missingInputs.map(i=>i.id)),triggered:sorted(result.triggered.map(r=>r.id)),unresolved:sorted(result.unresolved.map(r=>r.id)),requirements:result.requirements.map(r=>[requirementKey(r),r.status]),constraints:result.constraints.map(r=>[r.constraint.id,r.match])};
}
export function compareDecisionScenarios(p:Decision,a:DecisionSnapshot,b:DecisionSnapshot,strictPolicy:boolean){
 assertDecisionSnapshot(p,a);assertDecisionSnapshot(p,b);
 const left=decide(p,a.values,strictPolicy,a.exploreProposals),right=decide(p,b.values,strictPolicy,b.exploreProposals),before=new Map(left.requirements.map(r=>[requirementKey(r),r]));
 return {a:left,b:right,conditions:p.inputs.map(input=>({id:input.id,source:input.initial,a:a.values[input.id],b:b.values[input.id],changed:a.values[input.id]!==b.values[input.id],effect:left.inputEffects.find(e=>e.inputId===input.id)!.scope})),
  outcomeChanged:JSON.stringify(outcome(left))!==JSON.stringify(outcome(right)),dimensionsChanged:JSON.stringify(sorted(a.dimensions))!==JSON.stringify(sorted(b.dimensions)),policySelectionChanged:a.exploreProposals!==b.exploreProposals,
  requirementChanges:right.requirements.filter(r=>before.get(requirementKey(r))!.status!==r.status).map(r=>({before:before.get(requirementKey(r))!,after:r})),
  constraintChanges:right.constraints.filter(r=>left.constraints.find(old=>old.constraint.id===r.constraint.id)!.match!==r.match).map(r=>({before:left.constraints.find(old=>old.constraint.id===r.constraint.id)!,after:r})),
 };
}
