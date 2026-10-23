import {useState} from 'react';
import type {Decision} from '../protocol';
import {decide,type InputValues} from '../math';
import {Evidence} from './ArchitectureExplorer';
export function DecisionExplorer({data:p}:{data:Decision}){
 const [values,setValues]=useState<InputValues>(()=>Object.fromEntries(p.inputs.map(i=>[i.id,i.initial])));
 const [dimensions,setDimensions]=useState(()=>p.dimensions.map(d=>d.id));
 const result=decide(p,values);const changed=p.inputs.filter(i=>values[i.id]!==i.initial);
 return <section className="explorer decision" aria-label={p.title}><h3>{p.title}</h3>
  <fieldset><legend>Focus dimensions — display only</legend>{p.dimensions.map(d=><label key={d.id}><input type="checkbox" checked={dimensions.includes(d.id)} onChange={e=>setDimensions(old=>e.target.checked?[...old,d.id]:old.filter(x=>x!==d.id))}/>{d.label}</label>)}</fieldset>
  <div className="table-wrap" tabIndex={0} role="region" aria-label="Aligned options"><table><thead><tr><th scope="col">Dimension</th>{p.options.map(o=><th key={o.id} scope="col">{o.label}</th>)}</tr></thead><tbody>{p.dimensions.filter(d=>dimensions.includes(d.id)).map(d=><tr key={d.id}><th scope="row">{d.label}</th>{p.options.map(o=><td key={o.id}>{o.values[d.id]??<em>Unknown</em>}</td>)}</tr>)}</tbody></table></div>
  <div className="option-details">{p.options.map(o=><details key={o.id}><summary>{o.label} — conditions & evidence</summary><p>{o.suitableWhen}</p><strong>Advantages</strong><ul>{o.advantages.map((v,i)=><li key={i}>{v}</li>)}</ul><strong>Disadvantages</strong><ul>{o.disadvantages.map((v,i)=><li key={i}>{v}</li>)}</ul><Evidence items={o.evidence}/></details>)}</div>
  {p.inputs.length?<fieldset><legend>Local conditions</legend>{p.inputs.map(i=><label key={i.id}>{i.label}{i.unit?` (${i.unit})`:''}{i.type==='boolean'?<select aria-label={i.label} value={values[i.id]===null?'unknown':String(values[i.id])} onChange={e=>setValues(old=>({...old,[i.id]:e.target.value==='unknown'?null:e.target.value==='true'}))}><option value="unknown">Unknown</option><option value="true">Yes</option><option value="false">No</option></select>:i.type==='choice'?<select aria-label={i.label} value={values[i.id]===null?'':String(values[i.id])} onChange={e=>setValues(old=>({...old,[i.id]:e.target.value||null}))}><option value="">Unknown</option>{i.choices?.map(c=><option key={c}>{c}</option>)}</select>:<input aria-label={i.label} type="number" value={values[i.id]===null?'':String(values[i.id])} onChange={e=>{const v=e.target.valueAsNumber;setValues(old=>({...old,[i.id]:Number.isFinite(v)?v:null}));}}/>}</label>)}</fieldset>:null}
  <div className="recommendation" aria-live="polite"><strong>{result.status==='matched'?`Recommendation: ${p.options.filter(o=>result.recommendations.includes(o.id)).map(o=>o.label).join(' / ')}`:result.status==='insufficient'?'Insufficient conditions — recommendation withheld':result.status==='blocked'?'No proposed option satisfies the active constraints':'No matching rule — no winner inferred'}</strong>
   <p className="meta">Local deterministic rules. No model request. Highest priority wins; tied rules combine recommendations.</p>
   <p>{changed.length?`Changed: ${changed.map(i=>`${i.label}: ${String(i.initial??'unknown')} → ${String(values[i.id]??'unknown')}`).join('; ')}`:'Original conditions.'}</p>
   {result.triggered.map(r=><div key={r.id}><p>Rule {r.id} · priority {r.priority} · {r.origin==='given'?'User-given rule':'Model-proposed judgment'}: {r.reason}</p><Evidence items={r.evidence}/></div>)}
   {result.unresolved.map(r=><p key={r.id}>Rule {r.id} needs more input (priority {r.priority}).</p>)}
  </div>
  <details><summary>Hard constraints ({p.constraints.length})</summary>{result.constraints.map(({constraint:c,match})=><div key={c.id}><p>{p.options.find(o=>o.id===c.optionId)?.label}: {c.reason} — {match===true?'excluded':match==='unknown'?'unknown':'not triggered'}</p><Evidence items={c.evidence}/></div>)}</details>
 </section>;
}
