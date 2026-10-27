import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseNumericSource,checkSourceNumeric} from '../src/source-numeric';
import {sourceOptions,readSourceSnapshot} from '../src/source-input';
import type {SourceSnapshot} from '../src/source-graph';
import {numericExpected as e,numericRequest} from '../fixtures/source-numeric';
const sha=(s:string|Buffer)=>createHash('sha256').update(s).digest('hex');
const snapshot=(text=e.question):SourceSnapshot=>({kind:'observations-zh',excerpt:text,textSha256:sha(text),excerptSha256:sha(text),textBytes:Buffer.byteLength(text),textByteStart:0,textByteEnd:Buffer.byteLength(text)});
const check=(input:unknown={},text=e.question)=>checkSourceNumeric(snapshot(text),input);
const mean=(population:'observed'|'complete',denominator:number,value:number|null,unit=e.unit)=>({kind:'mean',population,denominator,value,unit});
const codes=(r:Record<string,unknown>)=>(r.issues as {code:string}[]).map(i=>i.code);

it('binds the full original N2 source/hash and every value/span to independently frozen observations and ranges',async()=>{
 expect(sha(readFileSync(e.source.path))).toBe(e.source.sha256);expect(sha(e.question)).toBe(e.source.textSha256);
 const s=await readSourceSnapshot({file:e.source.path,jsonPointer:'/question',kind:'observations-zh'}),p=parseNumericSource(s.excerpt);expect(p.status).toBe('ready');if(p.status!=='ready')throw Error();
 expect(p.value.positions.map(p=>p.value)).toEqual(e.values);expect(p.value.unit).toBe(e.unit);expect(p.value.measurement).toBe(e.measurement);
 for(const position of p.value.positions)expect(Buffer.from(e.question).subarray(position.span.textByteStart,position.span.textByteEnd).toString()).toBe(position.value===null?'缺失':String(position.value));
 const r=checkSourceNumeric(s,{});expect(r).toHaveProperty('sourceStatistics.missingMask',e.missingMask);expect(r).toHaveProperty('sourceStatistics.observed.mean',0);expect(r).toHaveProperty('sourceStatistics.observed.denominator',3);expect(r).toHaveProperty('sourceStatistics.complete.mean',null);expect(r).toHaveProperty('sourceStatistics.complete.denominator',4);expect(r).toHaveProperty('source.scope',expect.stringContaining('observed/complete'));expect(r).toHaveProperty('source.documentSha256',e.source.sha256);
});
it('checks a complete DataChart field binding and typed statistical range claims without certifying annotations/prose',()=>{
 const req=numericRequest(),r=check({...req,claims:[mean('observed',3,0),mean('complete',4,null)],prose:'A free claim is not certified.'});
 expect(r).toHaveProperty('comparison.status','matched');expect(r).toHaveProperty('canonicalExplanation.status','available');expect(r).toHaveProperty('sourceFactsVerified',false);expect(r).toHaveProperty('source.identityVerified',false);expect(r).toHaveProperty('freeProse.status','not-verified');expect((r.claimChecks as any[]).every(c=>c.status==='supported')).toBe(true);
 req.view.payload.title='An arbitrary unsupported title';req.view.summary='A misleading complete mean';expect(check(req)).toHaveProperty('comparison.viewAnnotations','not-verified');
});
it('rejects null-to-observed-zero and denominator substitution despite the coincidentally identical mean',()=>{
 const req=numericRequest();if(req.view.payload.chartType!=='bar')throw Error();req.view.payload.rows[2].values[req.mapping.seriesId]=0;
 const r=check({...req,claims:[mean('observed',4,0)]});expect(codes(r)).toContain('SOURCE_MISSINGNESS');expect(r).toHaveProperty('canonicalExplanation.status','withheld');expect(r).toHaveProperty('claimChecks.0.status','mismatch');
 for(const claim of [mean('observed',4,0),mean('complete',4,0),mean('observed',3,0,'°C')]){const c=check({...numericRequest(),claims:[claim]});expect(c).toHaveProperty('claimChecks.0.status','mismatch');expect(c).toHaveProperty('canonicalExplanation.status','withheld');}
});
it('generalizes names, numeric values, source order and IDs while keeping every position and its unit bound',()=>{
 const a=e.independentCounterexample,req=numericRequest(a.values,a.measurement,a.unit,'other-91');req.mapping.rows.reverse();
 const r=check({...req,claims:[mean('observed',4,3,'伏'),mean('complete',5,null,'伏')]},a.text);expect(r).toHaveProperty('comparison.status','matched');expect(r).toHaveProperty('sourceStatistics.values',a.values);expect(r).toHaveProperty('sourceStatistics.observed.mean',3);expect(r).toHaveProperty('canonicalExplanation.status','available');
 const changed=a.text.replace('5、缺失、-1、0、8','8、0、-1、缺失、5');expect(check(req,changed)).toHaveProperty('comparison.status','mismatch');
});
it('rejects omitted/duplicate/misbound rows, unit changes, relabeled/reordered positions and unsupported representation',()=>{
 const mutations=[(r:ReturnType<typeof numericRequest>)=>{r.mapping.rows.pop();},(r:ReturnType<typeof numericRequest>)=>{r.mapping.rows[1].sourceIndex=0;},(r:ReturnType<typeof numericRequest>)=>{r.view.payload.unit='华氏度';},(r:ReturnType<typeof numericRequest>)=>{if(r.view.payload.chartType==='bar')r.view.payload.rows.reverse();},(r:ReturnType<typeof numericRequest>)=>{if(r.view.payload.chartType==='bar')r.view.payload.rows[0].x='昨天';},(r:ReturnType<typeof numericRequest>)=>{if(r.view.payload.chartType==='bar')r.view.payload.series[0].label='压力';},(r:ReturnType<typeof numericRequest>)=>{if(r.view.payload.chartType==='bar')r.view.payload.x.order='ascending';}];
 for(const mutate of mutations){const req=numericRequest();mutate(req);expect(check(req)).toHaveProperty('canonicalExplanation.status','withheld');}
 const req=numericRequest();if(req.view.payload.chartType!=='bar')throw Error();req.view.payload.chartType='line';expect(check(req)).toHaveProperty('status','source-unsupported');
 expect(check({view:numericRequest().view})).toHaveProperty('canonicalExplanation.status','withheld');expect(check({mapping:numericRequest().mapping})).toHaveProperty('canonicalExplanation.status','withheld');
});
it('rejects incomplete, conditional, conflicting, nonfinite or oversized full sources instead of dropping difficult clauses',()=>{
 for(const text of [e.question.replace('四次','三次'),e.question.replace(' 摄氏度',''),e.question.replace('缺失','大约0'),e.question.replace('2 摄氏度','2e999 摄氏度'),e.question+'另外读数都可靠。',e.question.replace('。请','；如果异常则填零。请'),e.question.replace('-2、0','-2、、0')])expect(check({},text)).toHaveProperty('status','source-unsupported');
 expect(parseNumericSource('a'.repeat(17000))).toHaveProperty('status','unsupported');
 const maximum='探针128次浓度读数是 '+Array(128).fill('0').join('、')+' 单位甲。能计算平均值吗？';expect(check(numericRequest(Array(128).fill(0),'浓度','单位甲','max'),maximum)).toHaveProperty('canonicalExplanation.status','available');expect(check({},maximum.replace('128次','129次'))).toHaveProperty('status','source-unsupported');
});
it('handles all-missing, all-zero, signed decimals, different counts and overflow as explicit arithmetic unknowns',()=>{
 const text=(count:string,values:string)=>`探针${count}次浓度读数是 ${values} 单位甲。能计算平均值吗？`;
 expect(check({},text('2','缺失、缺失'))).toHaveProperty('sourceStatistics.observed.mean',null);expect(check({},text('二','0、0'))).toHaveProperty('sourceStatistics.complete.mean',0);expect(check({},text('三','-0.5、+1.5、.5'))).toHaveProperty('sourceStatistics.observed.mean',0.5);expect(check({},text('2','1e308、1e308'))).toHaveProperty('sourceStatistics.complete.known',false);
 const many=Array(11).fill('1').join('、');expect(check({},text('十一',many))).toHaveProperty('sourceStatistics.positions',11);
});
it('keeps source selection outside strict requests and recognizes the explicit startup kind',()=>{
 for(const extra of [{sourceFile:'forged'},{sourceText:e.question},{sourceKind:'arrows'},{authority:'human'},{claims:[{kind:'mean',population:'observed',denominator:3,value:0,unit:e.unit,text:'extra'}]}])expect(check(extra)).toHaveProperty('status','validation-failed');
 expect(sourceOptions(['--source-file','x','--source-kind','observations-zh'])).toHaveProperty('kind','observations-zh');
});
