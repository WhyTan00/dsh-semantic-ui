import {describe,it,expect,vi} from 'vitest';
import {randomUUID} from 'node:crypto';
import {architecture,chart,decision,distribution} from '../fixtures/examples';
import {TemplateLibrary,emptyLibrary,extractDefinition,exportTemplate,parseBounded,exportSchema,matchTemplate,validatedView,type Library} from '../src/templates';
import {defaultTheme,defaultLayout,themeTokens} from '../src/theme';
import {validateEnvelope} from '../src/protocol';
import {chartFacts,decisionFacts} from '../src/facts';
import {profileDomainName,libraryResponse} from '../src/dsh/library';
import {apply} from '../src/dsh/host';
import {createPresentationChannel} from '../src/dsh/presentation';
import {checkpointOf} from '../src/dsh/definition';

function setup(){let data=emptyLibrary();const storage={get:()=>data,set:vi.fn(async(next:Library)=>{data=structuredClone(next);})};return {storage,library:new TemplateLibrary(storage,randomUUID)};}
const save=(library:TemplateLibrary,extra:Record<string,unknown>={})=>library.request({action:'save',expectedRevision:library.snapshot().revision,name:'Daily chart',definition:extractDefinition(validatedView(chart)),theme:defaultTheme,layout:defaultLayout,...extra});

describe('private reusable template lifecycle',()=>{
  it('validates the native request envelope and rejects oversized or non-JSON bodies',async()=>{
    const {library}=setup(),target='http://fixture/api/dsh-semantic-ui/library';
    const request=(body:string,type='application/json')=>new Request(target,{method:'POST',headers:{'content-type':type},body});
    expect((await libraryResponse(library,request('{}','text/plain'))).status).toBe(415);
    expect((await libraryResponse(library,request('{'))).status).toBe(400);
    expect((await libraryResponse(library,request(' '.repeat(140001)))).status).toBe(413);
    expect((await libraryResponse(library,request(JSON.stringify({type:'client-request',rpcId:randomUUID(),method:'wrong',payload:{action:'list'}})))).status).toBe(400);
    expect(library.snapshot().revision).toBe(0);
  });
  it('isolates profiles sharing a host storage root',()=>{expect(profileDomainName('web')).not.toBe(profileDomainName('other'));expect(profileDomainName('web')).toBe(profileDomainName('web'));expect(profileDomainName('web')).toMatch(/^[a-z][a-z0-9_]*$/);});
  it('persists and reopens versions, restores the current pointer, and never overwrites history',async()=>{
    const {library,storage}=setup();const first=await save(library),id=first.templates[0].id;
    await save(library,{id,name:'Revised chart',theme:{...defaultTheme,mode:'dark'}});
    await library.request({action:'restore',expectedRevision:2,id,version:1});
    expect(library.get(id).name).toBe('Daily chart');expect(library.get(id,2).name).toBe('Revised chart');
    await save(library,{id,name:'Third version'});const reopened=new TemplateLibrary(storage,randomUUID);
    expect(reopened.get(id).version).toBe(3);expect(reopened.get(id,2).theme.mode).toBe('dark');
    await reopened.request({action:'delete',expectedRevision:4,id});expect(reopened.snapshot().templates).toEqual([]);expect(()=>reopened.get(id,1)).toThrow('NOT_FOUND');
  });
  it('rejects stale concurrent saves without dropping the first committed edit',async()=>{
    const {library}=setup();const results=await Promise.allSettled([save(library),save(library)]);
    expect(results.map(r=>r.status)).toEqual(['fulfilled','rejected']);expect(library.snapshot().templates).toHaveLength(1);
    if(results[1].status==='rejected')expect(results[1].reason.message).toContain('CONFLICT');
  });
  it('reports success only after durable write and recovers after a failed write',async()=>{
    const {library,storage}=setup();storage.set.mockRejectedValueOnce(Error('disk full'));
    await expect(save(library)).rejects.toThrow('disk full');expect(library.snapshot().revision).toBe(0);
    let release!:()=>void;const gate=new Promise<void>(r=>release=r);const original=storage.set.getMockImplementation()!;storage.set.mockImplementationOnce(async next=>{await gate;await original(next);});
    let complete=false;const pending=save(library).then(()=>complete=true);await Promise.resolve();await Promise.resolve();expect(complete).toBe(false);release();await pending;expect(library.snapshot().revision).toBe(1);
  });
  it('returns copies and imports as a new identity rather than overwriting',async()=>{
    const {library}=setup();const first=await save(library),id=first.templates[0].id,exported=exportTemplate(library.get(id));
    first.templates[0].versions[0].name='mutated';expect(library.get(id).name).toBe('Daily chart');
    await library.request({action:'import',expectedRevision:1,document:exported});const next=library.snapshot();expect(next.templates).toHaveLength(2);expect(next.templates[1].id).not.toBe(id);expect(library.get(next.templates[1].id)).toEqual(library.get(id));
  });
  it('bounds versions and preserves every earlier version when full',async()=>{
    const {library}=setup();const first=await save(library),id=first.templates[0].id;
    for(let version=2;version<=20;version++)await save(library,{id,name:`Version ${version}`});
    await expect(save(library,{id})).rejects.toThrow('20 versions');expect(library.get(id).version).toBe(20);expect(library.get(id,1).name).toBe('Daily chart');
  });
  it('rejects unsupported formats, executable fields, oversized and polluted imports',()=>{
    const document={format:'dsh-semantic-ui-template',version:1,template:{name:'Example',definition:extractDefinition(validatedView(chart)),theme:defaultTheme,layout:defaultLayout}};
    for(const value of [{...document,version:2},{...document,script:'run()'},{...document,template:{...document.template,theme:{...defaultTheme,css:'body{}'}}},{...document,template:{...document.template,name:'x'.repeat(140000)}},JSON.parse('{"__proto__":{}}')])expect(()=>parseBounded(exportSchema,value)).toThrow();
    expect(()=>parseBounded(exportSchema,{...document,template:{...document.template,definition:{component:'DecisionExplorer',dimensions:[{id:'x',label:'X'},{id:'x',label:'Y'}],inputs:[]}}})).toThrow('unique');
  });
  it('excludes actual data, conclusions, condition values, rules and source prose from every export',async()=>{
    for(const fixture of [architecture,decision,chart,distribution]){
      const {library}=setup();const v=validatedView(fixture);v.summary='PRIVATE_SUMMARY';v.payload.title='PRIVATE_TITLE';
      if(v.component==='ArchitectureExplorer'){v.payload.nodes[0].responsibility='PRIVATE_NODE';v.payload.nodes[0].evidence=['PRIVATE_EVIDENCE'];}
      if(v.component==='DecisionExplorer'){v.payload.options[0].values[v.payload.dimensions[0].id]='PRIVATE_VALUE';v.payload.rules[0].reason='PRIVATE_RULE';}
      if(v.component==='DataChart')v.payload.fullDataExplanation='PRIVATE_EXPLANATION';
      const saved=await save(library,{definition:extractDefinition(v)});const output=JSON.stringify(exportTemplate(saved.templates[0].versions[0]));
      expect(output).not.toContain('PRIVATE_');for(const forbidden of ['observations','rows','options','rules','evidence','initial','summary','title','nodes','boundaries'])expect(output).not.toContain(`"${forbidden}"`);
    }
  });
});

