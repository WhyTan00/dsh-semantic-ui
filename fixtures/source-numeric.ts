import {readFileSync} from 'node:fs';
import type {Envelope} from '../src/protocol';
export const numericExpected=JSON.parse(readFileSync(new URL('./source-numeric-expectations.json',import.meta.url),'utf8'));
/** Explicit source projection for testing/usage, not a regenerated model answer. */
export function numericRequest(values:(number|null)[]=numericExpected.values,measurement:string=numericExpected.measurement,unit:string=numericExpected.unit,suffix='n2'){
 const seriesId='series-'+suffix;
 const view:Extract<Envelope,{component:'DataChart'}>={protocolVersion:'1.4',displayId:'readings-'+suffix,revision:1,component:'DataChart',summary:'Explicit positional source projection; free prose unverified.',payload:{chartType:'bar',title:'Source readings',unit,x:{kind:'category',order:'input'},series:[{id:seriesId,label:measurement}],rows:values.map((value,index)=>({id:'row-'+suffix+'-'+index,x:String(index+1),values:{[seriesId]:value}}))}};
 return {view,mapping:{seriesId,rows:values.map((_,sourceIndex)=>({sourceIndex,rowId:'row-'+suffix+'-'+sourceIndex}))}};
}
