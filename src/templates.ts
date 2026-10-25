import {z} from 'zod';
import {bounded,validateEnvelope,type Envelope,chartSchema,decisionSchema} from './protocol';
import {themeSchema,layoutSchema,defaultTheme,defaultLayout,type Theme,type Layout} from './theme';

const field=z.strictObject({id:z.string().regex(/^[a-zA-Z0-9][a-zA-Z0-9_.:-]{0,79}$/),label:z.string().min(1).max(80)});
const input=decisionSchema.shape.inputs.unwrap().element.omit({initial:true});
const chart=chartSchema.options[0];
export const contractSchema=z.discriminatedUnion('component',[
  z.strictObject({component:z.literal('ArchitectureExplorer')}),
  z.strictObject({component:z.literal('DecisionExplorer'),dimensions:decisionSchema.shape.dimensions,inputs:z.array(input).max(12)}),
  z.strictObject({component:z.literal('DataChart'),chartType:z.enum(['line','bar']),unit:chart.shape.unit,x:chart.shape.x,series:z.array(field).min(1).max(8)}),
  // Zod discriminated unions cannot share a discriminator: histograms use a
  // separate nested chart contract below instead (see definitionSchema).
]);
const chartContract=z.discriminatedUnion('chartType',[
  contractSchema.options[2].omit({component:true}),
  z.strictObject({chartType:z.literal('histogram'),unit:chart.shape.unit,display:z.enum(['count','proportion'])}),
]);
export const definitionSchema=z.discriminatedUnion('component',[
  contractSchema.options[0],contractSchema.options[1],
  z.strictObject({component:z.literal('DataChart'),chart:chartContract}),
]).superRefine((d,c)=>{
  const fail=(message:string)=>c.addIssue({code:'custom',message});
  const unique=(fields:{id:string}[])=>new Set(fields.map(f=>f.id)).size===fields.length;
  if(d.component==='DecisionExplorer'){
    if(!unique(d.dimensions)||!unique(d.inputs))fail('Field IDs must be unique.');
    for(const dimension of d.dimensions)if(dimension.kind==='number'&&!dimension.unit||dimension.kind==='boolean'&&dimension.unit)fail('Typed dimensions need a numeric unit or a unitless boolean.');
    for(const input of d.inputs)if(input.type==='choice'&&(!input.choices?.length||new Set(input.choices).size!==input.choices.length))fail('Choice fields require unique nonempty choices.');
  }
  if(d.component==='DataChart'&&d.chart.chartType!=='histogram'){
    if(!unique(d.chart.series))fail('Series IDs must be unique.');
    if(d.chart.x.kind==='time'){
      if(!d.chart.x.timezone||!d.chart.x.granularity)fail('Time fields require timezone and granularity.');
      try{new Intl.DateTimeFormat('en',{timeZone:d.chart.x.timezone});}catch{fail('Invalid IANA timezone.');}
    }
  }
});
export type TemplateDefinition=z.infer<typeof definitionSchema>;
export const revisionSchema=z.strictObject({version:z.number().int().min(1).max(20),name:z.string().trim().min(1).max(80),definition:definitionSchema,theme:themeSchema,layout:layoutSchema});
export type TemplateRevision=z.infer<typeof revisionSchema>;
const templateSchema=z.strictObject({id:z.string().uuid(),head:z.number().int().min(1).max(20),versions:z.array(revisionSchema).min(1).max(20)}).superRefine((t,c)=>{
  if(!t.versions.some(v=>v.version===t.head)||t.versions.some((v,i)=>v.version!==i+1))c.addIssue({code:'custom',message:'Template versions must be consecutive and head must exist.'});
});
export const librarySchema=z.strictObject({version:z.literal(1),revision:z.number().int().nonnegative(),defaultTheme:themeSchema,templates:z.array(templateSchema).max(40)}).superRefine((l,c)=>{
  if(new Set(l.templates.map(t=>t.id)).size!==l.templates.length)c.addIssue({code:'custom',message:'Duplicate template IDs.'});
});
export type Library=z.infer<typeof librarySchema>;
export const emptyLibrary=():Library=>({version:1,revision:0,defaultTheme:{...defaultTheme},templates:[]});
export const exportSchema=z.strictObject({format:z.literal('dsh-semantic-ui-template'),version:z.literal(1),template:revisionSchema.omit({version:true})});

