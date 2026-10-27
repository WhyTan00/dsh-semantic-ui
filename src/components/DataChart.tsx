import{useI18n}from'../i18n';
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
 const {t,locale}=useI18n();
 const [page,setPage]=useState(0);const safePage=Math.min(page,Math.max(0,Math.ceil(rows.length/40)-1));
 return <><div role="region" aria-label={t("Source data table")} className="table-wrap" tabIndex={0}><table><caption>{t(scope)} · {rows.length} {t("rows")}</caption><thead><tr>{headers.map((h,i)=><th key={i} scope="col">{h}</th>)}</tr></thead><tbody>{rows.slice(safePage*40,safePage*40+40).map((r,i)=><tr key={i}>{r.map((v,j)=><td key={j}>{v===null?t("Missing"):String(v)}</td>)}</tr>)}</tbody></table></div>{rows.length>40?<div className="toolbar"><button disabled={!safePage} onClick={()=>setPage(safePage-1)}>{t("Previous rows")}</button><span aria-live="polite">{t("Page")} {safePage+1}/{Math.ceil(rows.length/40)}</span><button disabled={(safePage+1)*40>=rows.length} onClick={()=>setPage(safePage+1)}>{t("Next rows")}</button></div>:null}<p className="meta">{rows.length} {t("table rows. Missing is distinct from zero. Exact values and full labels are retained here.")}</p></>;
}
export function DataChart({data:p}:{data:Chart}){
 const {t,locale}=useI18n();
 const {tokens}=useAppearance();
 const computedNumber=(value:number|null)=>value===null?t('unknown'):String(value);
 const defs=p.chartType==='histogram'?p.source.groups:p.series,total=p.chartType==='histogram'?p.source.boundaries.length-1:p.rows.length;
 const [enabled,setEnabled]=useState(()=>defs.map(s=>s.id)),[from,setFrom]=useState(0),[to,setTo]=useState(Math.max(0,total-1));
 const [scope,setScope]=useState<ChartSelection['scope']>('filtered'),[downloaded,setDownloaded]=useState(false);
 const view=useMemo(()=>chartView(p,{enabled,from,to,scope},tokens,locale),[p,enabled,from,to,scope,tokens,locale]);
 function download(){const url=URL.createObjectURL(new Blob([JSON.stringify(view.download,null,2)+'\n'],{type:'application/json'}));const link=document.createElement('a');link.href=url;link.download='semantic-table.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);setDownloaded(true);}
 return <section className="explorer chart" aria-label={p.title}><h3>{p.title}</h3><fieldset><legend>{t("Visible series — chart and filtered table")}</legend>{defs.map(s=><label key={s.id}><input type="checkbox" checked={enabled.includes(s.id)} onChange={e=>setEnabled(v=>e.target.checked?[...v,s.id]:v.filter(x=>x!==s.id))}/>{s.label}</label>)}</fieldset>
  {total>0?<div className="toolbar range"><label>{t("From index")} <input type="number" aria-label={t("From index")} min={0} max={total-1} value={from} onChange={e=>{const n=e.target.valueAsNumber;if(Number.isInteger(n))setFrom(Math.max(0,Math.min(n,total-1)));}}/></label><label>{t("To index")} <input type="number" aria-label={t("To index")} min={0} max={total-1} value={to} onChange={e=>{const n=e.target.valueAsNumber;if(Number.isInteger(n))setTo(Math.max(0,Math.min(n,total-1)));}}/></label><button onClick={()=>{setFrom(0);setTo(Math.max(0,total-1));setEnabled(defs.map(s=>s.id));}}>{t("Reset range & series")}</button></div>:null}
  <p className="meta">{t("Range")} {from}–{to} {t("of")} {total} {p.chartType==='histogram'?t('bins'):locale==='zh-CN'?`行；按${t(p.x.order)}${p.x.kind==='time'?`；${p.x.timezone}，粒度${p.x.granularity}；横向距离表示经过时间，精确时间见表格`:''}`:`rows; sort ${p.x.order}${p.x.kind==='time'?`; ${p.x.timezone}, ${p.x.granularity}; horizontal distance = elapsed time; exact timestamps in table`:''}`}.</p>
  <p className="meta">{t("Measure:")} {p.chartType==='histogram'?(p.display==='count'?t("observation count"):t("proportion of valid observations")):p.unit}.</p>
  {view.emptyReason?<p role="status">{view.emptyReason}</p>:<Plot option={view.option} description={view.description} horizontal={view.horizontal}/>}
  <div aria-live="polite" className="stats">{p.chartType==='histogram'?view.selectedBins.map(g=><p key={g.id}>{g.label}: {g.selectedN} {t("valid selected observations /")} {g.n} {t("full valid;")} {g.missing} {t("missing in full group (cannot assign missing observations to a bin).")}{p.display==='proportion'?` Proportion = bin count / ${g.selectedN} selected valid observations.`:''}</p>):view.visibleStats.map(s=><p key={s.id}>{s.label}{t(": n=")}{s.n}{t(", missing=")}{s.missing}{t("; mean=")}{s.mean===null?t('unknown'):s.mean.toLocaleString(locale,{maximumFractionDigits:4})} {p.unit}</p>)}</div>
  {p.chartType==='histogram'?<p className="meta">{t("Shared bins: [lower, upper), final bin includes its upper boundary.")} {p.display==='count'?t("Height = observation count."):t("Each group uses its own selected valid n; missing values excluded.")} {p.source.mode==='prebinned'?t("Source is explicitly pre-aggregated; raw observations are unavailable."):t("Source is raw observations.")}</p>:null}
  <p className="meta">{t("Series keep their color and pattern when filtered. Axis labels may be abbreviated; use the table for exact labels and values.")}</p>
  {p.fullDataExplanation?<details><summary>{t("Model explanation — original full data (unverified)")}</summary><p>{p.fullDataExplanation}</p><p className="meta">{t("Model-authored text, not independently verified by the calculations. It stays fixed after filtering and refers to the original full data.")}</p></details>:null}
  <div className="toolbar"><label>{t("Table scope")} <select aria-label={t("Table scope")} value={scope} onChange={e=>{setScope(e.target.value as ChartSelection['scope']);setDownloaded(false);}}><option value="filtered">{p.chartType==='histogram'?t("Derived bins · filtered"):t("Source rows · filtered")}</option><option value="all">{p.chartType==='histogram'&&p.source.mode==='prebinned'?t("Pre-aggregated bins · all"):t("Source data · all")}</option></select></label><button onClick={download}>{t("Download this table")}</button></div>
  {view.zeroFillComparison?<details><summary>{t("Computed missing-value comparison")}</summary>
   <p className="meta">{t("Scope:")} {t(view.zeroFillComparison.scope)} · {view.zeroFillComparison.rowCount} {t("rows. This check follows the table scope; the plotted range may differ.")}</p>
   <p>{t("Hypothesis: replace only the declared missing values with zero in this scope. Source data, chart and download stay unchanged. This is not an estimate of the unknown complete data.")}</p>
   {view.zeroFillComparison.series.length?<div className="table-wrap" role="region" aria-label={t("Computed missing-value comparison")} tabIndex={0}><table><caption>{t("Observed means and sums versus an explicit zero-fill hypothesis ·")} {t(view.zeroFillComparison.scope)}</caption><thead><tr><th scope="col">{t("Series")}</th><th scope="col">{t("Mean and sum comparison")}</th><th scope="col">{t("Change vs observed")}</th></tr></thead><tbody>{view.zeroFillComparison.series.map(s=><tr key={s.id}><th scope="row">{s.label}</th><td><p>{t("Observed: n=")}{s.valid}{t(", missing=")}{s.missing}{t("; mean=")}{computedNumber(s.mean)} {p.unit}{t("; subtotal=")}{computedNumber(s.sum)} {p.unit}</p><p>{t("Hypothesis: count=")}{s.zeroFillIllustration.count}{t("; mean=")}{computedNumber(s.zeroFillIllustration.mean)} {p.unit}{t("; sum=")}{computedNumber(s.zeroFillIllustration.sum)} {p.unit}</p></td><td><p>{t("Mean:")} {t(s.zeroFillIllustration.directionRelativeToObservedMean)}{t("; difference=")}{computedNumber(s.zeroFillIllustration.differenceFromObservedMean)} {p.unit}</p><p>{t("Sum:")} {t(s.zeroFillIllustration.directionRelativeToObservedSum)}{t("; difference=")}{computedNumber(s.zeroFillIllustration.differenceFromObservedSum)} {p.unit}</p></td></tr>)}</tbody></table></div>:<p role="status">{t("No series in this table scope.")}</p>}
   <p className="meta">{t("Higher, lower or same compares with observed readings only, not with unknown complete-data means or sums. Coincidentally equal statistics do not resolve missing readings. Empty data, no observed values or numeric overflow leave calculations unknown. Missing is never silently changed to an observation.")}</p>
  </details>:null}
  {downloaded?<p className="meta" role="status">{t("Downloaded this table scope as JSON, including units, selection and missing values.")}</p>:null}
  <Table key={`${scope}:${from}:${to}:${enabled.join(',')}`} headers={view.headers} rows={view.tableRows} scope={view.tableScope}/>
 </section>;
}
