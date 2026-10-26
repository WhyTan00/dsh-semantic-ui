import {it,expect,vi} from 'vitest';
import {bindPermissionView} from '../src/source-delivery';
import {validateForDelivery} from '../src/core';
import {checkSourcePermissions} from '../src/source-permissions';
import {currentSourceProjection} from '../src/dsh/source';
import {apply} from '../src/dsh/host';
import {definition,checkpointOf} from '../src/dsh/definition';
import {createPresentationChannel} from '../src/dsh/presentation';
import {META} from '../src/dsh/events';
import {a3Record,a3FirstView,permissionProjectionA3} from '../fixtures/source-permissions';
import {architecture} from '../fixtures/examples';
import {readSourceSnapshot} from '../src/source-input';
const poison='UNVERIFIED_GLOBAL_UNIQUE_AND_FAILURE_INDEPENDENT';
function annotated(){const v=permissionProjectionA3();if(v.component!=='ArchitectureExplorer')throw Error();v.summary=poison;v.payload.title=poison;for(const n of v.payload.nodes){n.responsibility=poison;n.constraints=[poison];n.evidence=[poison];}v.payload.edges[0].label=poison;v.payload.scenarios=[{id:'path',label:poison,nodeIds:['client','gateway','search','index'],edgeIds:['e-client-gw','e-gw-search','e-search-index'],explanation:poison}];return v;}
function setup(text=a3Record.question){
 let state=currentSourceProjection.init({id:'delivery-fixture'} as any,0 as any);
 const setTurn=(text:string,turn=1)=>{state=currentSourceProjection.apply(state,{type:'turn/start',seq:turn*10,data:{turn}} as any);state=currentSourceProjection.apply(state,{type:'user/message',seq:turn*10+1,data:{id:'message-'+turn,role:'user',source:{kind:'user'},content:[{type:'text',text}]}} as any);};setTurn(text);
 const ctx={tools:{register:vi.fn()},sessionProjections:{register:vi.fn(),stateOf:vi.fn((_s,key)=>key==='turnBoundary'?{lastTurn:state.turn,openTurnStartSeq:state.startSeq}:state)},systemPrompt:{section:vi.fn()},inject:vi.fn()};apply(ctx as any);
 return {tool:ctx.tools.register.mock.calls[0][0],exec:{agent:{session:{id:'delivery-fixture'}},signal:new AbortController().signal,callId:'fixture'},setTurn};
}
it('builds a fresh source projection including pair/local limits and topology-only path text, not a keyword deletion',async()=>{
 const source=await readSourceSnapshot({file:'docs/evidence/natural/r9-A3.json',jsonPointer:'/question',kind:'permissions-zh'}),input=annotated(),before=JSON.stringify(input),checked=validateForDelivery(input);if(!checked.ok)throw Error();
 const r=bindPermissionView(source,checked.value);expect(r.ok).toBe(true);if(!r.ok)throw Error();expect(JSON.stringify(input)).toBe(before);expect(JSON.stringify(r.view)).not.toContain(poison);expect(r.view).toHaveProperty('payload.title','来源声明的直接访问与权限');expect(r.view).toHaveProperty('payload.scenarios.0.explanation',expect.stringContaining('拓扑路径'));
 expect(checkSourcePermissions(source,{view:r.view})).toHaveProperty('comparison.status','matched');expect(r.explanation).toContain('禁止 Search → Store');expect(r.explanation).toContain('不限制其它主体');
});
it('refuses unknown aliases, reversed access, prohibited positive edges and wrong read/write before staging',async()=>{
 const {tool,exec}=setup();for(const v of [a3FirstView,(()=>{const v=annotated();v.payload.edges[1].source='search';v.payload.edges[1].target='gateway';return v;})(),(()=>{const v=annotated();v.payload.edges.push({id:'forbidden',source:'search',target:'store',directed:true,type:'access',evidence:[]});return v;})(),(()=>{const v=annotated();v.payload.edges[3].type='read-write';v.payload.edges[3].label='读写';return v;})()]){
  const r=await tool.execute({action:'render',view:v},exec);expect(r.status).toBe('validation-failed');const cp=checkpointOf({type:'tool/result',data:{meta:tool.output.presentationMeta({},r)}});expect(cp?.view).toBeUndefined();expect(cp?.issues?.length).toBeGreaterThan(0);
 }
});
it('does not reuse a prior source check, fake proof, previous input or another revision to authorize render',async()=>{
 const {tool,exec,setTurn}=setup();expect(await tool.execute({action:'source-check',view:permissionProjectionA3()},exec)).toHaveProperty('comparison.status','matched');
 const v=annotated();const delivered=await tool.execute({action:'render',view:v},exec);expect(delivered.sourceDeliveryStatus).toBe('bound');
 for(const key of ['sourceText','sourceKind','sourceDelivery','deliveryId','checkedView','authority'])expect(await tool.execute({action:'render',view:v,[key]:delivered.deliveryId},exec)).toHaveProperty('issues.0.code','RENDER_ARGUMENT');
 setTurn(a3Record.question.replace('Search 只读 Index','Search 读写 Index'),2);expect(await tool.execute({action:'render',view:{...v,revision:2}},exec)).toHaveProperty('status','validation-failed');
});
it('persists only the checked final snapshot across JSON cloning, argument mutation and one-use metadata consumption',async()=>{
 const {tool,exec}=setup(),args={action:'render',view:annotated()},r=await tool.execute(args,exec);expect(r).not.toHaveProperty('view');expect(JSON.stringify(r)).not.toContain(poison);args.view.summary='MUTATED';args.view.revision=999;
 const meta=tool.output.presentationMeta(args,JSON.parse(JSON.stringify(r))),cp=checkpointOf({type:'tool/ptc-dispatch',data:{meta}})!;expect(cp.view?.revision).toBe(1);expect(JSON.stringify(cp)).not.toContain(poison);expect(JSON.stringify(cp)).not.toContain('MUTATED');expect(cp.sourceDelivery?.status).toBe('bound');expect(tool.output.presentationMeta(args,r)).toBeNull();
 const restored=definition.start!({} as any,{event:{type:'tool/result',data:{meta}}} as any,{} as any);expect(restored).toMatchObject({view:cp.view,sourceDelivery:cp.sourceDelivery});
});
it('keeps stale metadata from authorizing a new turn/revision and detects same-revision provenance conflicts',async()=>{
 const {tool,exec}=setup(),r=await tool.execute({action:'render',view:annotated()},exec),meta=tool.output.presentationMeta({},r),cp=checkpointOf({type:'tool/result',data:{meta}})!;
 for(const changed of [{...cp,turn:2},{...cp,view:{...cp.view!,revision:2}}]){const state=definition.start!({} as any,{event:{type:'tool/result',data:{meta:{[META]:changed}}}} as any,{} as any);expect(state).toHaveProperty('issues.0.code','SOURCE_CHECKPOINT_MISMATCH');expect(state).not.toHaveProperty('view');}
 const state=definition.start!({} as any,{event:{type:'tool/result',data:{meta}}} as any,{} as any),copy=structuredClone(cp);if(copy.sourceDelivery?.status!=='bound')throw Error();copy.sourceDelivery.sourceRef.textSha256='0'.repeat(64);
 expect(definition.update!({state} as any,{event:{type:'tool/result',data:{meta:{[META]:copy}}}} as any)).toHaveProperty('issues.0.code','REVISION_CONFLICT');
});
it('refuses incomplete permission source and marks unrelated generic delivery explicitly unverified',async()=>{
 const bad=setup(a3Record.question.replace('。请','；Search不访问Index。请'));expect(await bad.tool.execute({action:'render',view:annotated()},bad.exec)).toHaveProperty('status','validation-failed');
 const generic=setup('Explain a bounded fictional architecture with the normal generic renderer.'),r=await generic.tool.execute({action:'render',view:architecture},generic.exec),cp=checkpointOf({type:'tool/result',data:{meta:generic.tool.output.presentationMeta({},r)}})!;expect(r.sourceDeliveryStatus).toBe('unverified');expect(cp.sourceDelivery).toHaveProperty('status','unverified');expect(cp.view?.payload).toEqual(architecture.payload);
});
it('rejects forged or misassociated handles rather than reconstructing a view from args',()=>{
 const c=createPresentationChannel(),key=c.remember({turn:1,view:architecture});expect(c.presentationMeta({view:architecture},{turn:1,displayId:architecture.displayId,revision:architecture.revision,deliveryId:'forged'})).toBeNull();expect(c.presentationMeta({}, {turn:2,displayId:architecture.displayId,revision:architecture.revision,deliveryId:key})).toBeNull();expect(c.presentationMeta({}, {turn:1,displayId:architecture.displayId,revision:architecture.revision,deliveryId:key})).toBeNull();
});
it('replaces an earlier bound frame with a refusal when a new revision fails the fresh source check',async()=>{
 const {tool,exec}=setup(),first=await tool.execute({action:'render',view:annotated()},exec),meta=tool.output.presentationMeta({},first),state=definition.start!({} as any,{event:{type:'tool/result',data:{meta}}} as any,{} as any);
 const bad=annotated();bad.revision=2;bad.payload.edges[3].type='read-write';bad.payload.edges[3].label='读写';const refused=await tool.execute({action:'render',view:bad},exec),failedMeta=tool.output.presentationMeta({},refused),next=definition.update!({state} as any,{event:{type:'tool/result',data:{meta:failedMeta}}} as any);
 expect(next).not.toHaveProperty('view');expect(next).not.toHaveProperty('sourceDelivery');expect(next).toHaveProperty('issues.0.code','SOURCE_ACCESS_MODE');
});
it('handles renamed IDs, another lawful writer and an entity mentioned only as a prohibited caller without inventing its role',async()=>{
 const text=a3Record.question.replace('。请','；Backup读写Store；禁止Auditor访问Store。请'),v=annotated();v.payload.nodes.push({id:'backup',label:'Backup',responsibility:poison,constraints:[poison],evidence:[]},{id:'auditor',label:'Auditor',responsibility:poison,constraints:[poison],evidence:[]});v.payload.edges.push({id:'other-write',source:'backup',target:'store',directed:true,type:'read-write',label:'读写',evidence:[]});
 const ids=new Map(v.payload.nodes.map((n,i)=>[n.id,'renamed-'+i])),edgeIds=new Map(v.payload.edges.map((e,i)=>[e.id,'relation-'+i]));v.payload.nodes.forEach(n=>n.id=ids.get(n.id)!);v.payload.edges.forEach(e=>{e.id=edgeIds.get(e.id)!;e.source=ids.get(e.source)!;e.target=ids.get(e.target)!;});v.payload.scenarios.forEach(s=>{s.nodeIds=s.nodeIds.map(id=>ids.get(id)!);s.edgeIds=s.edgeIds.map(id=>edgeIds.get(id)!);});v.payload.nodes.reverse();v.payload.edges.reverse();
 const {tool,exec}=setup(text),r=await tool.execute({action:'render',view:v},exec),cp=checkpointOf({type:'tool/result',data:{meta:tool.output.presentationMeta({},r)}})!;expect(r.sourceDeliveryStatus).toBe('bound');if(cp.view?.component!=='ArchitectureExplorer')throw Error();expect(cp.view.payload.nodes.find(n=>n.label==='Auditor')?.responsibility).toBe('业务职责未声明；访问边界仅以明确的关系和限制为准。');expect(cp.view.payload.nodes.find(n=>n.label==='Auditor')?.constraints).toEqual(['禁止该主体直接访问 Store。']);expect(r.canonicalExplanation).toContain('Backup → Store');expect(JSON.stringify(cp)).not.toContain(poison);
});
