import {z} from 'zod';
import {validateEnvelope,VERSION,type Envelope,type Chart} from './protocol';
import {histogram,numericStats,sortedRows} from './math';

export const CSV_LIMITS={bytes:131072,rows:500,columns:16,cell:1200} as const;
const label=z.string().trim().min(1).max(80);
export const dataMappingSchema=z.strictObject({xColumn:label,valueColumn:label,unit:label,unitMissing:z.boolean(),xKind:z.enum(['category','time']),timezone:label.optional(),granularity:label.optional()}).superRefine((m,c)=>{
 if(m.xColumn===m.valueColumn)c.addIssue({code:'custom',message:'Choose different label and value columns.'});
 if(m.unitMissing&&m.unit!=='未注明')c.addIssue({code:'custom',message:'Unspecified units must stay unspecified.'});
 if(m.xKind==='time'?(!m.timezone||!m.granularity):m.timezone!==undefined||m.granularity!==undefined)c.addIssue({code:'custom',message:'Time needs explicit timezone and granularity; category has neither.'});
});
export type DataMapping=z.infer<typeof dataMappingSchema>;
export const dataExplorationSchema=z.strictObject({version:z.literal(1),fileName:z.string().min(1).max(120),fileSha256:z.string().regex(/^[a-f0-9]{64}$/),columns:z.array(label).min(2).max(CSV_LIMITS.columns),recordNumbers:z.array(z.number().int().min(2).max(131072)).min(1).max(CSV_LIMITS.rows),sourceLabels:z.array(z.string().min(1).max(CSV_LIMITS.cell)).min(1).max(CSV_LIMITS.rows),ignoredBlankRecords:z.number().int().nonnegative().max(131072),mapping:dataMappingSchema,selectedRowIds:z.array(z.string().max(80)).max(CSV_LIMITS.rows).nullable()});
export type DataExploration=z.infer<typeof dataExplorationSchema>;
export interface CsvData{columns:string[];records:{record:number;cells:string[]}[];ignoredBlankRecords:number}
type RowChart=Exclude<Chart,{chartType:'histogram'}>;
export type LocalDataView=Extract<Envelope,{component:'DataChart'}>&{payload:RowChart};
function fail(code:string,record?:number):never{throw Error(code+(record===undefined?'':` · ${record}`));}

/** UTF-8 comma CSV only. Quoting is parsed as data, never evaluated. No dropped malformed records. */
export function parseCsv(text:string):CsvData{
 if(new TextEncoder().encode(text).length>CSV_LIMITS.bytes)fail('CSV_BYTE_LIMIT');
 if(text.includes('\0'))fail('CSV_NUL');
 const input=text.replace(/^\uFEFF/u,''),rows:{record:number;cells:string[]}[]=[];
 let cell='',cells:string[]=[],quoted=false,closed=false,started=false,record=1;
 const pushCell=()=>{if(cell.length>CSV_LIMITS.cell)fail('CSV_CELL_LIMIT',record);cells.push(cell);if(cells.length>CSV_LIMITS.columns)fail('CSV_COLUMN_LIMIT',record);cell='';closed=false;started=false;};
 const pushRow=()=>{pushCell();rows.push({record:record++,cells});cells=[];};
 for(let i=0;i<input.length;i++){
  const ch=input[i];
  if(quoted){if(ch==='"'){if(input[i+1]==='"'){cell+='"';i++;}else{quoted=false;closed=true;}}else cell+=ch;}
  else if(ch===',')pushCell();
  else if(ch==='\n'||ch==='\r'){pushRow();if(ch==='\r'&&input[i+1]==='\n')i++;}
  else if(ch==='"'){if(started||closed)fail('CSV_QUOTE',record);quoted=true;started=true;}
  else{if(closed)fail('CSV_AFTER_QUOTE',record);cell+=ch;started=true;}
  if(cell.length>CSV_LIMITS.cell)fail('CSV_CELL_LIMIT',record);
 }
 if(quoted)fail('CSV_UNCLOSED_QUOTE',record);
 if(cell!==''||cells.length||started||closed)pushRow();
 const first=rows.shift();if(!first)fail('CSV_EMPTY');
 const columns=first.cells.map(c=>c.trim());if(columns.length<2||columns.some(c=>!c||c.length>80)||new Set(columns).size!==columns.length)fail('CSV_HEADER');
 let ignoredBlankRecords=0;const records=[];
 for(const row of rows){if(row.cells.every(c=>c.trim()==='')){ignoredBlankRecords++;continue;}if(row.cells.length!==columns.length)fail('CSV_ROW_WIDTH',row.record);records.push(row);if(records.length>CSV_LIMITS.rows)fail('CSV_ROW_LIMIT');}
 if(!records.length)fail('CSV_NO_RECORDS');return {columns,records,ignoredBlankRecords};
}
export const fileTextDigest=async(text:string)=>[...new Uint8Array(await crypto.subtle.digest('SHA-256',new TextEncoder().encode(text)))].map(n=>n.toString(16).padStart(2,'0')).join('');
function numberCell(text:string,record:number){
 const value=text.trim();if(value===''||/^(?:null|na|n\/a)$/iu.test(value))return null;
 if(!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/u.test(value))fail('CSV_NUMBER',record);
 const n=Number(value);if(!Number.isFinite(n))fail('CSV_NUMBER',record);
 if(decimalIdentity(value)!==decimalIdentity(String(n)))fail('CSV_NUMBER_PRECISION',record);return n;
}
function decimalIdentity(text:string){
 const [mantissa,exponent='0']=text.toLowerCase().split('e'),negative=mantissa.startsWith('-'),unsigned=mantissa.replace(/^[+-]/u,''),point=unsigned.indexOf('.');
 let digits=unsigned.replace('.','').replace(/^0+/u,''),power=Number(exponent)-(point<0?0:unsigned.length-point-1);if(!digits)return '0';
 while(digits.endsWith('0')){digits=digits.slice(0,-1);power++;}
 return (negative?'-':'')+digits+'e'+power;
}

