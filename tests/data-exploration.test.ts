import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {parseCsv,mapCsv,fileTextDigest,explorationView,assertDataExploration,CSV_LIMITS,type DataMapping} from '../src/data-exploration';
import {createResult,readResult,resultDigest,initialInteraction} from '../src/results';
import {localDataResults,LOCAL_DATA_RESULTS_KEY} from '../src/local-data-results';
import {defaultTheme,defaultLayout} from '../src/theme';
const file=(name:string)=>readFileSync(`fixtures/data-exploration/${name}.csv`,'utf8');
const mapping:DataMapping={xColumn:'观测点',valueColumn:'读数',unit:'摄氏度',unitMissing:false,xKind:'category'};
const dataset=async()=>mapCsv(parseCsv(file('observations')),'observations.csv',await fileTextDigest(file('observations')),mapping);
const content=async()=>{const {view,exploration}=await dataset(),interaction=initialInteraction(view);if(interaction.component!=='DataChart')throw Error();return {view,interaction:{...interaction,dataExploration:exploration},theme:defaultTheme,layout:defaultLayout,locale:'zh-CN' as const};};

it('parses quoted commas, escaped quotes, multiline cells, BOM, CRLF and blank records without losing record identities',()=>{
 const c=parseCsv('\uFEFF名称,数值,说明\r\n"甲,乙",0,"literal ""quote""\r\nline"\r\n\r\n甲,,x\r\n');expect(c.columns).toEqual(['名称','数值','说明']);expect(c.records.map(r=>r.record)).toEqual([2,4]);expect(c.ignoredBlankRecords).toBe(1);expect(c.records[0].cells[2]).toBe('literal "quote"\r\nline');
});
it.each(['a,a\n1,2','a,b\n1','a,b\n"x,2','a,b\nx"y,2','a,b\n"x"junk,2','a,b\n\0,2','a,b\n\n'])('rejects malformed CSV as a whole: %s',text=>expect(()=>parseCsv(text)).toThrow());
it('rejects row/column/byte limits rather than truncating the selected data',()=>{
 expect(()=>parseCsv('a,b\n'+'x,1\n'.repeat(CSV_LIMITS.rows+1))).toThrow('CSV_ROW_LIMIT');expect(()=>parseCsv(Array.from({length:17},(_,i)=>'c'+i).join(',')+'\n1,2')).toThrow('CSV_COLUMN_LIMIT');expect(()=>parseCsv('x'.repeat(CSV_LIMITS.bytes+1))).toThrow('CSV_BYTE_LIMIT');
});
it.each(['=1+2','0x10','Infinity','NaN','1e999','1e-999','9007199254740993','0.10000000000000001'])('does not execute, coerce or silently round unsupported numeric cells: %s',async value=>{
 expect(()=>mapCsv(parseCsv('a,b\nx,'+value),'test.csv','a'.repeat(64),{...mapping,xColumn:'a',valueColumn:'b'})).toThrow();
});
it('keeps null, zero, negatives and duplicate labels distinct across selection, statistics, bins and download',async()=>{
 const {view,exploration}=await dataset();const s=explorationView(view.payload,exploration);
 expect(s.rows).toHaveLength(10);expect(s.stats).toMatchObject({n:8,missing:2,sum:40,mean:5});expect(s.download.statistics.completeMean).toBeNull();expect(s.fullCounts.reduce((a,b)=>a+b,0)).toBe(8);expect(s.labelOf.get(s.rows[0].id)).toBe(s.labelOf.get(s.rows[3].id));expect(s.rows[0].x).not.toBe(s.rows[3].x);expect(s.rows[0].id).not.toBe(s.rows[3].id);
 const selected={...exploration,selectedRowIds:s.bins[0].rowIds},v=explorationView(view.payload,selected);expect(v.stats).toMatchObject({n:4,missing:0,sum:-10,mean:-2.5});expect(v.selectedCounts.reduce((a,b)=>a+b,0)).toBe(v.stats.n);expect(v.download.rows.map(r=>r[1])).toEqual(v.rows.map(r=>r.id));expect(v.bins).toEqual(s.bins);
 const empty=explorationView(view.payload,{...exploration,selectedRowIds:[]});expect(empty.rows).toEqual([]);expect(empty.stats.mean).toBeNull();expect(empty.download.rows).toEqual([]);expect(empty.selectedCounts.every(n=>n===0)).toBe(true);
});
it('saves and reopens the same mapping, row selection, theme and missingness using format4, without a host source claim',async()=>{
 const c=await content();c.interaction.dataExploration.selectedRowIds=[c.view.payload.rows[2].id,c.view.payload.rows[1].id];const pkg=await createResult(c);expect(pkg.manifest.version).toBe(4);const reopened=await readResult(JSON.parse(JSON.stringify(pkg)));expect(reopened.content).toEqual(c);expect(reopened.manifest.sourceState).toBe('not-recorded');
 const broken=structuredClone(pkg);broken.content.interaction.component==='DataChart'&&broken.content.interaction.dataExploration?.selectedRowIds?.push('old-file-row');broken.sha256=await resultDigest({manifest:broken.manifest,content:broken.content});await expect(readResult(broken)).rejects.toThrow('DATA_EXPLORATION_SELECTION');
 const downgraded=structuredClone(pkg);downgraded.manifest.version=3;downgraded.sha256=await resultDigest({manifest:downgraded.manifest,content:downgraded.content});await expect(readResult(downgraded)).rejects.toThrow('RESULT_FORMAT');
});
it('builds a substantively different time dataset with fresh rows and all selection, never old data or conclusions',async()=>{
 const first=await dataset(),text=file('power'),second=mapCsv(parseCsv(text),'power.csv',await fileTextDigest(text),{xColumn:'时间',valueColumn:'功率',unit:'kW',unitMissing:false,xKind:'time',timezone:'Asia/Shanghai',granularity:'hourly'});const v=explorationView(second.view.payload,second.exploration);
 expect(second.exploration.selectedRowIds).toBeNull();expect(v.stats).toMatchObject({n:5,missing:1,sum:14,mean:2.8});expect(v.all[0].x).toContain('08:00');expect(v.all.at(-1)?.x).toContain('13:00');expect(v.rows.every(r=>!first.view.payload.rows.some(a=>a.id===r.id))).toBe(true);expect(second.view).not.toHaveProperty('presentation.template');expect(second.view.payload).not.toHaveProperty('fullDataExplanation');
 expect(()=>assertDataExploration(second.view,{...second.exploration,selectedRowIds:[first.view.payload.rows[0].id]})).toThrow('DATA_EXPLORATION_SELECTION');
});
it('requires explicit units and valid time mapping; missing units remain visibly unspecified',()=>{
 const csv=parseCsv('x,v\na,0');expect(()=>mapCsv(csv,'x.csv','b'.repeat(64),{xColumn:'x',valueColumn:'v',unit:'',unitMissing:false,xKind:'category'})).toThrow();const r=mapCsv(csv,'x.csv','b'.repeat(64),{xColumn:'x',valueColumn:'v',unit:'未注明',unitMissing:true,xKind:'category'});expect(r.view.payload.unit).toBe('未注明');
 expect(()=>mapCsv(parseCsv('x,v\n2026-11-01,2'),'x.csv','b'.repeat(64),{xColumn:'x',valueColumn:'v',unit:'W',unitMissing:false,xKind:'time',timezone:'UTC',granularity:'未注明'})).toThrow();
});
it('uses the existing result library contract for browser-only saved exploration; failed writes and conflicts preserve old documents',async()=>{
 const map=new Map<string,string>();let broken=false;const store={getItem:(k:string)=>map.get(k)??null,setItem:(k:string,v:string)=>{if(broken)throw Error('QUOTA');map.set(k,v);}},bridge=localDataResults(store,()=>crypto.randomUUID(),async job=>job()),document=await createResult(await content());
 const saved=await bridge({action:'save',expectedRevision:0,name:'我的探索',document});expect(saved.results).toHaveLength(1);const before=map.get(LOCAL_DATA_RESULTS_KEY);broken=true;await expect(bridge({action:'save',expectedRevision:1,name:'第二份',document})).rejects.toThrow('QUOTA');expect(map.get(LOCAL_DATA_RESULTS_KEY)).toBe(before);broken=false;await expect(bridge({action:'save',expectedRevision:0,name:'冲突',document})).rejects.toThrow('RESULT_CONFLICT');expect(map.get(LOCAL_DATA_RESULTS_KEY)).toBe(before);
 expect((await bridge({action:'list'})).results[0].document.content).toEqual(document.content);
});
