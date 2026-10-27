import{it,expect}from'vitest';import{createElement}from'react';import{renderToStaticMarkup}from'react-dom/server';
import{LocaleContext,translate}from'../src/i18n';import{DataChart}from'../src/components/DataChart';import{DecisionExplorer}from'../src/components/DecisionExplorer';import{ArchitectureExplorer}from'../src/components/ArchitectureExplorer';
import{chart,decision,architecture}from'../fixtures/examples';
import type{Envelope}from'../src/protocol';
function kind<T extends Envelope['component']>(view:Envelope,component:T){if(view.component!==component)throw Error('Fixture kind mismatch');return view as Extract<Envelope,{component:T}>;}
const c=kind(chart,'DataChart'),d=kind(decision,'DecisionExplorer'),a=kind(architecture,'ArchitectureExplorer');import{chartView}from'../src/chart-view';import{localizedSummary}from'../src/localized-summary';import{defaultTheme,themeTokens}from'../src/theme';
it('defaults to Chinese across all three component controls and preserves supplied data and prose',()=>{
 const before=JSON.stringify([chart,decision,architecture]);
 const html=renderToStaticMarkup(createElement(DataChart,{data:c.payload}));expect(html).toContain('下载此表格');expect(html).toContain('缺失值计算对照');expect(html).toContain('起始位置');expect(html).not.toContain('Download this table');expect(html).toContain(c.payload.title);expect(html).toContain(c.payload.fullDataExplanation!);
 expect(renderToStaticMarkup(createElement(DecisionExplorer,{data:d.payload}))).toContain('本地试算条件');
 expect(renderToStaticMarkup(createElement(ArchitectureExplorer,{data:a.payload}))).toContain('查找节点');expect(JSON.stringify([chart,decision,architecture])).toBe(before);
});
it('supports an explicit English embedding without changing field IDs, enum values or observations',()=>{
 const html=renderToStaticMarkup(createElement(LocaleContext.Provider,{value:'en'},createElement(DataChart,{data:c.payload})));expect(html).toContain('Download this table');expect(html).toContain('Computed missing-value comparison');expect(translate('zh-CN','pass')).toBe('通过');expect(translate('en','Unknown')).toBe('Unknown');expect(translate('en','本地试算条件')).toBe('Local conditions');
});
it('localizes chart descriptions and headers while keeping exported values, units, missing mask and statistics unchanged',()=>{
 const selection={enabled:['a','b'],from:0,to:3,scope:'all' as const},tokens=themeTokens(defaultTheme),a=chartView(c.payload,selection,tokens,'zh-CN'),b=chartView(c.payload,selection,tokens,'en');expect(a.description).toContain('等价数值见源数据表');expect(a.description).not.toContain('Selected range');expect(a.download.rows).toEqual(b.download.rows);expect(a.download.unit).toBe(b.download.unit);expect(a.zeroFillComparison).toEqual(b.zeroFillComparison);
});
it('formats existing deterministic summaries in Chinese without converting supplied labels or inventing known values',()=>{
 const before=JSON.stringify(chart);expect(localizedSummary(chart,'zh-CN')).toContain('个缺失');expect(localizedSummary(chart,'en')).toContain('Declared');expect(JSON.stringify(chart)).toBe(before);
});
