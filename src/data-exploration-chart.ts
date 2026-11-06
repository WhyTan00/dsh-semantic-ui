import type {EChartsCoreOption} from 'echarts/core';
import {chartView,seriesEncoding} from './chart-view';
import {explorationView,type DataExploration} from './data-exploration';
import type {Chart} from './protocol';
import type {themeTokens} from './theme';
import {translate,type Locale} from './i18n';

export function linkedChartView(p:Exclude<Chart,{chartType:'histogram'}>,state:DataExploration,tokens:ReturnType<typeof themeTokens>,locale:Locale){
 const t=(key:string)=>translate(locale,key),v=explorationView(p,state),selected=new Set(v.rows.map(r=>r.id)),unit=state.mapping.unitMissing?t('Unit not specified'):p.unit;
 const display={...p,rows:v.all.map(r=>({...r,x:p.x.kind==='time'?r.x:`${v.labelOf.get(r.id)} · #${v.recordOf.get(r.id)}`}))};
 const base=chartView(display,{enabled:['local-value'],from:0,to:Math.max(0,display.rows.length-1),scope:'all'},tokens,locale),series=base.option.series[0];
 const description=`${t('Original order and shared selection')}: ${v.rows.length}/${v.all.length}; ${t('Valid observations')}: ${v.stats.n}; ${t('Missing')}: ${v.stats.missing}. ${unit}. ${t('Use the record picker or table for exact labels and keyboard selection.')}`;
 const time=p.x.kind==='time'?new Intl.DateTimeFormat('en-GB',{timeZone:p.x.timezone,month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}):undefined;
 const timeTick=(value:number)=>{const parts=time!.formatToParts(new Date(value)),get=(name:string)=>parts.find(p=>p.type===name)?.value??'';return `${get('month')}/${get('day')}\n${get('hour')}:${get('minute')}`;};
 const overview:EChartsCoreOption={...base.option,...(time?{xAxis:{...base.option.xAxis,axisLabel:{...base.option.xAxis.axisLabel,formatter:timeTick}}}:{}),aria:{enabled:true,label:{description}},tooltip:{...base.option.tooltip,formatter:(input:unknown)=>{
  const items=Array.isArray(input)?input:[input],i=(items[0]as{dataIndex?:number})?.dataIndex??0,r=v.all[i];return r?`${state.mapping.xColumn}: ${v.labelOf.get(r.id)}\n${t('Source record')}: ${v.recordOf.get(r.id)}\n${state.mapping.valueColumn}: ${r.values['local-value']??t('Missing')} ${unit}\n${t('Selected')}: ${selected.has(r.id)?t('Yes'):t('No')}`:'';
 }},series:[{...series,id:'local-context',name:t('All records (context)'),itemStyle:{color:tokens.muted,opacity:0.25},lineStyle:{color:tokens.muted,opacity:0.4},symbolSize:5},
  {...series,id:'local-selected',name:t('Selected records'),...seriesEncoding(0,tokens,p.chartType==='bar'),lineStyle:{opacity:0},symbolSize:9,...(p.chartType==='bar'?{barGap:'-100%'}:{}),data:base.option.series[0].data.map((d,i)=>selected.has(v.all[i].id)?d:p.x.kind==='time'?[Date.parse(v.all[i].x),null]:null)}]};
 const binLabels=v.bins.map(b=>`[${b.lower}, ${b.upper}${b.includesUpper?']':')'}`),distributionDescription=`${t('Distribution of the same selected records')}: ${v.stats.n} ${t('valid observations')}; ${v.stats.missing} ${t('Missing')}. ${t('Bins stay fixed for the entire current dataset; missing values have no bin.')}`;
 const distribution:EChartsCoreOption={animation:false,textStyle:{fontSize:tokens.size,color:tokens.text,fontFamily:tokens.font},backgroundColor:'transparent',aria:{enabled:true,label:{description:distributionDescription}},grid:{left:12,right:16,top:44,bottom:22,containLabel:true},legend:{top:0,textStyle:{color:tokens.text},selectedMode:false},tooltip:{trigger:'axis',renderMode:'richText',confine:true,formatter:(input:unknown)=>{const items=Array.isArray(input)?input:[input],i=(items[0]as{dataIndex?:number})?.dataIndex??0;return `${binLabels[i]??''} ${unit}\n${t('All records (context)')}: ${v.fullCounts[i]??0}\n${t('Selected records')}: ${v.selectedCounts[i]??0}`;}},xAxis:{type:'category',data:binLabels,axisLabel:{color:tokens.muted,width:95,overflow:'truncate',hideOverlap:true}},yAxis:{type:'value',minInterval:1,name:t('Observation count'),axisLabel:{color:tokens.muted},splitLine:{lineStyle:{color:tokens.line}}},series:[{name:t('All records (context)'),type:'bar',data:v.fullCounts,itemStyle:{color:tokens.muted,opacity:0.25},barCategoryGap:'0%'},{name:t('Selected records'),type:'bar',data:v.selectedCounts,...seriesEncoding(0,tokens,true),barGap:'-100%',barCategoryGap:'0%'}]};
 return {...v,unit,overview,overviewDescription:description,horizontal:base.horizontal,distribution,distributionDescription,binLabels};
}
