import {it,expect,vi} from 'vitest';
import {createHash} from 'node:crypto';
import {currentSourceProjection,snapshotCurrentSource,currentHostSource} from '../src/dsh/source';
import {apply} from '../src/dsh/host';
import {checkSourceDecision} from '../src/source-decision';
import {sourceMetadata,SOURCE_LIMITS} from '../src/source-graph';
import {d1Record,d1FirstView,d1Mapping,sourceAlignedD1} from '../fixtures/source-decision';
const init=(inherited=0)=>currentSourceProjection.init({id:'test-session'} as any,inherited as any);
const fold=(state:ReturnType<typeof init>,type:string,seq:number,data:unknown)=>currentSourceProjection.apply(state,{type,seq,data} as any);
const start=(inherited=0)=>fold(init(inherited),'turn/start',10,{turn:3});
const user=(id:string,text=d1Record.question,kind='user')=>({id,role:'user',source:{kind},content:[{type:'text',text}]});
const select=(state:ReturnType<typeof init>,boundary:{lastTurn:number;openTurnStartSeq:number|null}={lastTurn:3,openTurnStartSeq:10},session='test-session')=>snapshotCurrentSource(state,boundary,session);
const code=(result:ReturnType<typeof select>)=>result.ok?'':result.result.issues[0].code;
it('uses only current committed host message content and IDs, with a text hash and no fabricated file hash or principal',()=>{
 const s=fold(start(),'user/message',11,user('host-message-1')),r=select(s);expect(r.ok).toBe(true);if(!r.ok)throw Error();
 const meta=sourceMetadata(r.snapshot);if(!('hostContext'in meta))throw Error('Expected host provenance.');expect(meta.hostContext).toMatchObject({sessionId:'test-session',turn:3,turnStartSeq:10,messageId:'host-message-1',messageSeq:11,producerSourceKind:'user',inherited:false});expect(meta.textSha256).toBe(createHash('sha256').update(d1Record.question).digest('hex'));expect(meta.identityVerified).toBe(false);expect(meta).not.toHaveProperty('documentSha256');expect(meta).not.toHaveProperty('jsonPointer');expect(meta.input).toContain('not a file');
 expect(checkSourceDecision(r.snapshot,{view:d1FirstView,mapping:d1Mapping}).comparison).toHaveProperty('status','mismatch');expect(checkSourceDecision(r.snapshot,{view:sourceAlignedD1(),mapping:d1Mapping}).comparison).toHaveProperty('status','matched');
});
it('excludes explicitly synthetic context, rejects synthetic-only/unknown producers, and never promotes role alone to identity',()=>{
 const kinds=['runtime-context','skill-catalog','time-context','skill-invocation','model-selection','tool-registry'];let s=start();
 for(const [i,kind]of kinds.entries()){s=fold(s,'user/message',11+i,user(kind,'synthetic text',kind));expect(code(select(s))).toBe('HOST_SOURCE_SYNTHETIC_ONLY');}
 s=fold(s,'user/message',20,user('actual'));const selected=select(s);expect(selected.ok).toBe(true);if(!selected.ok)throw Error();expect(selected.snapshot.hostContext?.excludedSyntheticContexts).toBe(kinds.length);
 for(const kind of ['unrecognized-producer','notice','agent-context','goal-continuation']){
  const unknown=fold(start(),'user/message',11,user('unknown','text',kind));expect(code(select(unknown))).toBe('HOST_SOURCE_PRODUCER');
  expect(code(select(fold(unknown,'user/message',12,user('actual'))))).toBe('HOST_SOURCE_PRODUCER');
 }
});
it('rejects multiple current user-source candidates, mismatched sessions/turns and closed/history or inherited input',()=>{
 let s=fold(start(),'user/message',11,user('one'));s=fold(s,'user/message',12,user('two'));expect(code(select(s))).toBe('HOST_SOURCE_AMBIGUOUS');expect(s.candidate).toBeNull();
 const single=fold(start(),'user/message',11,user('one'));expect(code(select(single,{lastTurn:4,openTurnStartSeq:10}))).toBe('HOST_SOURCE_NOT_CURRENT');expect(code(select(single,undefined,'different-session'))).toBe('HOST_SOURCE_NOT_CURRENT');
 const closed=fold(single,'turn/end',13,{turn:3,reason:'completed'});expect(closed.candidate).toBeNull();expect(code(select(closed,{lastTurn:3,openTurnStartSeq:null}))).toBe('HOST_SOURCE_NO_OPEN_TURN');expect(code(select(closed))).toBe('HOST_SOURCE_NOT_CURRENT');
 let inherited=init(2);inherited=fold(inherited,'turn/start',0,{turn:3});inherited=fold(inherited,'user/message',1,user('parent'));expect(code(select(inherited,{lastTurn:3,openTurnStartSeq:0}))).toBe('HOST_SOURCE_NOT_CURRENT');
 inherited=fold(inherited,'turn/start',10,{turn:4});inherited=fold(inherited,'user/message',11,user('own'));expect(select(inherited,{lastTurn:4,openTurnStartSeq:10}).ok).toBe(true);
});
it('refuses non-text, multiple blocks, empty text, oversized text and absent message IDs without a source fallback',()=>{
 const cases=[{...user('x'),content:[{type:'image',url:'https://example.invalid/test.png'}]},{...user('x'),content:[{type:'text',text:'A'},{type:'text',text:'B'}]},user('x','  '),user('x','中'.repeat(SOURCE_LIMITS.excerptBytes)),{...user('x'),id:undefined}];
 for(const message of cases){const r=select(fold(start(),'user/message',11,message));expect(r.ok).toBe(false);}
});
it('clears previous source on a new turn and never mutates projection states while taking a source snapshot',()=>{
 const s=fold(start(),'user/message',11,user('old'));const before=JSON.stringify(s);select(s);expect(JSON.stringify(s)).toBe(before);
 const next=fold(s,'turn/start',20,{turn:4});expect(next.candidate).toBeNull();expect(code(select(next,{lastTurn:4,openTurnStartSeq:20}))).toBe('HOST_SOURCE_NO_USER');expect(currentSourceProjection.apply(next,{type:'unrelated',seq:21,data:{}} as any)).toBe(next);
});
it('requires a real execution agent/open boundary and rejects source overrides through the actual registered tool body',async()=>{
 const state=fold(start(),'user/message',11,user('actual'));
 const ctx={tools:{register:vi.fn()},sessionProjections:{register:vi.fn(),stateOf:vi.fn((_s,key)=>key==='turnBoundary'?{lastTurn:3,openTurnStartSeq:10}:state)},systemPrompt:{section:vi.fn()},inject:vi.fn()};apply(ctx as any);const tool=ctx.tools.register.mock.calls[0][0],signal=new AbortController().signal;
 expect(currentHostSource(ctx as any,{}).ok).toBe(false);
 expect(await tool.execute({action:'source-check'},{signal})).toHaveProperty('issues.0.code','HOST_SOURCE_NO_AGENT');
 const exec={agent:{session:{id:'test-session'}},signal};expect(await tool.execute({action:'source-check'},exec)).toHaveProperty('canonicalExplanation.status','available');
 for(const key of ['sourceText','sourceFile','messageId','authority','sourceKind'])expect(await tool.execute({action:'source-check',[key]:'forged'},exec)).toHaveProperty('issues.0.code','HOST_SOURCE_OVERRIDE');
});