/** An explicit allowlist: no values, nodes, options, rules, evidence or prose. */
export function extractDefinition(view:Envelope):TemplateDefinition{
  if(view.component==='ArchitectureExplorer')return {component:view.component};
  if(view.component==='DecisionExplorer')return {component:view.component,dimensions:structuredClone(view.payload.dimensions),inputs:view.payload.inputs.map(({initial:_,...definition})=>structuredClone(definition))};
  const p=view.payload;
  return {component:view.component,chart:p.chartType==='histogram'?{chartType:p.chartType,unit:p.unit,display:p.display}:{chartType:p.chartType,unit:p.unit,x:{...p.x},series:structuredClone(p.series)}};
}
export function parseBounded<T>(schema:z.ZodType<T>,value:unknown):T{
  const issue=bounded(value);if(issue)throw Error(`${issue.code}: ${issue.reason}`);
  const result=schema.safeParse(value);if(!result.success)throw Error(`INVALID: ${result.error.issues.slice(0,4).map(i=>`${i.path.join('.')}: ${i.message}`).join('; ')}`);
  return result.data;
}
/** New data is validated as a full envelope; templates never fill facts. */
export function matchTemplate(template:TemplateRevision,view:Envelope):void{
  const expected=template.definition,actual=extractDefinition(view);
  // Labels are presentation text for each new dataset. IDs, units, kinds and
  // choice domains are the contract; array order is part of that contract.
  const withoutLabels=(v:unknown):unknown=>Array.isArray(v)?v.map(withoutLabels):v&&typeof v==='object'?Object.fromEntries(Object.entries(v).filter(([k])=>k!=='label').map(([k,x])=>[k,withoutLabels(x)])):v;
  if(JSON.stringify(withoutLabels(expected))!==JSON.stringify(withoutLabels(actual)))throw Error('TEMPLATE_INPUT: Fresh data does not match the saved field IDs, units, types, order or chart mode. Inspect action=template; use a different template or save a new one.');
}
export type LibraryRequest=
  |{action:'list'}
  |{action:'save';expectedRevision:number;name:string;definition:TemplateDefinition;theme:Theme;layout:Layout;id?:string}
  |{action:'restore';expectedRevision:number;id:string;version:number}
  |{action:'delete';expectedRevision:number;id:string}
  |{action:'default';expectedRevision:number;theme:Theme}
  |{action:'import';expectedRevision:number;document:unknown};
export type LibraryBridge=(request:LibraryRequest)=>Promise<Library>;
const mutation={expectedRevision:z.number().int().nonnegative()};
const requestSchema=z.discriminatedUnion('action',[
  z.strictObject({action:z.literal('list')}),
  z.strictObject({action:z.literal('save'),...mutation,name:revisionSchema.shape.name,definition:definitionSchema,theme:themeSchema,layout:layoutSchema,id:z.string().uuid().optional()}),
  z.strictObject({action:z.literal('restore'),...mutation,id:z.string().uuid(),version:z.number().int().min(1).max(20)}),
  z.strictObject({action:z.literal('delete'),...mutation,id:z.string().uuid()}),
  z.strictObject({action:z.literal('default'),...mutation,theme:themeSchema}),
  z.strictObject({action:z.literal('import'),...mutation,document:exportSchema}),
]);
export function exportTemplate(revision:TemplateRevision){const {version:_,...template}=revision;return parseBounded(exportSchema,{format:'dsh-semantic-ui-template',version:1,template});}

export interface LibraryStorage{get():Library;set(value:Library):Promise<void>}
/** Serialize compare-and-write as one operation, including durable completion. */
export class TemplateLibrary{
  private queue:Promise<unknown>=Promise.resolve();
  constructor(private storage:LibraryStorage,private uuid:()=>string){}
  snapshot(){return structuredClone(this.storage.get());}
  get(id:string,version?:number){
    const t=this.storage.get().templates.find(t=>t.id===id),v=t?.versions.find(v=>v.version===(version??t.head));
    if(!t||!v)throw Error('TEMPLATE_NOT_FOUND: Select an existing template and version.');
    return structuredClone(v);
  }
  async request(raw:unknown):Promise<Library>{
    const request=parseBounded(requestSchema,raw);
    const run=this.queue.then(async()=>{
      if(request.action==='list')return this.snapshot();
      const next=this.snapshot();
      if(request.expectedRevision!==next.revision)throw Error('CONFLICT: Library changed in another view. Reload the library before saving.');
      if(request.action==='default')next.defaultTheme=request.theme;
      else if(request.action==='save'||request.action==='import'){
        const data=request.action==='import'?request.document.template:{name:request.name,definition:request.definition,theme:request.theme,layout:request.layout};
        // Imported records always get a fresh ID. Never silently overwrite.
        const id=request.action==='save'?request.id:undefined;
        if(id){const t=next.templates.find(t=>t.id===id);if(!t)throw Error('TEMPLATE_NOT_FOUND');if(t.versions.length>=20)throw Error('LIMIT: 20 versions; save a copy.');if(t.versions[0].definition.component!==data.definition.component)throw Error('COMPONENT: Save a different component as a new template.');t.head=t.versions.length+1;t.versions.push({...data,version:t.head});}
        else{if(next.templates.length>=40)throw Error('LIMIT: 40 templates; delete one before saving.');next.templates.push({id:this.uuid(),head:1,versions:[{...data,version:1}]});}
      }else{
        const t=next.templates.find(t=>t.id===request.id);if(!t)throw Error('TEMPLATE_NOT_FOUND');
        if(request.action==='delete')next.templates=next.templates.filter(t=>t.id!==request.id);
        else{if(!t.versions.some(v=>v.version===request.version))throw Error('TEMPLATE_VERSION: Unknown version.');t.head=request.version;}
      }
      next.revision++;const valid=librarySchema.parse(next);
      // Bound the entire private library as well as individual RPC inputs.
      if(new TextEncoder().encode(JSON.stringify(valid)).length>2_000_000)throw Error('LIMIT: Library exceeds 2 MB; export and remove unused templates.');
      await this.storage.set(valid);return this.snapshot();
    });
    this.queue=run.catch(()=>{});return run;
  }
}

export function newPresentation(theme:Theme=defaultTheme,layout:Layout=defaultLayout){return {version:1 as const,theme:structuredClone(theme),layout:{...layout}};}
export function validatedView(raw:unknown):Envelope{const result=validateEnvelope(raw);if(!result.ok)throw Error(result.issues.map(i=>`${i.code}: ${i.reason}`).join('; '));return result.value;}
