import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {init,use} from 'echarts/core';
import {LineChart,BarChart} from 'echarts/charts';
import {GridComponent,TooltipComponent,LegendComponent,AriaComponent} from 'echarts/components';
import {SVGRenderer} from 'echarts/renderers';
import {mapCsv,parseCsv} from '../src/data-exploration';
import {linkedChartView} from '../src/data-exploration-chart';
import {defaultTheme,themeTokens} from '../src/theme';
use([LineChart,BarChart,GridComponent,TooltipComponent,LegendComponent,AriaComponent,SVGRenderer]);

it.each(['category','time'] as const)('renders linked %s options with the actual SVG chart engine, including empty selection',kind=>{
 const text=readFileSync(`fixtures/data-exploration/${kind==='category'?'observations':'power'}.csv`,'utf8');
 const {view,exploration}=mapCsv(parseCsv(text),'example.csv','a'.repeat(64),kind==='category'?{xColumn:'观测点',valueColumn:'读数',unit:'°C',unitMissing:false,xKind:kind}:{xColumn:'时间',valueColumn:'功率',unit:'kW',unitMissing:false,xKind:kind,timezone:'Asia/Shanghai',granularity:'hourly'});
 for(const selectedRowIds of [null,[],[view.payload.rows[0].id]]){
  const v=linkedChartView(view.payload,{...exploration,selectedRowIds},themeTokens(defaultTheme),'zh-CN');
  for(const option of [v.overview,v.distribution]){
   const chart=init(null,undefined,{renderer:'svg',ssr:true,width:480,height:300});
   try{chart.setOption(option);expect(chart.renderToSVGString()).toContain('<svg');}finally{chart.dispose();}
  }
 }
});
