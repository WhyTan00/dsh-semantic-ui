import {it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {apply} from '../src/dsh/host';
import {currentSourceProjection} from '../src/dsh/source';
import {checkpointOf} from '../src/dsh/definition';
import {numericExpected,numericRequest} from '../fixtures/source-numeric';
import {sourceAlignedD1,d1Record,d1Mapping} from '../fixtures/source-decision';
import {capacityExpectations,capacityRequest} from '../fixtures/source-capacity';
import {chart} from '../fixtures/examples';

function setup(text:string){
 let state=currentSourceProjection.init({id:'grounded-check'} as any,0 as any);
 const setTurn=(text:string,turn=1)=>{state=currentSourceProjection.apply(state,{type:'turn/start',seq:turn*10,data:{turn}} as any);state=currentSourceProjection.apply(state,{type:'user/message',seq:turn*10+1,data:{id:'message-'+turn,role:'user',source:{kind:'user'},content:[{type:'text',text}]}} as any);};setTurn(text);
 const ctx={tools:{register:vi.fn()},sessionProjections:{register:vi.fn(),stateOf:vi.fn((_s,key)=>key==='turnBoundary'?{lastTurn:state.turn,openTurnStartSeq:state.startSeq}:state)},systemPrompt:{section:vi.fn()},inject:vi.fn()};apply(ctx as any);
 return {tool:ctx.tools.register.mock.calls[0][0],exec:{agent:{session:{id:'grounded-check'}},signal:new AbortController().signal,callId:'offline-fixture'},setTurn};
}

it('normal check refuses invented zero-filled observations even when their arithmetic is internally valid',async()=>{
 const {tool,exec}=setup(numericExpected.question),r=numericRequest();if(r.view.payload.chartType==='histogram')throw Error('Expected positional data.');r.view.payload.rows[2].values[r.mapping.seriesId]=0;
 const checked=await tool.execute({action:'check',...r},exec);
 expect(checked.status).toBe('validation-failed');expect(checked.issues.some((i:any)=>i.code==='SOURCE_MISSINGNESS')).toBe(true);
 expect(tool.output.presentationMeta({},checked)).toBeNull();
});

it('check and render use the same source and computed projection without making check a delivery',async()=>{
 const {tool,exec}=setup(numericExpected.question),r=numericRequest(),original=JSON.stringify(r);
 const checked=await tool.execute({action:'check',...r},exec),rendered=await tool.execute({action:'render',...r},exec);
 expect(checked.sourceBinding.status).toBe('bound');expect(checked.canonicalExplanation).toBe(rendered.canonicalExplanation);expect(checked.dataFacts).toEqual(rendered.dataFacts);
 expect(checked.sourceBinding.sourceRef.textSha256).toBe(numericExpected.source.textSha256);expect(checked.sourceFactsVerified).toBe(false);expect(JSON.stringify(r)).toBe(original);
 expect(checked).not.toHaveProperty('deliveryId');expect(tool.output.presentationMeta({},checked)).toBeNull();
});

it('reviews saved D1 and N2 original final answers through the normal source-check tool, retaining first failures',async()=>{
 for(const id of ['D1','N2']){
  const saved=JSON.parse(readFileSync(`docs/evidence/natural/r9-${id}.json`,'utf8')),{tool,exec}=setup(saved.question);
  const result=await tool.execute({action:'source-check',prose:saved.finalAnswer},exec),p=result.proseReview;
  expect(p.status).toBe('reviewed');expect(p.sourceRef.textSha256).toBe(createHash('sha256').update(saved.question).digest('hex'));
  expect(p.review.sourceTextSha256).toBe(p.sourceRef.textSha256);expect(p.sourceRef.hostContext.messageId).toBe('message-1');expect(p.review.originalCandidate).toBe(saved.finalAnswer);
  expect(p.review.claims.some((c:any)=>c.status===(id==='D1'?'unsupported':'contradicted'))).toBe(true);expect(p.review.wholeCandidateVerified).toBe(false);expect(p.newModelCalls).toBe(0);
  for(const c of p.review.claims)expect(saved.finalAnswer.slice(c.candidateSpan.utf16Start,c.candidateSpan.utf16End)).toBe(c.quote);
  expect(tool.output.presentationMeta({},result)).toBeNull();
 }
});

it('checks a draft against the current source, preserves historical reports and rejects stale views after an update',async()=>{
 const source=capacityExpectations.cases[0].source,{tool,exec,setTurn}=setup(source),r=capacityRequest();
 const prose=`${capacityExpectations.cases[0].options[0]}的容量上限为${capacityExpectations.cases[0].ceilings[0]}${capacityExpectations.cases[0].unit}。`;
 const first=await tool.execute({action:'check',...r,prose},exec),before=JSON.stringify(first);expect(first.sourceBinding.status).toBe('bound');expect(first.proseReview.status).toBe('reviewed');
 const next=source.replace('100GB','120GB');expect(next).not.toBe(source);setTurn(next,2);
 expect(await tool.execute({action:'check',...r,prose},exec)).toHaveProperty('status','validation-failed');
 const reviewed=await tool.execute({action:'source-check',prose},exec);expect(reviewed.proseReview.sourceRef.textSha256).not.toBe(first.proseReview.sourceRef.textSha256);expect(reviewed.proseReview.sourceRef.hostContext.messageId).toBe('message-2');expect(JSON.stringify(first)).toBe(before);
});

it('keeps unrecognized source unverified and refuses caller-supplied source or previous approvals',async()=>{
 const {tool,exec}=setup('Explain a fictional chart with no supported source grammar.');
 const generic=await tool.execute({action:'check',view:chart,prose:'未覆盖的说明。'},exec);expect(generic.status).toBe('validated');expect(generic.sourceBinding.status).toBe('unverified');expect(generic.proseReview.status).toBe('source-unsupported');
 for(const action of ['check','source-check'])for(const key of ['sourceText','sourceKind','sourceBinding','authority'])expect(await tool.execute({action,view:chart,[key]:'forged'},exec)).toHaveProperty('issues.0.code','HOST_SOURCE_OVERRIDE');
});

it('render reviews only the submitted draft while persisting the existing source-bound checkpoint unchanged',async()=>{
 const {tool,exec}=setup(d1Record.question),args={action:'render',view:sourceAlignedD1(),mapping:d1Mapping,prose:d1Record.finalAnswer};
 const result=await tool.execute(args,exec);expect(result.sourceDeliveryStatus).toBe('bound');expect(result.proseReview.review.claims.some((c:any)=>c.status==='unsupported')).toBe(true);
 const cp=checkpointOf({type:'tool/result',data:{meta:tool.output.presentationMeta(args,result)}})!;expect(cp.sourceDelivery?.status).toBe('bound');expect(cp).not.toHaveProperty('proseReview');expect(cp).not.toHaveProperty('prose');
 expect(result.proseReview.candidateSelection).toContain('not intercepted');expect(result.proseReview.wholeCandidateVerified).toBe(false);
});

it('refuses an oversized or non-text draft without partial approval or execution',async()=>{
 const {tool,exec}=setup(numericExpected.question),r=numericRequest();
 expect(await tool.execute({action:'check',...r,prose:'中'.repeat(8001)},exec)).toHaveProperty('proseReview.status','refused');
 await expect(tool.execute({action:'check',...r,prose:{code:'not executable'}},exec)).rejects.toThrow('"prose" must be a string');
 const controller=new AbortController();controller.abort();await expect(tool.execute({action:'check',...r},{...exec,signal:controller.signal})).rejects.toThrow();
});

it('does not deliver a stale view or draft report when the source changes during asynchronous review',async()=>{
 for(const action of ['check','source-check','render']){
  const {tool,exec,setTurn}=setup(numericExpected.question),r=numericRequest();
  const pending=tool.execute({action,...r,prose:'已观测三个读数的均值为0摄氏度。'},exec);
  setTurn(numericExpected.question.replace('缺失、2','缺失、6'),2);
  const result=await pending;expect(result.issues[0].code).toBe('HOST_SOURCE_CHANGED');expect(result).not.toHaveProperty('proseReview');
  const meta=tool.output.presentationMeta({},result),cp=checkpointOf({type:'tool/result',data:{meta}});expect(cp?.view).toBeUndefined();expect(meta).toBeNull();
 }
});