/** A fresh envelope: no old observations, selection, template provenance or model conclusion is copied. */
export function mapCsv(csv:CsvData,fileName:string,fileSha256:string,input:DataMapping):{view:LocalDataView;exploration:DataExploration}{
 const mapping=dataMappingSchema.parse(input),x=csv.columns.indexOf(mapping.xColumn),value=csv.columns.indexOf(mapping.valueColumn);
 if(x<0||value<0)fail('CSV_MAPPING');
 const rows=csv.records.map(r=>{const label=r.cells[x];if(!label.trim())fail('CSV_LABEL',r.record);return {id:`csv-${fileSha256.slice(0,16)}-${r.record}`,x:mapping.xKind==='time'?label:String(r.record),values:{'local-value':numberCell(r.cells[value],r.record)}};});
 const view:LocalDataView={protocolVersion:VERSION,displayId:'local-data-'+fileSha256.slice(0,24),revision:1,component:'DataChart',summary:`本地显式导入${rows.length}条记录；缺失保持null。仅计算所选数值，不继承原解释、认证或结论。`,payload:{chartType:mapping.xKind==='time'?'line':'bar',title:mapping.valueColumn,unit:mapping.unit,x:{kind:mapping.xKind,order:mapping.xKind==='time'?'ascending':'input',...(mapping.xKind==='time'?{timezone:mapping.timezone,granularity:mapping.granularity}:{})},series:[{id:'local-value',label:mapping.valueColumn}],rows}};
 const validated=validateEnvelope(view);if(!validated.ok)throw Error('CSV_VIEW: '+validated.issues.slice(0,3).map(i=>i.code+' '+i.path).join('; '));
 const exploration=dataExplorationSchema.parse({version:1,fileName,fileSha256,columns:csv.columns,recordNumbers:csv.records.map(r=>r.record),sourceLabels:csv.records.map(r=>r.cells[x]),ignoredBlankRecords:csv.ignoredBlankRecords,mapping,selectedRowIds:null});
 assertDataExploration(view,exploration);return {view,exploration};
}
export function assertDataExploration(view:Envelope,state:DataExploration){
 if(view.component!=='DataChart'||view.payload.chartType==='histogram')fail('DATA_EXPLORATION_VIEW');
 const p=view.payload,m=state.mapping;
 if(new Set(state.columns).size!==state.columns.length||!state.columns.includes(m.xColumn)||!state.columns.includes(m.valueColumn)||state.recordNumbers.some((n,i)=>i>0&&n<=state.recordNumbers[i-1])||p.rows.length!==state.recordNumbers.length||p.rows.length!==state.sourceLabels.length||p.series.length!==1||p.series[0].id!=='local-value'||p.series[0].label!==m.valueColumn||p.unit!==m.unit||p.x.kind!==m.xKind||p.fullDataExplanation!==undefined||view.presentation?.template)fail('DATA_EXPLORATION_MAPPING');
 if(m.xKind==='time'&&(p.x.timezone!==m.timezone||p.x.granularity!==m.granularity))fail('DATA_EXPLORATION_TIME');
 if(p.rows.some((r,i)=>r.id!==`csv-${state.fileSha256.slice(0,16)}-${state.recordNumbers[i]}`||r.x!==(m.xKind==='time'?state.sourceLabels[i]:String(state.recordNumbers[i]))))fail('DATA_EXPLORATION_ROW_ID');
 const ids=new Set(p.rows.map(r=>r.id));if(state.selectedRowIds!==null&&(new Set(state.selectedRowIds).size!==state.selectedRowIds.length||state.selectedRowIds.some(id=>!ids.has(id))))fail('DATA_EXPLORATION_SELECTION');
}

