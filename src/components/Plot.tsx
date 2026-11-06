import {useEffect,useRef} from 'react';
import * as echarts from 'echarts/core';
import {LineChart,BarChart} from 'echarts/charts';
import {GridComponent,TooltipComponent,LegendComponent,AriaComponent} from 'echarts/components';
import {SVGRenderer} from 'echarts/renderers';
echarts.use([LineChart,BarChart,GridComponent,TooltipComponent,LegendComponent,AriaComponent,SVGRenderer]);

export function Plot({option,description,horizontal,onSelect}:{option:echarts.EChartsCoreOption;description:string;horizontal:boolean;onSelect?:(index:number)=>void}){
 const div=useRef<HTMLDivElement>(null),instance=useRef<echarts.EChartsType|null>(null),select=useRef(onSelect);
 useEffect(()=>{select.current=onSelect;},[onSelect]);
 useEffect(()=>{if(!div.current)return;const element=div.current,c=echarts.init(element,undefined,{renderer:'svg'});instance.current=c;
  c.on('finished',()=>{element.dataset.renderReady='true';});c.on('click',event=>{if('dataIndex'in event&&typeof event.dataIndex==='number')select.current?.(event.dataIndex);});
  const observer=new ResizeObserver(()=>c.resize());observer.observe(element);return()=>{observer.disconnect();c.dispose();instance.current=null;};
 },[]);
 useEffect(()=>{if(div.current)div.current.dataset.renderReady='false';instance.current?.setOption(option,{notMerge:true});},[option]);
 return <div ref={div} className="plot" role="img" aria-label={description} data-orientation={horizontal?'horizontal':'vertical'}/>;
}
