import{it,expect}from'vitest';
import{createHash}from'node:crypto';
import{checkSourceNumeric}from'../src/source-numeric';
import{chartFacts}from'../src/facts';
import{numericRequest}from'../fixtures/source-numeric';
import type{SourceSnapshot}from'../src/source-graph';
const source=(text:string):SourceSnapshot=>({kind:'observations-zh',excerpt:text,textSha256:createHash('sha256').update(text).digest('hex'),excerptSha256:createHash('sha256').update(text).digest('hex'),textBytes:Buffer.byteLength(text),textByteStart:0,textByteEnd:Buffer.byteLength(text)});
it('accepts a complete reading record independently of the question without dropping trailing clauses',()=>{
 const text='离线样本3次位移读数是-9、缺失、3 厘米。',s=source(text),r=checkSourceNumeric(s,{});
 expect(r).toMatchObject({status:'compared',sourceFactsVerified:false,sourceStatistics:{values:[-9,null,3],missingMask:[false,true,false],observed:{count:2,sum:-6,mean:-3,denominator:2},complete:{count:3,sum:null,sumKnown:false,mean:null,known:false}}});
 expect(r).toHaveProperty('source.textSha256',s.textSha256);expect(r).toHaveProperty('canonicalExplanation.text',expect.stringContaining('已观测2项的小计：-6 厘米'));
 expect(r).toHaveProperty('canonicalExplanation.text',expect.stringContaining('完整3次读数的合计：未知'));
 for(const extra of ['全部缺失都等于零。','如果缺失就填零。','\n已补齐。'])expect(checkSourceNumeric(source(text+extra),{})).toHaveProperty('status','source-unsupported');
});
it('keeps mean sign, subtotal, complete unknowns and null mask independent across signed, zero, complete and overflow data',()=>{
 const cases=[{values:[-9,null,3],sum:-6,mean:-3,zmean:-2,direction:'higher',known:false},{values:[9,null,3],sum:12,mean:6,zmean:4,direction:'lower',known:false},{values:[7,null,-7],sum:0,mean:0,zmean:0,direction:'same',known:false},{values:[0,0],sum:0,mean:0,zmean:0,direction:'same',known:true},{values:[null,null],sum:null,mean:null,zsum:0,zmean:0,direction:'unknown',known:false},{values:[1e308,1e308],sum:null,mean:null,zmean:null,direction:'unknown',known:false}];
 for(const c of cases){
  const text=`离线样本${c.values.length}次位移读数是${c.values.map(v=>v===null?'缺失':v).join('、')} 厘米。`,req=numericRequest(c.values,'位移','厘米','baseline'),before=JSON.stringify(req),r=checkSourceNumeric(source(text),req);
  expect(r).toHaveProperty('comparison.status','matched');expect(r).toHaveProperty('sourceStatistics.observed.sum',c.sum);expect(r).toHaveProperty('sourceStatistics.complete.sum',c.known?c.sum:null);expect(r).toHaveProperty('sourceStatistics.complete.sumKnown',c.known);
  const f=chartFacts(req.view.payload);if(f.chartType==='histogram')throw Error();expect(f.series[0]).toMatchObject({sum:c.sum,mean:c.mean,zeroFillIllustration:{sum:c.zsum??c.sum,mean:c.zmean,differenceFromObservedSum:c.sum===null?null:0,directionRelativeToObservedSum:c.sum===null?'unknown':'same',directionRelativeToObservedMean:c.direction,completeDataSumKnown:c.known,completeDataMeanKnown:c.known}});expect(JSON.stringify(req)).toBe(before);
 }
});
it('retains a missingness refusal even when both sums and means coincide',()=>{
 const text='离线样本3次位移读数是7、缺失、-7 厘米。',req=numericRequest([7,0,-7],'位移','厘米','wrong');
 expect(checkSourceNumeric(source(text),req)).toMatchObject({comparison:{status:'mismatch'},canonicalExplanation:{status:'withheld'},issues:expect.arrayContaining([expect.objectContaining({code:'SOURCE_MISSINGNESS'})])});
});
