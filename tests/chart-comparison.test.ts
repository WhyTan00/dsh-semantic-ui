import{it,expect}from'vitest';
import{createElement}from'react';import{renderToStaticMarkup}from'react-dom/server';
import{chart,distribution}from'../fixtures/examples';import{chartView}from'../src/chart-view';import{chartFacts}from'../src/facts';import{defaultTheme,themeTokens}from'../src/theme';import{DataChart}from'../src/components/DataChart';
const tokens=themeTokens(defaultTheme),selection={enabled:['a','b'],from:0,to:3,scope:'filtered' as const};
it('computes comparison from exactly the filtered table without mutating source or export values',()=>{
 if(chart.component!=='DataChart'||chart.payload.chartType==='histogram')throw Error();const p=chart.payload,before=JSON.stringify(p);
 const v=chartView(p,{...selection,enabled:['b'],from:0,to:2},tokens),c=v.zeroFillComparison!;
 expect(c.scope).toBe('filtered-source-rows');expect(c.rowCount).toBe(3);expect(c.series.map(s=>s.id)).toEqual(['b']);expect(c.series[0]).toMatchObject({valid:2,missing:1,mean:-1,zeroFillIllustration:{mean:-2/3,directionRelativeToObservedMean:'higher'}});
 expect(v.download.rows.map(r=>r[1])).toEqual([-2,0,null]);expect(JSON.stringify(p)).toBe(before);
});
it('all-source comparison includes every source series and row even when the plot is filtered',()=>{
 if(chart.component!=='DataChart')throw Error();const v=chartView(chart.payload,{...selection,enabled:['b'],from:1,to:2,scope:'all'},tokens),c=v.zeroFillComparison!;
 expect(v.visibleStats.map(s=>s.id)).toEqual(['b']);expect(c.scope).toBe('all-source-rows');expect(c.rowCount).toBe(4);expect(c.series.map(s=>s.id)).toEqual(['a','b']);expect(c.series[1].zeroFillIllustration).toMatchObject({mean:0,directionRelativeToObservedMean:'same'});expect(v.download.rows[2][2]).toBeNull();
});
it('uses the existing core facts for signed, all-missing and empty comparisons',()=>{
 if(chart.component!=='DataChart'||chart.payload.chartType==='histogram')throw Error();const p=structuredClone(chart.payload);p.x={kind:'category',order:'input'};p.series=[{id:'a',label:'Negative'},{id:'b',label:'Missing'}];p.rows=[{id:'1',x:'1',values:{a:-4,b:null}},{id:'2',x:'2',values:{a:null,b:null}},{id:'3',x:'3',values:{a:-2,b:null}}];
 const expected=chartFacts(p);if(expected.chartType==='histogram')throw Error();const actual=chartView(p,{...selection,to:2},tokens).zeroFillComparison!;expect(actual.series[0].zeroFillIllustration).toEqual(expected.series[0].zeroFillIllustration);expect(actual.series[0].zeroFillIllustration.directionRelativeToObservedMean).toBe('higher');expect(actual.series[1].zeroFillIllustration.mean).toBeNull();
 const empty=chartView(p,{...selection,from:2,to:0},tokens).zeroFillComparison!;expect(empty.rowCount).toBe(0);expect(empty.series.every(s=>s.mean===null&&s.zeroFillIllustration.mean===null)).toBe(true);expect(chartView(p,{...selection,enabled:[]},tokens).zeroFillComparison?.series).toEqual([]);
});
it('labels fixed model prose as unverified and does not invent histogram means',()=>{
 if(chart.component!=='DataChart'||distribution.component!=='DataChart')throw Error();const before=JSON.stringify(chart.payload);const html=renderToStaticMarkup(createElement(DataChart,{data:chart.payload}));expect(html).toContain('Model explanation — original full data (unverified)');expect(html).toContain('Computed missing-value comparison');expect(html).toContain(chart.payload.fullDataExplanation!);expect(JSON.stringify(chart.payload)).toBe(before);
 expect(chartView(distribution.payload,selection,tokens).zeroFillComparison).toBeNull();
});
