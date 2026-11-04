import {z} from 'zod';
import pkg from '../package.json' with {type:'json'};
import {bounded,envelopeSchema,validateEnvelope,type Envelope} from './protocol';
import {sourceDeliverySchema,type SourceDelivery} from './source-delivery-meta';
import {themeSchema,layoutSchema,type Theme,type Layout} from './theme';
import {validCapacityAmount} from './capacity-domain';

const ids=z.array(z.string().max(80)).max(80).refine(v=>new Set(v).size===v.length,'Duplicate selection IDs.');
const index=z.number().int().min(0).max(2000);
export const interactionSchema=z.discriminatedUnion('component',[
 z.strictObject({component:z.literal('DataChart'),enabled:ids,from:index,to:index,scope:z.enum(['filtered','all']),page:index}),
 z.strictObject({component:z.literal('DecisionExplorer'),values:z.record(z.string().max(80),z.union([z.number().finite(),z.boolean(),z.string().max(80),z.null()])),dimensions:ids,exploreProposals:z.boolean(),capacityDraft:z.strictObject({text:z.string().max(80),invalid:z.boolean()}).optional()}),
 z.strictObject({component:z.literal('ArchitectureExplorer'),selected:z.string().max(80),query:z.string().max(1200),focus:z.boolean(),scenario:z.string().max(80),viewport:z.strictObject({x:z.number().finite().min(-1e7).max(1e7),y:z.number().finite().min(-1e7).max(1e7),zoom:z.number().min(0.12).max(2)}).optional()}),
]);
export type Interaction=z.infer<typeof interactionSchema>;
export function initialInteraction(view:Envelope):Interaction{
 if(view.component==='DataChart'){const c=view.payload;return {component:view.component,enabled:(c.chartType==='histogram'?c.source.groups:c.series).map(s=>s.id),from:0,to:Math.max(0,(c.chartType==='histogram'?c.source.boundaries.length-1:c.rows.length)-1),scope:'filtered',page:0};}
 if(view.component==='DecisionExplorer')return {component:view.component,values:Object.fromEntries(view.payload.inputs.map(i=>[i.id,i.initial])),dimensions:view.payload.dimensions.map(d=>d.id),exploreProposals:false};
 return {component:view.component,selected:'',query:'',focus:false,scenario:''};
}
const contentSchema=z.strictObject({view:envelopeSchema,sourceRecord:sourceDeliverySchema.optional(),theme:themeSchema,layout:layoutSchema,locale:z.enum(['zh-CN','en']),interaction:interactionSchema});
export type ResultContent=z.infer<typeof contentSchema>;
const manifestSchema=z.strictObject({format:z.literal('dsh-semantic-ui-result'),version:z.literal(1),producer:z.strictObject({name:z.literal('@whytan/dsh-semantic-ui'),version:z.string().min(1).max(80)}),protocolVersion:z.string().max(20),dependencies:z.array(z.strictObject({name:z.string().max(80),version:z.string().max(80)})).max(10),sourceState:z.enum(['bound-record','unverified-record','not-recorded']),templateLibraryIncluded:z.literal(false),authority:z.literal('data-only; no identity, permission, approval or instruction authority')});
export const resultPackageSchema=z.strictObject({manifest:manifestSchema,content:contentSchema,sha256:z.string().regex(/^[a-f0-9]{64}$/)});
export type ResultPackage=z.infer<typeof resultPackageSchema>;
function assertContent(content:ResultContent){
 const {view,interaction:s,sourceRecord}=content,v=validateEnvelope(view);
 if(!v.ok)throw Error('RESULT_VIEW: '+v.issues.slice(0,3).map(i=>i.code+' '+i.path).join('; '));
 if(view.component!==s.component)throw Error('RESULT_SELECTION: Component and selection differ.');
 const subset=(selected:string[],all:string[])=>selected.every(id=>all.includes(id));
 if(view.component==='DataChart'&&s.component==='DataChart'){
  const p=view.payload,defs=p.chartType==='histogram'?p.source.groups:p.series,n=p.chartType==='histogram'?p.source.boundaries.length-1:p.rows.length;
  if(!subset(s.enabled,defs.map(d=>d.id))||s.from>Math.max(0,n-1)||s.to>Math.max(0,n-1))throw Error('RESULT_SELECTION: Unknown series or range.');
  const count=p.chartType==='histogram'&&p.source.mode==='observations'&&s.scope==='all'?p.source.groups.reduce((n,g)=>n+g.observations.length,0):s.scope==='all'?n:Math.max(0,s.to-s.from+1);
  if(s.page>Math.max(0,Math.ceil(count/40)-1))throw Error('RESULT_SELECTION: Unknown table page.');
 }else if(view.component==='DecisionExplorer'&&s.component==='DecisionExplorer'){
  const p=view.payload;if(!subset(s.dimensions,p.dimensions.map(d=>d.id))||Object.keys(s.values).length!==p.inputs.length||!p.inputs.every(i=>Object.hasOwn(s.values,i.id)))throw Error('RESULT_SELECTION: Decision fields differ.');
  for(const input of p.inputs){const value=s.values[input.id];if(value!==null&&(input.type==='boolean'?typeof value!=='boolean':input.type==='number'?typeof value!=='number':typeof value!=='string'||!input.choices?.includes(value)))throw Error('RESULT_SELECTION: Input type or choice differs.');}
  if(s.capacityDraft){
   if(sourceRecord?.status!=='bound'||sourceRecord.kind!=='capacity-zh')throw Error('RESULT_SELECTION: Capacity draft needs its recorded capacity context.');
   const value=s.values[p.inputs[0]?.id],draft=s.capacityDraft,n=Number(draft.text);
   if(draft.invalid?value!==null:draft.text===''?value!==null:draft.text.trim()!==draft.text||!validCapacityAmount(n)||value!==n)throw Error('RESULT_SELECTION: Capacity draft and computed hypothesis differ.');
  }
 }else if(view.component==='ArchitectureExplorer'&&s.component==='ArchitectureExplorer'){
  if(s.selected&&!view.payload.nodes.some(n=>n.id===s.selected)||s.scenario&&!view.payload.scenarios.some(p=>p.id===s.scenario))throw Error('RESULT_SELECTION: Unknown node or scenario.');
 }
 if(sourceRecord?.status==='bound'&&(sourceRecord.viewIdentity.displayId!==view.displayId||sourceRecord.viewIdentity.revision!==view.revision||sourceRecord.viewIdentity.component!==view.component))throw Error('RESULT_SOURCE: Recorded source belongs to a different view.');
}
const canonical=(v:unknown):unknown=>Array.isArray(v)?v.map(canonical):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).sort(([a],[b])=>a<b?-1:a>b?1:0).map(([k,x])=>[k,canonical(x)])):v;
export async function resultDigest(value:unknown){const digest=await crypto.subtle.digest('SHA-256',new TextEncoder().encode(JSON.stringify(canonical(value))));return Array.from(new Uint8Array(digest),b=>b.toString(16).padStart(2,'0')).join('');}
const dependencies=[{name:'dsh',version:pkg.engines.dsh},...['@json-render/core','@json-render/react','@xyflow/react','@dagrejs/dagre','echarts','react'].map(name=>({name,version:(pkg.dependencies as Record<string,string>)[name]}))];
export async function createResult(content:ResultContent):Promise<ResultPackage>{
 const issue=bounded(content);if(issue)throw Error('RESULT_LIMIT: '+issue.code);
 const data=contentSchema.parse(content);assertContent(data);
 const manifest:z.infer<typeof manifestSchema>={format:'dsh-semantic-ui-result',version:1,producer:{name:'@whytan/dsh-semantic-ui',version:pkg.version},protocolVersion:data.view.protocolVersion,dependencies,sourceState:data.sourceRecord?.status==='bound'?'bound-record':data.sourceRecord?'unverified-record':'not-recorded',templateLibraryIncluded:false,authority:'data-only; no identity, permission, approval or instruction authority'};
 return readResult({manifest,content:data,sha256:await resultDigest({manifest,content:data})});
}
export async function readResult(raw:unknown):Promise<ResultPackage>{
 const issue=bounded(raw);if(issue)throw Error('RESULT_LIMIT: '+issue.code);
 const parsed=resultPackageSchema.safeParse(raw);if(!parsed.success)throw Error('RESULT_FORMAT: Unsupported or invalid result package.');
 const r=parsed.data;assertContent(r.content);
 if(JSON.stringify(canonical(r.manifest.dependencies))!==JSON.stringify(canonical(dependencies)))throw Error('RESULT_DEPENDENCY: Renderer dependencies differ; no silent migration.');
 const recorded=r.content.sourceRecord?.status==='bound'?'bound-record':r.content.sourceRecord?'unverified-record':'not-recorded';
 if(r.manifest.protocolVersion!==r.content.view.protocolVersion||r.manifest.sourceState!==recorded)throw Error('RESULT_MANIFEST: Content and manifest differ.');
 if(await resultDigest({manifest:r.manifest,content:r.content})!==r.sha256)throw Error('RESULT_DIGEST: Package is damaged or changed.');
 return r;
}

