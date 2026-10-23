import{describe,it,expect}from'vitest';
import{chartFacts}from'../src/facts';
import{chart,distribution}from'../fixtures/examples';
import type{Chart}from'../src/protocol';
describe('deterministic numeric receipts',()=>{
 it('grounds endpoints, the actual minimum and the dip without filling missing values',()=>{
  if(chart.component!=='DataChart')throw Error('Expected chart fixture');
  const facts=chartFacts(chart.payload);if(facts.chartType==='histogram')throw Error('Expected series facts');
  expect(facts.series[0]).toMatchObject({valid:4,missing:0,mean:4.5,minimum:3,maximum:6,firstValue:4,lastValue:6,netChange:2,adjacentValidDecreases:1});
  expect(facts.series[1]).toMatchObject({valid:3,missing:1,mean:0,minimum:-2,maximum:2,firstValue:-2,lastValue:2});
 });
 it('keeps missing endpoints unknown and computes facts from the declared row order',()=>{
  const p=structuredClone(chart.payload)as Exclude<Chart,{chartType:'histogram'}>;p.rows.reverse();p.rows[0].values.a=null;const before=JSON.stringify(p);const facts=chartFacts(p);if(facts.chartType==='histogram')throw Error('Expected series facts');
  expect(facts.firstRow?.x).toBe('2026-01-01T00:00:00Z');expect(facts.series[0].firstValue).toBe(4);expect(facts.series[0].lastValue).toBe(null);expect(facts.series[0].netChange).toBe(null);expect(JSON.stringify(p)).toBe(before);
 });
 it('preserves histogram denominators while bounding large-bin receipt size',()=>{
  const p=structuredClone(distribution.payload)as Extract<Chart,{chartType:'histogram'}>;let facts=chartFacts(p);if(facts.chartType!=='histogram')throw Error('Expected histogram facts');expect(facts.groups[0]).toMatchObject({valid:8,missing:1,counts:[2,3,3],proportions:[0.25,0.375,0.375]});
  p.source={mode:'prebinned',boundaries:Array.from({length:81},(_,i)=>i),groups:[{id:'all',label:'All',counts:Array(80).fill(0),missing:1}]};facts=chartFacts(p);if(facts.chartType!=='histogram')throw Error('Expected histogram facts');expect(facts.boundaries).toBe(null);expect(facts.groups[0]).toMatchObject({valid:0,missing:1,counts:null,proportions:null});expect(facts.binDetails).toContain('omitted');
 });
});
