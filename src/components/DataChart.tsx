import {useEffect,useMemo,useRef,useState} from 'react';
import * as echarts from 'echarts/core';
import {LineChart,BarChart} from 'echarts/charts';
import {GridComponent,TooltipComponent,LegendComponent} from 'echarts/components';
import {SVGRenderer} from 'echarts/renderers';
import type {Chart} from '../protocol';
import {histogram,numericStats,sortedRows} from '../math';
echarts.use([LineChart,BarChart,GridComponent,TooltipComponent,LegendComponent,SVGRenderer]);
function Plot({option}:{option:echarts.EChartsCoreOption}){
 const div=useRef<HTMLDivElement>(null);
 useEffect(()=>{if(!div.current)return;const c=echarts.init(div.current,undefined,{renderer:'svg'});c.setOption(option);const o=new ResizeObserver(()=>c.resize());o.observe(div.current);return()=>{o.disconnect();c.dispose();};},[option]);
 return <div ref={div} className="plot" role="img" aria-label="Numeric chart; equivalent values are available in the data table below."/>;
}
function Table({headers,rows}:{headers:string[];rows:(string|number|null)[][]}){
 const [page,setPage]=useState(0);const safePage=Math.min(page,Math.max(0,Math.ceil(rows.length/40)-1));
 return <><div role="region" aria-label="Source data table" className="table-wrap" tabIndex={0}><table><thead><tr>{headers.map((h,i)=><th key={i} scope="col">{h}</th>)}</tr></thead><tbody>{rows.slice(safePage*40,safePage*40+40).map((r,i)=><tr key={i}>{r.map((v,j)=><td key={j}>{v===null?'Missing':String(v)}</td>)}</tr>)}</tbody></table></div>{rows.length>40?<div className="toolbar"><button disabled={!safePage} onClick={()=>setPage(safePage-1)}>Previous rows</button><span>{safePage+1}/{Math.ceil(rows.length/40)}</span><button disabled={(safePage+1)*40>=rows.length} onClick={()=>setPage(safePage+1)}>Next rows</button></div>:null}<p className="meta">{rows.length} table rows. Missing is distinct from zero.</p></>;
}
export function DataChart({data:p}:{data:Chart}){
 const defs=p.chartType==='histogram'?p.source.groups:p.series;const total=p.chartType==='histogram'?p.source.boundaries.length-1:p.rows.length;
 const [enabled,setEnabled]=useState(()=>defs.map(s=>s.id));const [from,setFrom]=useState(0),[to,setTo]=useState(Math.max(0,total-1));const [mode,setMode]=useState('filtered');
 const allRows=useMemo(()=>p.chartType==='histogram'?[]:sortedRows(p),[p]);
 const bins=useMemo(()=>p.chartType==='histogram'?histogram(p.source):[],[p]);
 const chosen=defs.filter(s=>enabled.includes(s.id));const rows=allRows.slice(from,to+1);
 const binLabels=p.chartType==='histogram'?p.source.boundaries.slice(0,-1).map((b,i)=>`[${b}, ${p.source.boundaries[i+1]}${i===total-1?']':')'}`):[];
 const labels=p.chartType==='histogram'?binLabels.slice(from,to+1):rows.map(r=>p.x.kind==='time'?new Intl.DateTimeFormat('en-GB',{timeZone:p.x.timezone,month:'short',day:'numeric',hour:'2-digit',minute:'2-digit',hour12:false}).format(new Date(r.x)):r.x);
 const selectedBins=bins.filter(g=>enabled.includes(g.id)).map(g=>({...g,selected:g.counts.slice(from,to+1),selectedN:g.counts.slice(from,to+1).reduce((a,c)=>a+c,0)}));
 const series=p.chartType==='histogram'?selectedBins.map(g=>({name:g.label,type:'bar',barCategoryGap:'0%',barGap:'0%',data:p.display==='count'?g.selected:g.selected.map(c=>g.selectedN?c/g.selectedN:null)})):chosen.map((s,index)=>({name:s.label,symbol:['circle','rect','triangle','diamond'][index%4],lineStyle:{type:['solid','dashed','dotted'][index%3]},type:p.chartType,data:rows.map(r=>r.values[s.id]),connectNulls:false,symbolSize:7,showSymbol:true}));
 const option=useMemo<echarts.EChartsCoreOption>(()=>({animation:false,aria:{enabled:true},grid:{left:54,right:16,top:42,bottom:76,containLabel:false},legend:{show:true,selectedMode:false,type:'scroll',textStyle:{fontSize:11}},tooltip:{trigger:'axis',renderMode:'richText',confine:true},xAxis:{type:'category',data:labels,axisLabel:{rotate:total>5?25:0,fontSize:10,hideOverlap:true}},yAxis:{type:'value',name:p.chartType==='histogram'?(p.display==='count'?'count':'proportion'):p.unit,axisLabel:{fontSize:10}},series}),[p,JSON.stringify(labels),JSON.stringify(series)]);
 let headers:string[],tableRows:(string|number|null)[][];
 if(p.chartType==='histogram'){
  const visible=mode==='all'?bins:selectedBins;
  if(mode==='all'&&p.source.mode==='observations'){headers=['Group',`Raw observation (${p.unit})`];tableRows=p.source.groups.flatMap(g=>g.observations.map(v=>[g.label,v]));}
  else {const indices=binLabels.map((_,i)=>i).filter(i=>mode==='all'||i>=from&&i<=to);headers=['Bin',...visible.map(g=>g.label)];tableRows=indices.map(i=>[binLabels[i],...visible.map(g=>p.display==='count'?g.counts[i]:('selectedN'in g?(typeof g.selectedN==='number'&&g.selectedN?g.counts[i]/g.selectedN:null):(g.n?g.counts[i]/g.n:null)))]);}
 }else{const tableDefs=mode==='all'?defs:chosen;headers=[`x (${p.x.kind==='time'?`${p.x.timezone}, ${p.x.granularity}`:'category'})`,...tableDefs.map(s=>`${s.label} (${p.unit})`)];tableRows=(mode==='all'?allRows:rows).map(r=>[r.x,...tableDefs.map(s=>r.values[s.id])]);}
 const noData=chosen.length===0||total===0;
 return <section className="explorer chart" aria-label={p.title}><h3>{p.title}</h3><fieldset><legend>Visible series — chart and filtered table</legend>{defs.map(s=><label key={s.id}><input type="checkbox" checked={enabled.includes(s.id)} onChange={e=>setEnabled(v=>e.target.checked?[...v,s.id]:v.filter(x=>x!==s.id))}/>{s.label}</label>)}</fieldset>
  {total>0?<div className="toolbar range"><label>From index <input type="number" aria-label="From index" min={0} max={total-1} value={from} onChange={e=>{const n=e.target.valueAsNumber;if(Number.isInteger(n))setFrom(Math.max(0,Math.min(n,total-1)));}}/></label><label>To index <input type="number" aria-label="To index" min={0} max={total-1} value={to} onChange={e=>{const n=e.target.valueAsNumber;if(Number.isInteger(n))setTo(Math.max(0,Math.min(n,total-1)));}}/></label><button onClick={()=>{setFrom(0);setTo(Math.max(0,total-1));setEnabled(defs.map(s=>s.id));}}>Reset range & series</button></div>:null}
  <p className="meta">Range {from}–{to} of {total} {p.chartType==='histogram'?'bins':`rows; sort ${p.x.order}${p.x.kind==='time'?`; ${p.x.timezone}, ${p.x.granularity}; exact timestamps in table`:''}`}.</p>
  {noData||from>to?<p role="status">No data in the current selection.</p>:<Plot option={option}/>}
  <div aria-live="polite" className="stats">{p.chartType==='histogram'?selectedBins.map(g=><p key={g.id}>{g.label}: {g.selectedN} valid selected observations / {g.n} full valid; {g.missing} missing in full group (cannot assign missing observations to a bin).{p.display==='proportion'?` Proportion = bin count / ${g.selectedN} selected valid observations.`:''}</p>):chosen.map(s=>{const n=numericStats(rows.map(r=>r.values[s.id]));return <p key={s.id}>{s.label}: n={n.n}, missing={n.missing}; mean={n.mean===null?'unknown':n.mean.toLocaleString('en',{maximumFractionDigits:4})} {p.unit}</p>;})}</div>
  {p.chartType==='histogram'?<p className="meta">Shared bins: [lower, upper), final bin includes its upper boundary. {p.display==='count'?'Height = observation count.':'Each group uses its own selected valid n; missing values excluded.'} {p.source.mode==='prebinned'?'Source is explicitly pre-aggregated; raw observations are unavailable.':'Source is raw observations.'}</p>:null}
  {p.fullDataExplanation?<details><summary>Explanation based on original full data</summary><p>{p.fullDataExplanation}</p><p className="meta">This explanation is not recomputed after filtering.</p></details>:null}
  <label>Table scope <select aria-label="Table scope" value={mode} onChange={e=>setMode(e.target.value)}><option value="filtered">{p.chartType==='histogram'?'Derived bins · filtered':'Source rows · filtered'}</option><option value="all">{p.chartType==='histogram'&&p.source.mode==='prebinned'?'Pre-aggregated bins · all':'Source data · all'}</option></select></label><Table headers={headers} rows={tableRows}/>
 </section>;
}