describe('fresh-data reuse and appearance snapshots',()=>{
  it('validates new fields and units without filling or altering facts',async()=>{
    const {library}=setup();const first=await save(library),template=library.get(first.templates[0].id),fresh=validatedView(chart);
    if(fresh.component!=='DataChart'||fresh.payload.chartType==='histogram')throw Error('fixture');
    fresh.payload.rows[0].values.a=999;fresh.payload.series[0].label='New sensor';const before=structuredClone(fresh);matchTemplate(template,fresh);expect(fresh).toEqual(before);
    expect(chartFacts(fresh.payload)).not.toEqual(chartFacts((chart as typeof fresh).payload));fresh.payload.unit='wrong';expect(()=>matchTemplate(template,fresh)).toThrow('TEMPLATE_INPUT');
    fresh.payload.unit=before.payload.unit;delete fresh.payload.rows[0].values.a;expect(validateEnvelope(fresh).ok).toBe(false);
  });
  it('stores concrete appearance and exact version in metadata; deletion/default changes cannot rewrite it',async()=>{
    const {library}=setup();const first=await save(library),id=first.templates[0].id;
    const appearance={version:1,theme:{...defaultTheme,mode:'dark' as const},layout:defaultLayout,template:{id,version:1,name:'Daily chart'}};
    const channel=createPresentationChannel(),view=validatedView({...chart,protocolVersion:'1.1',presentation:appearance}),deliveryId=channel.remember({turn:1,view});
    const meta=channel.presentationMeta({}, {status:'delivered',turn:1,displayId:view.displayId,revision:view.revision,deliveryId});
    await library.request({action:'delete',expectedRevision:1,id});await library.request({action:'default',expectedRevision:2,theme:{...defaultTheme,palette:'berry'}});
    for(const type of ['tool/result','tool/ptc-dispatch']){const view=checkpointOf({type,data:{meta}})?.view;expect(view?.presentation).toEqual(appearance);expect(view?.protocolVersion).toBe('1.1');expect(view?.payload).toEqual(chart.payload);}
    expect(validateEnvelope(chart).ok).toBe(true);expect(validateEnvelope({...chart,presentation:appearance}).ok).toBe(false);
    expect(validateEnvelope({...chart,protocolVersion:'1.1',presentation:{...appearance,version:2}}).ok).toBe(false);
  });
  it('theme modes and palettes never alter numeric facts or decisions',()=>{
    for(const mode of ['light','dark']as const)for(const palette of ['ocean','forest','berry']as const){
      const theme={...defaultTheme,mode,palette},view=validatedView({...chart,protocolVersion:'1.1',presentation:{version:1,theme,layout:defaultLayout}});
      if(view.component==='DataChart'&&chart.component==='DataChart')expect(chartFacts(view.payload)).toEqual(chartFacts(chart.payload));
      const d=validatedView({...decision,protocolVersion:'1.1',presentation:{version:1,theme,layout:defaultLayout}});if(d.component==='DecisionExplorer'&&decision.component==='DecisionExplorer')expect(decisionFacts(d.payload)).toEqual(decisionFacts(decision.payload));
    }
  });
  it('keeps normal and muted text at AA contrast and series above 3:1 against backgrounds',()=>{
    const luminance=(hex:string)=>{const c=hex.slice(1).match(/../g)!.map(v=>parseInt(v,16)/255).map(v=>v<=0.04045?v/12.92:((v+0.055)/1.055)**2.4);return c[0]*0.2126+c[1]*0.7152+c[2]*0.0722;};
    const ratio=(a:string,b:string)=>{const x=luminance(a),y=luminance(b);return (Math.max(x,y)+0.05)/(Math.min(x,y)+0.05);};
    for(const mode of ['light','dark']as const)for(const palette of ['ocean','forest','berry']as const){const t=themeTokens({...defaultTheme,mode,palette});for(const bg of [t.background,t.surface,t.tint]){expect(ratio(t.text,bg)).toBeGreaterThanOrEqual(4.5);expect(ratio(t.muted,bg)).toBeGreaterThanOrEqual(4.5);for(const color of t.colors)expect(ratio(color,bg)).toBeGreaterThanOrEqual(3);}}
  });
  it('uses the real tool to pin a template and returns only compact facts to the model',async()=>{
    const {storage}=setup();let handler:any;const pending:Promise<unknown>[]=[];const ctx:any={profileContext:{name:'web'},storageDomain:{open:async()=>({global:storage,close:async()=>{}})},effect:(cb:any)=>cb(),connection:{fetch:{register:(route:any)=>{handler=async(_endpoint:string,payload:unknown)=>{const response=await route.fetch(new Request('http://fixture/api/dsh-semantic-ui/library',{method:'POST',headers:{'content-type':'application/json'},body:JSON.stringify({type:'client-request',rpcId:randomUUID(),method:'dsh-semantic-ui/library',payload})}));return (await response.json()).result;};return async()=>{};}}},inject:(names:string[],cb:any)=>{if(names.includes('storageDomain'))pending.push(cb(ctx));},systemPrompt:{section:vi.fn()},tools:{register:vi.fn()},sessionProjections:{register:vi.fn(),stateOf:()=>({lastTurn:1,openTurnStartSeq:1})}};
    apply(ctx);await Promise.all(pending);const signal=new AbortController().signal;
    const saved=await handler('library',{action:'save',expectedRevision:0,name:'Native chart',definition:extractDefinition(validatedView(chart)),theme:{...defaultTheme,mode:'dark'},layout:defaultLayout},signal,{principal:{kind:'owner'}});expect(saved.ok).toBe(true);
    const t=saved.value.templates[0],tool=ctx.tools.register.mock.calls[0][0],exec={signal,agent:{session:{}},callId:'test'};
    const checkedOnly=await tool.execute({action:'check',view:chart},{signal});expect(checkedOnly.status).toBe('validated');expect(checkedOnly).toHaveProperty('dataFacts');expect(tool.output.presentationMeta({view:chart},checkedOnly)).toBe(null);
    const args={action:'render',view:chart,templateId:t.id,templateVersion:1},result=await tool.execute(args,exec);expect(result).not.toHaveProperty('view');expect(result.presentation.template).toEqual({id:t.id,version:1,name:'Native chart'});expect(checkpointOf({type:'tool/result',data:{meta:tool.output.presentationMeta(args,result)}})?.view?.payload).toEqual(chart.payload);
    const {templateVersion:_,...missingVersion}=args;await expect(tool.execute(missingVersion,exec)).rejects.toThrow('TEMPLATE_VERSION');
  });
});
