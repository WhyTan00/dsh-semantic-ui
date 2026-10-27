import {z} from 'zod';
import {bounded,validateEnvelope} from './protocol';
import {numericStats} from './math';
import {sourceMetadata,SOURCE_LIMITS,type SourceSnapshot,type SourceIssue} from './source-graph';

const MAX_POSITIONS=128,bytes=(s:string)=>new TextEncoder().encode(s).length;
type Span={textByteStart:number;textByteEnd:number};
export interface NumericSource{context:string;measurement:string;unit:string;positions:{index:number;value:number|null;span:Span}[]}
const literal=(s:string,max:number)=>s.length>0&&s.length<=max&&!/[\u0000-\u001f<>，,。；;？！?!、]/u.test(s);
function countValue(s:string){
 if(/^[1-9]\d{0,2}$/u.test(s))return Number(s);
 const digits='一二三四五六七八九',digit=(v:string)=>digits.indexOf(v)+1;
 if(s.length===1&&digits.includes(s))return digit(s);
 if(/^十[一二三四五六七八九]?$/u.test(s))return 10+(s.length===2?digit(s[1]):0);
 if(/^[二三四五六七八九]十[一二三四五六七八九]?$/u.test(s))return digit(s[0])*10+(s.length===3?digit(s[2]):0);
 return NaN;
}
/** Grammar selection only, never fact extraction or source authentication. */
export const numericSourcePrefix=(text:string)=>/^[^，,。；;\r\n]{1,80}?([1-9]\d{0,2}|[一二三四五六七八九十]{1,3})次[^，,。；;\r\n]{1,40}?读数是/u.test(text);
/** Anchored complete grammar. Does not extract a plausible list from arbitrary prose. */
export function parseNumericSource(text:string,offset=0):{status:'ready';value:NumericSource}|{status:'unsupported';issues:SourceIssue[]}{
 const fail=(code:string,reason:string)=>({status:'unsupported' as const,issues:[{code,path:'$.source.excerpt',reason}]});
 if(bytes(text)>SOURCE_LIMITS.excerptBytes)return fail('SOURCE_LIMIT','Selected numeric text exceeds the byte limit.');
 const suffix=['。请解释这批数据，能计算平均值吗？','。能计算平均值吗？'].find(s=>text.endsWith(s));
 if(!suffix)return fail('SOURCE_SYNTAX','Use the complete supported final mean question; no trailing clause is discarded.');
 const body=text.slice(0,-suffix.length);
 if(/[。\r\n]/u.test(body))return fail('SOURCE_SYNTAX','Supply one complete single-line reading clause and the supported final question.');
 // Header work is bounded by label lengths. Split the unit separately rather
 // than backtracking through overlapping whitespace/list quantifiers.
 const m=/^([^，,。；;\r\n]{1,80}?)([1-9]\d{0,2}|[一二三四五六七八九十]{1,3})次([^，,。；;\r\n]{1,40}?)读数是/u.exec(body);
 if(!m||!literal(m[1],80)||!literal(m[3],40))return fail('SOURCE_SYNTAX','Use the documented literal subject, count and measurement header.');
 const count=countValue(m[2]);if(!Number.isInteger(count)||count<1||count>MAX_POSITIONS)return fail('SOURCE_COUNT','Use a count from 1 to 128 (standard Chinese counts are supported through 99).');
 const tail=body.slice(m[0].length),unitMatch=/\s([^\s，,。；;？！?!、]{1,24})$/u.exec(tail);
 if(!unitMatch||!literal(unitMatch[1],24))return fail('SOURCE_SYNTAX','Supply a single explicit unit separated from the reading list by whitespace.');
 const start=m[0].length,list=tail.slice(0,unitMatch.index),unit=unitMatch[1],tokens=[...list.matchAll(/[^、]+/gu)];
 if(tokens.length!==count||list.split('、').some(t=>!t.trim()))return fail('SOURCE_COUNT','Declared positions must exactly equal the complete reading list; empty positions are unsupported.');
 const positions:NumericSource['positions']=[];
 for(const [index,token]of tokens.entries()){
  const valueText=token[0].trim();if(valueText!=='缺失'&&!/^[+-]?(?:\d+(?:\.\d+)?|\.\d+)(?:[eE][+-]?\d+)?$/u.test(valueText))return fail('SOURCE_VALUE','Every position must be one finite numeric literal or the literal 缺失. Ranges, qualifiers and missing units are not inferred.');
  const value=valueText==='缺失'?null:Number(valueText);if(value!==null&&!Number.isFinite(value))return fail('SOURCE_VALUE','Numeric observations must be finite.');
  const charStart=start+token.index!+token[0].indexOf(valueText);
  positions.push({index,value,span:{textByteStart:offset+bytes(text.slice(0,charStart)),textByteEnd:offset+bytes(text.slice(0,charStart+valueText.length))}});
 }
 return {status:'ready',value:{context:m[1],measurement:m[3],unit,positions}};
}
const name=z.string().min(1).max(80);
export const sourceNumericRequestSchema=z.strictObject({
 view:z.unknown().optional(),
 mapping:z.strictObject({seriesId:name,rows:z.array(z.strictObject({sourceIndex:z.number().int().min(0).max(MAX_POSITIONS-1),rowId:name})).min(1).max(MAX_POSITIONS)}).optional(),
 claims:z.array(z.strictObject({kind:z.literal('mean'),population:z.enum(['observed','complete']),denominator:z.number().int().min(0).max(MAX_POSITIONS),value:z.number().finite().nullable(),unit:z.string().min(1).max(24)})).max(SOURCE_LIMITS.claims).optional(),
 prose:z.string().max(20000).optional(),
});
function facts(source:NumericSource){
 const values=source.positions.map(p=>p.value),stats=numericStats(values);
 return {unit:source.unit,positions:values.length,values,missingMask:values.map(v=>v===null),observed:{count:stats.n,missing:stats.missing,sum:stats.sum,mean:stats.mean,denominator:stats.n,scope:'declared non-missing positions only'},complete:{count:values.length,mean:stats.missing?null:stats.mean,denominator:values.length,known:stats.missing===0&&stats.mean!==null,scope:'all declared positions; missing readings remain unknown'},method:'unweighted arithmetic mean; no imputation, unit conversion, sampling or population inference'};
}
function canonical(source:NumericSource,f:ReturnType<typeof facts>){
 const list=source.positions.map(p=>`${p.index+1}=${p.value===null?'缺失':p.value}`).join('、');
 return `${source.context}的${source.measurement}读数（${source.unit}），按原文位置：${list}。\n共${f.positions}个位置，${f.observed.count}个实际观测、${f.observed.missing}个缺失；实测零保留，缺失不填零。\n已观测项的算术平均值：${f.observed.mean===null?'未知（无有效观测或计算超限）':f.observed.mean+' '+source.unit}；分母为${f.observed.denominator}个实际观测。\n完整${f.positions}次读数的平均值：${f.complete.known?f.complete.mean+' '+source.unit:'未知'}；完整范围分母为${f.complete.denominator}。\n按位置展示不代表时间间距；补零只能是另列假设，不能成为实测值或完整均值，也不据此推断偏差方向、总体或任意正文。`;
}
/** Independent startup source -> complete positional DataChart binding -> finite explanation. */
export function checkSourceNumeric(snapshot:SourceSnapshot,input:unknown):Record<string,unknown>{
 const common={sourceCheckVersion:'1.0',sourceCheckKind:'observations-zh',source:sourceMetadata({...snapshot,kind:'observations-zh'}),sourceFactsVerified:false,unverified:['source identity, authorship and real-world readings','unselected context, arbitrary prose, chart title and annotations','time intervals, unit conversion, imputation, weighted/population statistics and arbitrary chart representations']};
 const finish=(r:Record<string,unknown>)=>bounded(r)?{...common,status:'check-limit',issues:[{code:'SOURCE_CHECK_LIMIT',path:'$',reason:'Complete numeric comparison exceeds the receipt limit; no partial approval.'}],canonicalExplanation:{status:'withheld'}}:r;
 const limited=bounded(input);if(limited)return {...common,status:'validation-failed',issues:[limited],canonicalExplanation:{status:'withheld'}};
 const request=sourceNumericRequestSchema.safeParse(input);if(!request.success)return {...common,status:'validation-failed',issues:request.error.issues.map(i=>({code:'SOURCE_REQUEST',path:'$.'+i.path.join('.'),reason:i.message})),canonicalExplanation:{status:'withheld'}};
 const parsed=parseNumericSource(snapshot.excerpt,snapshot.textByteStart);if(parsed.status!=='ready')return {...common,status:'source-unsupported',issues:parsed.issues,comparison:{status:'not-assessed'},canonicalExplanation:{status:'withheld'}};
 const source=parsed.value,sourceStatistics=facts(source),issues:SourceIssue[]=[];
 const add=(code:string,path:string,reason:string)=>issues.push({code,path,reason});
 const {view,mapping,claims=[],prose}=request.data;let comparison:Record<string,unknown>={status:'not-requested'};
 if(mapping&&view===undefined)add('SOURCE_MAPPING','$.mapping','A field mapping requires the actual DataChart.');
 if(view!==undefined){
  const checked=validateEnvelope(view);
  if(!checked.ok)return finish({...common,status:'validation-failed',sourceObservations:source,sourceStatistics,comparison:{status:'not-assessed'},issues:checked.issues,canonicalExplanation:{status:'withheld'}});
  if(checked.value.component!=='DataChart'||checked.value.payload.chartType!=='bar')return {...common,status:'source-unsupported',issues:[{code:'SOURCE_REPRESENTATION',path:'$.view',reason:'This source contract supports one category bar series in original positional order only; it does not establish time, binning or a distribution.'}],canonicalExplanation:{status:'withheld'}};
  const p=checked.value.payload;
  if(p.unit!==source.unit)add('SOURCE_UNIT','$.view.payload.unit','Use the exact source unit; no conversion or added denominator is certified.');
  if(p.x.kind!=='category'||p.x.order!=='input'||p.x.timezone!==undefined||p.x.granularity!==undefined)add('SOURCE_ORDER','$.view.payload.x','Only source positions are known: category/input order, with no time metadata.');
  if(!mapping)add('SOURCE_MAPPING','$.mapping','Bind the single series ID and every row ID to an explicit zero-based sourceIndex.');
  const series=p.series.find(s=>s.id===mapping?.seriesId);
  if(p.series.length!==1||!series||series.label!==source.measurement)add('SOURCE_SERIES','$.view.payload.series','One exact source measurement label must bind the supplied series ID; aliases/additional series are unsupported.');
  const maps=mapping?.rows??[],indexes=new Set(maps.map(m=>m.sourceIndex)),ids=new Set(maps.map(m=>m.rowId));
  if(maps.length!==source.positions.length||indexes.size!==maps.length||ids.size!==maps.length||source.positions.some(s=>!indexes.has(s.index))||p.rows.length!==source.positions.length||p.rows.some(r=>!ids.has(r.id)))add('SOURCE_POSITIONS','$.mapping.rows','Every source position and chart row must be bound once, with no omissions, extras or duplicate indices/IDs.');
  const rowChecks=source.positions.map(s=>{
   const map=maps.find(m=>m.sourceIndex===s.index),row=p.rows.find(r=>r.id===map?.rowId),before=issues.length;
   if(!row||!mapping||!series){add('SOURCE_BINDING','$.mapping.rows','A source position is not bound to an existing row and series.');return {sourceIndex:s.index,status:'not-assessed',sourceSpan:s.span};}
   const path=`$.view.payload.rows.${p.rows.indexOf(row)}`;
   if(p.rows[s.index]?.id!==row.id||row.x!==String(s.index+1))add('SOURCE_ORDER',path+'.x','Rows must retain source order with literal 1-based position labels; no time or rank interpretation.');
   const actual=row.values[mapping.seriesId];
   if((actual===null)!==(s.value===null))add('SOURCE_MISSINGNESS',path+'.values.'+mapping.seriesId,'A missing source reading and an observed zero are different even when the computed means coincide.');
   else if(actual!==s.value)add('SOURCE_VALUE',path+'.values.'+mapping.seriesId,'The mapped observation differs from this source position.');
   return {sourceIndex:s.index,rowId:row.id,seriesId:mapping.seriesId,expected:s.value,actual,missing:s.value===null,status:issues.length===before?'matched':'mismatch',sourceSpan:s.span};
  });
  comparison={status:issues.length?'mismatch':'matched',scope:'all ordered source values, null mask, exact unit and single positional bar representation',rowChecks,viewAnnotations:'not-verified'};
 }
 const claimChecks=claims.map((c,index)=>{
  const expected=c.population==='observed'?sourceStatistics.observed:sourceStatistics.complete;
  const matched=c.unit===source.unit&&c.denominator===expected.denominator&&c.value===expected.mean;
  return {index,kind:c.kind,population:c.population,status:matched?'supported':'mismatch',expected:{value:expected.mean,denominator:expected.denominator,unit:source.unit},actual:c,scopeKnown:expected.mean!==null,reason:expected.mean===null?'The mean in this range is unknown; a numeric assertion is unsupported.':'Unweighted arithmetic mean within the explicitly named range.'};
 });
 const canExplain=!issues.length&&claimChecks.every(c=>c.status==='supported');
 return finish({...common,status:'compared',sourceObservations:source,sourceStatistics,comparison,issues,claimChecks,freeProse:{status:'not-verified',provided:prose!==undefined,characters:prose?.length??0},canonicalExplanation:canExplain?{status:'available',basis:'complete selected finite source readings and explicit calculation range only',text:canonical(source,sourceStatistics)}:{status:'withheld',reason:'Resolve the positional, missingness, unit, representation or statistical claim mismatch; no combined source explanation is delivered.'}});
}