/** One row identity set drives every plot, the table, statistics and download. */
export function explorationView(p:RowChart,state:DataExploration){
 const all=sortedRows(p),selected=state.selectedRowIds===null?null:new Set(state.selectedRowIds),rows=all.filter(r=>selected===null||selected.has(r.id)),values=rows.map(r=>r.values['local-value']),stats=numericStats(values),full=numericStats(all.map(r=>r.values['local-value']));
 const boundaries=distributionBoundaries(full.min,full.max,full.n);
 const counts=(rs:typeof rows)=>boundaries.length?histogram({mode:'observations',boundaries,groups:[{id:'local-value',label:p.title,observations:rs.map(r=>r.values['local-value'])} ]})[0].counts:[];
 const bins=boundaries.slice(0,-1).map((lower,i)=>({lower,upper:boundaries[i+1],includesUpper:i===boundaries.length-2,rowIds:all.filter(r=>{const v=r.values['local-value'];return v!==null&&v>=lower&&(v<boundaries[i+1]||i===boundaries.length-2&&v===boundaries[i+1]);}).map(r=>r.id)}));
 const recordOf=new Map(p.rows.map((r,i)=>[r.id,state.recordNumbers[i]]));
 const labelOf=new Map(p.rows.map((r,i)=>[r.id,state.sourceLabels[i]]));
 const download={format:'dsh-semantic-ui-table',version:1,title:p.title,chartType:p.chartType,unit:p.unit,scope:'linked-selected-source-rows',selection:{rowIds:rows.map(r=>r.id),sourceFileSha256:state.fileSha256},headers:['sourceRecord','rowId',state.mapping.xColumn,`${state.mapping.valueColumn} (${p.unit})`],rows:rows.map(r=>[recordOf.get(r.id)!,r.id,labelOf.get(r.id)!,r.values['local-value']]),statistics:{rowCount:rows.length,valid:stats.n,missing:stats.missing,observedMean:stats.mean,observedSubtotal:stats.sum,completeMean:stats.missing?null:stats.mean,denominator:'selected non-missing observations',unit:p.unit}};
 return {all,rows,stats,full,bins,fullCounts:counts(all),selectedCounts:counts(rows),download,recordOf,labelOf};
}
function distributionBoundaries(min:number|null,max:number|null,n:number){
 if(min===null||max===null)return [];
 if(min===max){const d=Math.max(1,Math.abs(min)*0.01),lo=Number.isFinite(min-d)?min-d:min,hi=Number.isFinite(max+d)?max+d:max;return hi>lo?[lo,hi]:[];}
 const bins=Math.min(12,Math.max(2,Math.ceil(Math.sqrt(n)))),width=(max-min)/bins;
 if(!Number.isFinite(width)||width<=0)return [];
 const b=Array.from({length:bins+1},(_,i)=>i===bins?max:min+width*i);
 return b.every((v,i)=>Number.isFinite(v)&&(!i||v>b[i-1]))?b:[];
}
