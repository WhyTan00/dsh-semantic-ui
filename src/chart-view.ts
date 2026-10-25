import type {Chart} from './protocol';
import {histogram,numericStats,sortedRows} from './math';
import {chartFacts} from './facts';
import type {themeTokens} from './theme';

export type ChartSelection={enabled:string[];from:number;to:number;scope:'filtered'|'all'};
type Tokens=ReturnType<typeof themeTokens>;
const symbols=['circle','rect','triangle','diamond','pin','roundRect','arrow','diamond'];

/** Series identity survives filtering. Patterns are application-owned, not model options. */
export function seriesEncoding(index:number,tokens:Tokens,bar:boolean){
  return {
    itemStyle:{color:tokens.colors[index],...(bar?{decal:{symbol:['rect','circle','triangle','diamond'][index%4],symbolSize:1,color:tokens.background,backgroundColor:'rgba(0,0,0,0)',dashArrayX:[1,4],dashArrayY:[2,5+index],rotation:index%2?Math.PI/4:0}}:{})},
    symbol:symbols[index%8],lineStyle:{type:['solid','dashed','dotted'][index%3]},
  };
}

export function axisNumber(value:number){
  if(value===0)return '0';
  if(Math.abs(value)>=1e6||Math.abs(value)<0.001)return value.toExponential(2);
  return new Intl.NumberFormat('en',{maximumSignificantDigits:5}).format(value);
}