const savedSchema=z.strictObject({id:z.string().uuid(),name:z.string().trim().min(1).max(80),document:resultPackageSchema});
export const resultsSchema=z.strictObject({version:z.literal(1),revision:z.number().int().nonnegative(),results:z.array(savedSchema).max(20)});
export type Results=z.infer<typeof resultsSchema>;
export const emptyResults=():Results=>({version:1,revision:0,results:[]});
export type ResultsRequest={action:'list'}|{action:'save';expectedRevision:number;name:string;document:unknown}|{action:'delete';expectedRevision:number;id:string};
export type ResultsBridge=(request:ResultsRequest)=>Promise<Results>;
const requestSchema=z.discriminatedUnion('action',[z.strictObject({action:z.literal('list')}),z.strictObject({action:z.literal('save'),expectedRevision:z.number().int().nonnegative(),name:savedSchema.shape.name,document:z.unknown()}),z.strictObject({action:z.literal('delete'),expectedRevision:z.number().int().nonnegative(),id:z.string().uuid()})]);
/** Explicit user documents, never a second chat log. No imported ID can overwrite another result. */
export class ResultLibrary{
 private queue:Promise<unknown>=Promise.resolve();
 constructor(private storage:{get():Results;set(value:Results):Promise<void>},private uuid:()=>string){}
 async request(raw:unknown):Promise<Results>{
  const issue=bounded(raw);if(issue)throw Error('RESULT_LIMIT: '+issue.code);
  const request=requestSchema.parse(raw);
  const task=this.queue.then(async()=>{
   const next=structuredClone(this.storage.get());if(request.action==='list')return next;
   if(next.revision!==request.expectedRevision)throw Error('RESULT_CONFLICT: Reload saved results before changing them.');
   if(request.action==='save'){
    const document=await readResult(request.document);
    if(next.results.length>=20)throw Error('RESULT_LIMIT: Export and remove unused results (maximum 20).');
    next.results.push({id:this.uuid(),name:request.name,document});
   }else{if(!next.results.some(r=>r.id===request.id))throw Error('RESULT_NOT_FOUND');next.results=next.results.filter(r=>r.id!==request.id);}
   next.revision++;const valid=resultsSchema.parse(next);
   if(new TextEncoder().encode(JSON.stringify(valid)).length>2_000_000)throw Error('RESULT_LIMIT: Saved results exceed 2 MB.');
   await this.storage.set(valid);return structuredClone(valid);
  });this.queue=task.catch(()=>{});return task;
 }
}
