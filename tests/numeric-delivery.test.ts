import {it,expect,vi} from 'vitest';
import {apply} from '../src/dsh/host';
import {currentSourceProjection} from '../src/dsh/source';
import {bindNumericView} from '../src/source-delivery';
import {createHash} from 'node:crypto';
import type {SourceSnapshot} from '../src/source-graph';
import {checkpointOf,definition} from '../src/dsh/definition';
import {sourceDeliverySchema} from '../src/source-delivery-meta';
import {numericExpected as e,numericRequest} from '../fixtures/source-numeric';
import {chart} from '../fixtures/examples';
const poison='UNVERIFIED_NUMERIC_NOTE';
const request=()=>{const r=JSON.parse(JSON.stringify(numericRequest()));r.view.summary=poison;r.view.payload.title=poison;r.view.payload.fullDataExplanation=poison;r.claims=[{kind:'mean',population:'observed',denominator:3,value:0,unit:e.unit},{kind:'mean',population:'complete',denominator:4,value:null,unit:e.unit}];return r;};
function setup(text=e.question){
 let state=currentSourceProjection.init({id:'numeric-delivery-test'} as any,0 as any);
 const setTurn=(text:string,turn=1)=>{state=currentSourceProjection.apply(state,{type:'turn/start',seq:turn*10,data:{turn}} as any);state=currentSourceProjection.apply(state,{type:'user/message',seq:turn*10+1,data:{id:'message-'+turn,role:'user',source:{kind:'user'},content:[{type:'text',text}]}} as any);};setTurn(text);
 const ctx={tools:{register:vi.fn()},sessionProjections:{register:vi.fn(),stateOf:vi.fn((_s,key)=>key==='turnBoundary'?{lastTurn:state.turn,openTurnStartSeq:state.startSeq}:state)},systemPrompt:{section:vi.fn()},inject:vi.fn()};apply(ctx as any);
 return {tool:ctx.tools.register.mock.calls[0][0],exec:{agent:{session:{id:'numeric-delivery-test'}},signal:new AbortController().signal,callId:'fixture'},setTurn};
}
it('reads the exact current own-turn source then builds a fresh matched chart and range explanation without model annotations',async()=>{
 const {tool,exec}=setup(),r=request(),original=JSON.stringify(r),inspected=await tool.execute({action:'source-check'},exec);expect(inspected.sourceCheckKind).toBe('observations-zh');expect(inspected.sourceStatistics.values).toEqual(e.values);expect(inspected.source.hostContext.producerSourceKind).toBe('user');expect(inspected.source.identityVerified).toBe(false);
 const result=await tool.execute({action:'render',...r},exec),cp=checkpointOf({type:'tool/result',data:{meta:tool.output.presentationMeta({},result)}})!;expect(result.sourceDeliveryStatus).toBe('bound');expect(JSON.stringify(r)).toBe(original);expect(JSON.stringify(cp)).not.toContain(poison);expect(cp.sourceDelivery).toMatchObject({status:'bound',kind:'observations-zh',identityVerified:false,sourceFactsVerified:false,viewIdentity:{component:'DataChart'},sourceRef:{textSha256:e.source.textSha256}});expect(cp.view).toHaveProperty('payload.rows.2.values.series-n2',null);expect(cp.view).not.toHaveProperty('payload.fullDataExplanation');expect(result.canonicalExplanation).toContain('完整4次读数的平均值：未知');
});
it('rejects imputation and incorrect denominator/complete mean before staging; even equal numeric means do not authorize repair',async()=>{
 const {tool,exec}=setup(),bad=request();bad.view.payload.rows[2].values[bad.mapping.seriesId]=0;bad.claims[0].denominator=4;bad.claims[1].value=0;
 const result=await tool.execute({action:'render',...bad},exec);expect(result.status).toBe('validation-failed');expect(result.issues.map((i:any)=>i.code)).toEqual(expect.arrayContaining(['SOURCE_MISSINGNESS','SOURCE_STATISTIC']));const cp=checkpointOf({type:'tool/result',data:{meta:tool.output.presentationMeta({},result)}})!;expect(cp.view).toBeUndefined();expect(cp.sourceDelivery).toBeUndefined();
 const onlyMean=request();onlyMean.claims[0].denominator=4;expect(await tool.execute({action:'render',...onlyMean},exec)).toHaveProperty('issues.0.code','SOURCE_STATISTIC');
});
it('refuses unit/order/mapping and unsupported full-source conflicts rather than binding a matched subset',async()=>{
 for(const mutate of [(r:any)=>r.view.payload.unit='华氏度',(r:any)=>r.view.payload.rows.reverse(),(r:any)=>delete r.mapping]){const {tool,exec}=setup(),r=request();mutate(r);expect(await tool.execute({action:'render',...r},exec)).toHaveProperty('status','validation-failed');}
 const c=setup(e.question+'另外请把缺失算零。');expect(await c.tool.execute({action:'render',...request()},c.exec)).toHaveProperty('status','validation-failed');
 const absent=setup('An unrelated generic source.');expect(await absent.tool.execute({action:'render',...request()},absent.exec)).toHaveProperty('status','validation-failed');
});
it('persists original source/ref/view identity and restores it after the current source changes, never recertifying history',async()=>{
 const {tool,exec,setTurn}=setup(),r=request(),delivered=await tool.execute({action:'render',...r},exec);r.view.payload.rows[2].values[r.mapping.seriesId]=99;r.view.summary='MUTATED';const meta=tool.output.presentationMeta(r,JSON.parse(JSON.stringify(delivered))),cp=checkpointOf({type:'tool/result',data:{meta}})!;setTurn(e.question.replace('缺失','5'),2);
 const state=definition.start!({} as any,{event:{type:'tool/result',data:{meta}}} as any,{} as any);expect(state).toMatchObject({sourceDelivery:cp.sourceDelivery,view:cp.view});expect(JSON.stringify(state)).not.toContain('MUTATED');expect(state).toHaveProperty('sourceDelivery.sourceRef.textSha256',e.source.textSha256);
 const wrong=structuredClone(cp);wrong.view!.revision=2;expect(definition.start!({} as any,{event:{type:'tool/result',data:{meta:{dshSemanticUi:wrong}}}} as any,{} as any)).toHaveProperty('issues.0.code','SOURCE_CHECKPOINT_MISMATCH');
 for(const extra of [{sourceText:e.question},{sourceKind:'observations-zh'},{authority:'human'}])expect(await tool.execute({action:'render',...request(),...extra},exec)).toHaveProperty('issues.0.code','RENDER_ARGUMENT');
});
it('supports independent names/values/IDs through the same binder with an unknown complete mean',async()=>{
 const a=e.independentCounterexample,r=numericRequest(a.values,a.measurement,a.unit,'other'),source:SourceSnapshot={kind:'observations-zh',excerpt:a.text,textSha256:createHash('sha256').update(a.text).digest('hex'),excerptSha256:createHash('sha256').update(a.text).digest('hex'),textBytes:Buffer.byteLength(a.text),textByteStart:0,textByteEnd:Buffer.byteLength(a.text)};const b=bindNumericView(source,r.view,r.mapping);expect(b.ok).toBe(true);if(!b.ok)throw Error();expect(b.explanation).toContain('3 伏');expect(b.explanation).toContain('完整5次读数的平均值：未知');expect(b.view).toHaveProperty('payload.rows.1.values.series-other',null);
});
it('retains legacy metadata-free 1.0 DataChart recovery while refusing forged kind/component metadata',()=>{
 const old={...structuredClone(chart),protocolVersion:'1.0'};expect(definition.start!({} as any,{event:{type:'tool/result',data:{meta:{dshSemanticUi:{turn:1,view:old}}}}} as any,{} as any)).toHaveProperty('view.protocolVersion','1.0');
 expect(sourceDeliverySchema.safeParse({version:1,status:'bound',kind:'permissions-zh',explanation:'x',identityVerified:false,sourceFactsVerified:false,viewIdentity:{displayId:'x',revision:1,component:'DataChart'},sourceRef:{textSha256:'a'.repeat(64),hostContext:{sessionId:'s',turn:1,turnStartSeq:1,messageId:'m',messageSeq:2,producerSourceKind:'user',inherited:false,excludedSyntheticContexts:0}}}).success).toBe(false);
});

it('excludes the pinned public agent-instructions producer without treating other producer labels as user facts',async()=>{
 let s=currentSourceProjection.init({id:'numeric-delivery-test'} as any,0 as any);s=currentSourceProjection.apply(s,{type:'turn/start',seq:1,data:{turn:1}} as any);s=currentSourceProjection.apply(s,{type:'user/message',seq:2,data:{id:'rules',role:'user',source:{kind:'agent-instructions'},content:[{type:'text',text:'A synthetic instruction, never a measurement.'}]}} as any);s=currentSourceProjection.apply(s,{type:'user/message',seq:3,data:{id:'question',role:'user',source:{kind:'user'},content:[{type:'text',text:e.question}]}} as any);expect(s.blocked).toBeNull();expect(s.userCount).toBe(1);expect(s.excludedSyntheticContexts).toBe(1);expect(s.candidate?.text).toBe(e.question);
 s=currentSourceProjection.apply(s,{type:'user/message',seq:4,data:{id:'unknown',role:'user',source:{kind:'unrecognized-producer'},content:[{type:'text',text:e.question}]}} as any);expect(s.blocked).toBe('HOST_SOURCE_PRODUCER');
});