/** One data transformation feeds the chart, accessible description, table and download. */
export function chartView(p:Chart,selection:ChartSelection,tokens:Tokens){
  const {enabled,from,to,scope}=selection;
  const defs=(p.chartType==='histogram'?p.source.groups:p.series).map(({id,label})=>({id,label}));
  const chosen=defs.filter(s=>enabled.includes(s.id));
  const allRows=p.chartType==='histogram'?[]:sortedRows(p);
  const rows=from>to?[]:allRows.slice(from,to+1);
  const bins=p.chartType==='histogram'?histogram(p.source):[];
  const total=p.chartType==='histogram'?p.source.boundaries.length-1:allRows.length;
  const binLabels=p.chartType==='histogram'?p.source.boundaries.slice(0,-1).map((b,i)=>`[${b}, ${p.source.boundaries[i+1]}${i===total-1?']':')'}`):[];
  const labels=p.chartType==='histogram'?binLabels.slice(from,to+1):rows.map(r=>r.x);
  const selectedBins=bins.filter(g=>enabled.includes(g.id)).map(g=>{const selected=from>to?[]:g.counts.slice(from,to+1);return {...g,selected,selectedN:selected.reduce((a,c)=>a+c,0)};});
  const visibleStats=p.chartType==='histogram'?[]:chosen.map(s=>({...s,...numericStats(rows.map(r=>r.values[s.id]))}));
  const valid=p.chartType==='histogram'?selectedBins.reduce((n,g)=>n+g.selectedN,0):visibleStats.reduce((n,s)=>n+s.n,0);
  const emptyReason=!chosen.length||!total||from>to?'No data in the current selection.':!valid?'No valid observations in the current selection. Missing values remain missing.':null;
  const temporal=p.chartType!=='histogram'&&p.x.kind==='time';
  const horizontal=p.chartType==='bar'&&p.x.kind==='category'&&(labels.length>6||labels.some(label=>label.length>18));
  const formatter=temporal?new Intl.DateTimeFormat('en-GB',{timeZone:p.x.timezone,year:'numeric',month:'short',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hourCycle:'h23'}):undefined;
  const timeLabel=(value:number)=>formatter!.format(new Date(value));
  const description=`${p.title}. ${p.chartType} chart; unit ${p.unit}. Selected range ${from}–${to}. ${temporal?'Horizontal distances encode elapsed time. ':''}${p.chartType==='histogram'?selectedBins.map(g=>`${g.label}: ${g.selectedN} valid selected observations; ${g.missing} missing in full group, bin unknown.`).join(' '):visibleStats.map(s=>`${s.label}: ${s.n} valid, ${s.missing} missing.`).join(' ')} Equivalent values are available in the source data table.`;
  const series=p.chartType==='histogram'?selectedBins.map(g=>({
    id:g.id,name:g.label,...seriesEncoding(defs.findIndex(d=>d.id===g.id),tokens,true),type:'bar' as const,barCategoryGap:'0%',barGap:'0%',
    data:p.display==='count'?g.selected:g.selected.map(c=>g.selectedN?c/g.selectedN:null),
  })):chosen.map(s=>({
    id:s.id,name:s.label,...seriesEncoding(defs.findIndex(d=>d.id===s.id),tokens,p.chartType==='bar'),type:p.chartType,
    data:rows.map(r=>temporal?[Date.parse(r.x),r.values[s.id]]:r.values[s.id]),connectNulls:false,symbolSize:7,showSymbol:true,
  }));
  const categoryAxis={type:'category' as const,data:labels,axisLine:{lineStyle:{color:tokens.border}},axisLabel:{color:tokens.muted,fontSize:tokens.size-3,hideOverlap:true,width:horizontal?112:80,overflow:'truncate' as const,interval:horizontal?0:'auto' as const}};
  const valueAxis={type:'value' as const,splitNumber:3,splitLine:{lineStyle:{color:tokens.line}},axisLabel:{color:tokens.muted,fontSize:tokens.size-3,hideOverlap:true,formatter:axisNumber}};
  const option={
    animation:false,useUTC:true,textStyle:{color:tokens.text,fontFamily:tokens.font,fontSize:tokens.size},backgroundColor:'transparent',
    aria:{enabled:true,label:{description},decal:{show:true}},
    grid:{left:12,right:24,top:44,bottom:temporal?18:24,containLabel:true},
    legend:{show:true,top:0,left:'center',selectedMode:false,type:'scroll' as const,textStyle:{fontSize:tokens.size-2,color:tokens.text}},
    tooltip:{trigger:'axis' as const,renderMode:'richText' as const,confine:true,backgroundColor:tokens.surface,borderColor:tokens.border,textStyle:{color:tokens.text,fontFamily:tokens.font},
      formatter:(params:unknown)=>{const items=(Array.isArray(params)?params:[params])as {dataIndex:number;seriesName:string;value:number|[number,number|null]|null}[];const i=items[0]?.dataIndex??0;return [labels[i]??'',...items.map(item=>`${item.seriesName}: ${Array.isArray(item.value)?item.value[1]??'Missing':item.value??'Missing'} ${p.chartType==='histogram'?(p.display==='count'?'count':'proportion'):p.unit}`)].join('\n');}},
    xAxis:horizontal?valueAxis:temporal?{type:'time' as const,min:'dataMin',max:'dataMax',splitNumber:3,axisLine:{lineStyle:{color:tokens.border}},axisLabel:{color:tokens.muted,fontSize:tokens.size-3,hideOverlap:true,formatter:(value:number)=>timeLabel(value).replace(', ','\n')},axisPointer:{label:{formatter:(params:{value:number})=>timeLabel(params.value)}}}:categoryAxis,
    yAxis:horizontal?{...categoryAxis,inverse:true}:valueAxis,series,
  };
  let headers:string[],tableRows:(string|number|null)[][];
  if(p.chartType==='histogram'){
    const visible=scope==='all'?bins:selectedBins;
    if(scope==='all'&&p.source.mode==='observations'){headers=['Group',`Raw observation (${p.unit})`];tableRows=p.source.groups.flatMap(g=>g.observations.map(v=>[g.label,v]));}
    else{const indices=binLabels.map((_,i)=>i).filter(i=>scope==='all'||i>=from&&i<=to);headers=['Bin',...visible.map(g=>g.label)];tableRows=indices.map(i=>[binLabels[i],...visible.map(g=>{const n='selectedN'in g&&typeof g.selectedN==='number'?g.selectedN:g.n;return p.display==='count'?g.counts[i]:n?g.counts[i]/n:null;})]);}
  }else{const tableDefs=scope==='all'?defs:chosen;headers=[`x (${p.x.kind==='time'?`${p.x.timezone}, ${p.x.granularity}`:'category'})`,...tableDefs.map(s=>`${s.label} (${p.unit})`)];tableRows=(scope==='all'?allRows:rows).map(r=>[r.x,...tableDefs.map(s=>r.values[s.id])]);}
  const tableScope=p.chartType==='histogram'?(scope==='all'&&p.source.mode==='observations'?'original-observations':scope==='all'?'pre-aggregated-bins':'filtered-derived-bins'):scope==='all'?'all-source-rows':'filtered-source-rows';
  let zeroFillComparison=null;
  if(p.chartType!=='histogram'){
    const comparisonRows=scope==='all'?allRows:rows,comparisonSeries=scope==='all'?defs:chosen;
    const facts=chartFacts({...p,rows:comparisonRows,series:comparisonSeries});
    if(facts.chartType!=='histogram')zeroFillComparison={scope:tableScope,rowCount:comparisonRows.length,series:facts.series.map(s=>({...s,label:defs.find(d=>d.id===s.id)?.label??s.id}))};
  }
  const download={format:'dsh-semantic-ui-table',version:1,title:p.title,chartType:p.chartType,unit:p.unit,scope:tableScope,selection:scope==='filtered'?{from,to,seriesIds:chosen.map(s=>s.id)}:null,...(p.chartType==='histogram'&&tableScope!=='original-observations'?{measure:p.display,denominator:p.display==='proportion'?'valid observations per group in this table scope; missing excluded':null}:{}),headers,rows:tableRows};
  return {defs,total,chosen,selectedBins,visibleStats,emptyReason,temporal,horizontal,description,option,headers,tableRows,tableScope,download,zeroFillComparison};
}
