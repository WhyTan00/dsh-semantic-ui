import {useEffect,useMemo,useRef,useState} from 'react';
import * as echarts from 'echarts/core';
import {LineChart,BarChart} from 'echarts/charts';
import {GridComponent,TooltipComponent,LegendComponent,AriaComponent} from 'echarts/components';
import {SVGRenderer} from 'echarts/renderers';
import {useAppearance} from '../appearance';
import type {Chart} from '../protocol';
import {chartView,type ChartSelection} from '../chart-view';
echarts.use([LineChart,BarChart,GridComponent,TooltipComponent,LegendComponent,AriaComponent,SVGRenderer]);

function Plot({option,description,horizontal}:{option:echarts.EChartsCoreOption;description:string;horizontal:boolean}){
 const div=useRef<HTMLDivElement>(null),instance=useRef<echarts.EChartsType|null>(null);
 useEffect(()=>{if(!div.current)return;const c=echarts.init(div.current,undefined,{renderer:'svg'});instance.current=c;const observer=new ResizeObserver(()=>c.resize());observer.observe(div.current);return()=>{observer.disconnect();c.dispose();instance.current=null;};},[]);
 useEffect(()=>{instance.current?.setOption(option,{notMerge:true});},[option]);
 return <div ref={div} className="plot" role="img" aria-label={description} data-orientation={horizontal?'horizontal':'vertical'}/>;
}
function Table({headers,rows,scope}:{headers:string[];rows:(string|number|null)[][];scope:string}){
 const [page,setPage]=useState(0);const safePage=Math.min(page,Math.max(0,Math.ceil(rows.length/40)-1));
 return <><div role="region" aria-label="Source data table" className="table-wrap" tabIndex={0}><table><caption>{scope} · {rows.length} rows</caption><thead><tr>{headers.map((h,i)=><th key={i} scope="col">{h}</th>)}</tr></thead><tbody>{rows.slice(safePage*40,safePage*40+40).map((r,i)=><tr key={i}>{r.map((v,j)=><td key={j}>{v===null?'Missing':String(v)}</td>)}</tr>)}</tbody></table></div>{rows.length>40?<div className="toolbar"><button disabled={!safePage} onClick={()=>setPage(safePage-1)}>Previous rows</button><span aria-live="polite">Page {safePage+1}/{Math.ceil(rows.length/40)}</span><button disabled={(safePage+1)*40>=rows.length} onClick={()=>setPage(safePage+1)}>Next rows</button></div>:null}<p className="meta">{rows.length} table rows. Missing is distinct from zero. Exact values and full labels are retained here.</p></>;
}
export function DataChart({data:p}:{data:Chart}){
 const {tokens}=useAppearance();
 const defs=p.chartType==='histogram'?p.source.groups:p.series,total=p.chartType==='histogram'?p.source.boundaries.length-1:p.rows.length;
 const [enabled,setEnabled]=useState(()=>defs.map(s=>s.id)),[from,setFrom]=useState(0),[to,setTo]=useState(Math.max(0,total-1));
 const [scope,setScope]=useState<ChartSelection['scope']>('filtered'),[downloaded,setDownloaded]=useState(false);
 const view=useMemo(()=>chartView(p,{enabled,from,to,scope},tokens),[p,enabled,from,to,scope,tokens]);
 function download(){const url=URL.createObjectURL(new Blob([JSON.stringify(view.download,null,2)+'\n'],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='semantic-table.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setDownloaded(true);}
 return <section className="explorer chart" aria-label={p.title}><h3>{p.title}</h3><fieldset><legend>Visible series — chart and filtered table</legend>{defs.map(s=><label key={s.id}><input type="checkbox" checked={enabled.includes(s.id)} onChange={e=>setEnabled(v=>e.target.checked?[...v,s.id]:v.filter(x=>x!==s.id))}/>{s.label}</label>)}</fieldset>
  {total>0?<div className="toolbar range"><label>From index <input type="number" aria-label="From index" min={0} max={total-1} value={from} onChange={e=>{const n=e.target.valueAsNumber;if(Number.isInteger(n))setFrom(Math.max(0,Math.min(n,total-1)));}}/></label><label>To index <input type="number" aria-label="To index" min={0} max={total-1} value={to} onChange={e=>{const n=e.target.valueAsNumber;if(Number.isInteger(n))setTo(Math.max(0,Math.min(n,total-1)));}}/></label><button onClick={()=>{setFrom(0);setTo(Math.max(0,total-1));setEnabled(defs.map(s=>s.id));}}>Reset range & series</button></div>:null}
  <p className="meta">Range {from}–{to} of {total} {p.chartType==='histogram'?'bins':`rows; sort ${p.x.order}${p.x.kind==='time'?`; ${p.x.timezone}, ${p.x.granularity}; horizontal distance = elapsed time; exact timestamps in table`:''}`}.</p>
  <p className="meta">Measure: {p.chartType==='histogram'?(p.display==='count'?'observation count':'proportion of valid observations'):p.unit}.</p>
  {view.emptyReason?<p role="status">{view.emptyReason}</p>:<Plot option={view.option} description={view.description} horizontal={view.horizontal}/>}
  <div aria-live="polite" className="stats">{p.chartType==='histogram'?view.selectedBins.map(g=><p key={g.id}>{g.label}: {g.selectedN} valid selected observations / {g.n} full valid; {g.missing} missing in full group (cannot assign missing observations to a bin).{p.display==='proportion'?` Proportion = bin count / ${g.selectedN} selected valid observations.`:''}</p>):view.visibleStats.map(s=><p key={s.id}>{s.label}: n={s.n}, missing={s.missing}; mean={s.mean===null?'unknown':s.mean.toLocaleString('en',{maximumFractionDigits:4})} {p.unit}</p>)}</div>
  {p.chartType==='histogram'?<p className="meta">Shared bins: [lower, upper), final bin includes its upper boundary. {p.display==='count'?'Height = observation count.':'Each group uses its own selected valid n; missing values excluded.'} {p.source.mode==='prebinned'?'Source is explicitly pre-aggregated; raw observations are unavailable.':'Source is raw observations.'}</p>:null}
  <p className="meta">Series keep their color and pattern when filtered. Axis labels may be abbreviated; use the table for exact labels and values.</p>
  {p.fullDataExplanation?<details><summary>Explanation based on original full data</summary><p>{p.fullDataExplanation}</p><p className="meta">This explanation is not recomputed after filtering.</p></details>:null}
  <div className="toolbar"><label>Table scope <select aria-label="Table scope" value={scope} onChange={e=>{setScope(e.target.value as ChartSelection['scope']);setDownloaded(false);}}><option value="filtered">{p.chartType==='histogram'?'Derived bins · filtered':'Source rows · filtered'}</option><option value="all">{p.chartType==='histogram'&&p.source.mode==='prebinned'?'Pre-aggregated bins · all':'Source data · all'}</option></select></label><button onClick={download}>Download this table</button></div>
  {downloaded?<p className="meta" role="status">Downloaded this table scope as JSON, including units, selection and missing values.</p>:null}
  <Table key={`${scope}:${from}:${to}:${enabled.join(',')}`} headers={view.headers} rows={view.tableRows} scope={view.tableScope}/>
 </section>;
}
