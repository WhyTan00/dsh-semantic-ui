import {useContext,useState} from 'react';
import type {Decision} from '../protocol';
import {InteractionContext} from '../interaction';
import {useI18n} from '../i18n';
import {useAppearance} from '../appearance';
import {compareDecisionScenarios,type DecisionSnapshot,type ScenarioComparison} from '../scenarios';

export function ScenarioComparisonPanel({data:p,comparison,b,onStart,onView,onEnd}:{data:Decision;comparison?:ScenarioComparison;b:DecisionSnapshot;onStart:()=>void;onView:(view:'a'|'b')=>void;onEnd:()=>void}){
 const {t}=useI18n(),{strictPolicy=false}=useAppearance(),context=useContext(InteractionContext);
 const [busy,setBusy]=useState(false),[message,setMessage]=useState('');
 const result=comparison?compareDecisionScenarios(p,comparison.a,b,strictPolicy):undefined;
 const display=(value:unknown)=>value===null?t('Unknown'):typeof value==='boolean'?t(value?'Yes':'No'):String(value);
 const names=(ids:string[])=>p.options.filter(o=>ids.includes(o.id)).map(o=>o.label).join(' / ')||t('none');
 const dimensionNames=(ids:string[])=>p.dimensions.filter(d=>ids.includes(d.id)).map(d=>d.label).join(' / ')||t('none');
 const inputName=(id:string)=>{const input=p.inputs.find(i=>i.id===id)!;return input.label+(input.unit?' ('+input.unit+')':'');};
 function card(key:'a'|'b',value:NonNullable<typeof result>['a'],snapshot:DecisionSnapshot){
  return <section className="scenario-card" aria-label={t(key==='a'?'Scenario A':'Scenario B')}><h5>{t(key==='a'?'Scenario A · retained local conditions':'Scenario B · editable local hypotheses')}</h5>
   <p>{t('Meets active requirements:')} {names(value.eligibleOptionIds)}{t('. Excluded:')} {names(value.excludedOptionIds)}{t('. Unknown:')} {names(value.unknownFeasibilityIds)}</p>
   <p>{t('Preference policy status:')} {t(value.status)}{value.recommendations.length?' · '+names(value.recommendations):''}</p>
   <p>{t('Triggered rule IDs:')} {value.triggered.map(r=>r.id).join(' / ')||t('none')}</p>
   <p>{t('Missing conditions:')} {value.missingInputs.map(i=>i.label).join(' / ')||t('none')}</p>
   <p className="meta">{t('Display dimensions:')} {dimensionNames(snapshot.dimensions)}<br/>{t('Local preference exploration:')} {t(snapshot.exploreProposals?'Yes':'No')}</p>
   {value.unknownComparisonCells.length?<details><summary>{t('Unknown comparison cells retained:')} {value.unknownComparisonCells.length}</summary><ul>{value.unknownComparisonCells.map(cell=><li key={JSON.stringify([cell.optionId,cell.dimensionId])}>{p.options.find(o=>o.id===cell.optionId)!.label} / {p.dimensions.find(d=>d.id===cell.dimensionId)!.label}: {t('Unknown')}</li>)}</ul></details>:null}
  </section>;
 }
 return <section className="scenario-panel" aria-label={t('Two local scenarios')}><h4>{t('Compare two local scenarios')}</h4><p className="meta">{t('A retains applied local conditions when comparison starts. B uses your editable local copy and draft. Both use the same deterministic rules; original sources and unknown cells stay separate. Saving is explicit and never calls a model or updates a source.')}</p>
  {!comparison?<button onClick={()=>{onStart();setMessage('');}}>{t('Retain current conditions as A and edit B')}</button>:<>
   <div className="toolbar"><button aria-pressed={comparison.viewing==='a'} onClick={()=>onView('a')}>{t('Restore A (keep B)')}</button><button aria-pressed={comparison.viewing==='b'} onClick={()=>onView('b')}>{t('Return to editing B')}</button><button disabled={busy||!context?.saveScenarios} onClick={()=>void(async()=>{if(busy||!context?.saveScenarios)return;setBusy(true);setMessage('');try{await context.saveScenarios();setMessage('Both scenarios saved as a new result. Reopen from saved results.');}catch{setMessage('Scenarios could not be saved. Previous results are unchanged.');}finally{setBusy(false);}})()}>{t('Save both scenarios in this profile')}</button><button disabled={busy} onClick={()=>{onEnd();setMessage('');}}>{t('End comparison, keep B')}</button></div>
   <p role="status">{t(comparison.viewing==='a'?'Viewing A read-only. B and its draft are retained; return to B to edit.':'Editing B. A remains unchanged.')}</p>
   {result?<><p data-scenario-outcome>{t(result.outcomeChanged?'Computed outcome status differs. Inspect the conditions and checks below.':'Computed outcome status is unchanged. Condition differences may still exist.')}</p>{result.dimensionsChanged?<p className="meta">{t('Display dimension selections differ. They do not change rule calculations.')}</p>:null}{result.policySelectionChanged?<p className="meta">{t('Local preference exploration differs. This is an explicit local setting, not approval or source verification.')}</p>:null}
    <div className="scenario-results">{card('a',result.a,comparison.a)}{card('b',result.b,b)}</div>
    <div className="table-wrap" role="region" aria-label={t('Scenario condition differences')} tabIndex={0}><table><thead><tr><th scope="col">{t('Condition')}</th><th scope="col">{t('Original declaration')}</th><th scope="col">{t('Scenario A')}</th><th scope="col">{t('Scenario B')}</th><th scope="col">{t('Declared dependency scope')}</th></tr></thead><tbody>{result.conditions.map(row=><tr key={row.id} data-condition-changed={row.changed}><th scope="row">{inputName(row.id)} {row.changed?<span>{t('(changed)')}</span>:null}</th><td>{display(row.source)}</td><td>{display(row.a)}</td><td>{display(row.b)}</td><td>{t(row.effect)}</td></tr>)}</tbody></table></div>
    {result.a.requirements.length?<details><summary>{t('Inspect hard requirement checks in A and B')}</summary><div className="table-wrap" role="region" aria-label={t('Scenario requirement checks')} tabIndex={0}><table><thead><tr><th scope="col">{t('Option / input')}</th><th scope="col">{t('Scenario A')}</th><th scope="col">{t('Scenario B')}</th></tr></thead><tbody>{result.a.requirements.map((left,n)=>{const right=result.b.requirements[n];return <tr key={JSON.stringify([left.requirementId,left.optionId])}><th scope="row">{p.options.find(o=>o.id===left.optionId)!.label} / {inputName(left.inputId)}</th>{[left,right].map((check,i)=><td key={i}>{display(check.actual)} {check.relation==='supports'?t('supports required'):check.relation==='requires-availability'?t('requires available'):check.relation==='at-least'?'≥':'≤'} {display(check.needed)} {check.unit} · {t(check.status)}</td>)}</tr>;})}</tbody></table></div></details>:null}
    {p.constraints.length?<details><summary>{t('Inspect exclusion predicates in A and B')}</summary>{result.a.constraints.map((left,n)=>{const right=result.b.constraints[n];return <p key={left.constraint.id}>{p.options.find(o=>o.id===left.constraint.optionId)!.label} / {left.constraint.id}: A {left.match==='unknown'?t('Unknown'):display(left.match)} → B {right.match==='unknown'?t('Unknown'):display(right.match)} · {left.constraint.reason}</p>;})}</details>:null}
    <p className="meta">{t('A is read-only; B conditions and drafts remain independent. Ending comparison keeps B and drops only the unsaved A snapshot. Saved results and templates are unchanged. Unknown is never zero or false, and a changed input need not change an outcome.')}</p>
   </>:null}
  </>}{message?<p role="status">{t(message)}</p>:null}
 </section>;
}
