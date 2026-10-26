import {it,expect,vi} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parsePermissionSource,checkSourcePermissions} from '../src/source-permissions';
import {readSourceSnapshot,sourceOptions} from '../src/source-input';
import {currentSourceProjection} from '../src/dsh/source';
import {apply} from '../src/dsh/host';
import type {SourceSnapshot} from '../src/source-graph';
import {a3Record,a3FirstView,permissionProjectionA3} from '../fixtures/source-permissions';
const sha=(s:string|Buffer)=>createHash('sha256').update(s).digest('hex');
const snapshot=(text=a3Record.question):SourceSnapshot=>({kind:'permissions-zh',excerpt:text,textSha256:sha(text),excerptSha256:sha(text),textBytes:Buffer.byteLength(text),textByteStart:0,textByteEnd:Buffer.byteLength(text)});
const check=(args:unknown={},text=a3Record.question)=>checkSourcePermissions(snapshot(text),args);
const codes=(r:Record<string,unknown>)=>(r.issues as {code:string}[]).map(i=>i.code);
const append=(clause:string)=>a3Record.question.replace('。请','；'+clause+'。请');
const access=(from:string,to:string,value:boolean)=>({kind:'access',from,to,value});
const mode=(kind:'read'|'write',from:string,to:string,value:boolean)=>({kind,from,to,value});
const graph=()=>{const v=permissionProjectionA3();if(v.component!=='ArchitectureExplorer')throw Error();return v;};

it('parses the full original A3 against independently frozen positive/negative/local expectations and literal spans',async()=>{
 const expected=JSON.parse(readFileSync('fixtures/source-permissions-expectations.json','utf8'));
 expect(sha(readFileSync(expected.source.path))).toBe(expected.source.sha256);expect(sha(a3Record.question)).toBe(expected.source.textSha256);
 const s=await readSourceSnapshot({file:expected.source.path,jsonPointer:'/question',kind:'permissions-zh'}),r=parsePermissionSource(s.excerpt);expect(r.status).toBe('ready');if(r.status!=='ready')throw Error();
 expect(r.value.accesses.map(({spans,...a})=>a)).toEqual(expected.accesses);expect(r.value.prohibitions.map(({spans,...a})=>a)).toEqual(expected.prohibitions);expect(r.value.onlyTargets.map(({spans,...a})=>a)).toEqual(expected.onlyTargets);
 for(const a of [...r.value.accesses,...r.value.prohibitions,...r.value.onlyTargets])for(const span of a.spans)expect(Buffer.from(s.excerpt).subarray(span.textByteStart,span.textByteEnd).length).toBeGreaterThan(0);
 const result=checkSourcePermissions(s,{});expect(result).toHaveProperty('canonicalExplanation.status','available');expect(result).toHaveProperty('source.identityVerified',false);expect(result).toHaveProperty('source.documentSha256',expected.source.sha256);expect(result).toHaveProperty('sourceFactsVerified',false);expect(result).toHaveProperty('source.scope',expect.stringContaining('pair-bound'));
});
it('marks the old Client translation and all old annotations/prose unverified without rewriting the original failure',()=>{
 const r=check({view:a3FirstView,prose:a3Record.finalAnswer});expect(r).toHaveProperty('comparison.status','not-assessed');expect(codes(r)).toContain('SOURCE_BINDING_UNVERIFIED');expect(r).toHaveProperty('comparison.viewAnnotations','not-verified');expect(r).toHaveProperty('freeProse.status','not-verified');expect(r).toHaveProperty('canonicalExplanation.status','withheld');
});
it('matches an explicitly authored positive projection and separately checks pair permissions and local only-target claims',()=>{
 const r=check({view:graph(),claims:[access('Search','Store',false),mode('read','Search','Index',true),mode('write','Search','Index',false),mode('write','Account','Store',true),{kind:'only-targets',from:'客户端',targets:['Gateway']}],prose:'A free causal claim is not checked.'});
 expect(r).toHaveProperty('comparison.status','matched');expect(r).toHaveProperty('canonicalExplanation.status','available');expect((r.claimChecks as any[]).every(c=>c.status==='supported')).toBe(true);expect(r).toHaveProperty('freeProse.status','not-verified');
});
it('does not depend on the six entities, output IDs, source clause order or view row order',()=>{
 const replacements:Record<string,string>={'客户端':'终端甲',Gateway:'入口乙',Search:'查询丙',Account:'账户丁',Index:'索引戊',Store:'存储己'};
 const text='演示系统中，账户丁读写存储己；查询丙只读索引戊；禁止查询丙访问存储己；入口乙访问账户丁与查询丙；终端甲只能访问入口乙。请解释访问边界。';
 const v=graph(),ids=new Map(v.payload.nodes.map((n,i)=>[n.id,'new-'+i]));v.payload.nodes.forEach(n=>{n.id=ids.get(n.id)!;n.label=replacements[n.label];});v.payload.edges.forEach((e,i)=>{e.id='edge-'+i;e.source=ids.get(e.source)!;e.target=ids.get(e.target)!;});v.payload.nodes.reverse();v.payload.edges.reverse();expect(check({view:v},text)).toHaveProperty('comparison.status','matched');
});
it('rejects reversed positive edges and a prohibition drawn as a positive edge, without treating missing edges as prohibitions',()=>{
 const reversed=graph(),e=reversed.payload.edges.find(e=>e.id==='e-gw-search')!;[e.source,e.target]=[e.target,e.source];expect(codes(check({view:reversed}))).toContain('SOURCE_ACCESS_UNDECLARED');
 const negative=graph();negative.payload.edges.push({id:'bad',source:'search',target:'store',directed:true,type:'access',evidence:[]});expect(codes(check({view:negative}))).toContain('SOURCE_ACCESS_PROHIBITED');
 for(const value of [true,false])expect(check({claims:[access('Gateway','Store',value)]})).toHaveProperty('claimChecks.0.status','not-assessed');
 expect(check({claims:[access('客户端','Store',false)]})).toHaveProperty('claimChecks.0.status','supported');
});
it('binds prohibitions to their direction and distinguishes permitted↔forbidden changes',()=>{
 const reversed=a3Record.question.replace('禁止 Search 访问 Store','禁止 Store 访问 Search');expect(check({claims:[access('Search','Store',false)]},reversed)).toHaveProperty('claimChecks.0.status','not-assessed');expect(check({claims:[access('Store','Search',false)]},reversed)).toHaveProperty('claimChecks.0.status','supported');
 const allowed=a3Record.question.replace('禁止 Search 访问 Store','Search 访问 Store'),v=graph();v.payload.edges.push({id:'new',source:'search',target:'store',directed:true,type:'access',evidence:[]});expect(check({view:v,claims:[access('Search','Store',true)]},allowed)).toHaveProperty('comparison.status','matched');
 const banned=a3Record.question.replace('Gateway 访问 Search 与 Account','Gateway 访问 Account；禁止 Gateway 访问 Search');expect(codes(check({view:graph()},banned))).toContain('SOURCE_ACCESS_PROHIBITED');
});
it('changes read-only↔read-write pair requirements rather than stripping write words from arbitrary prose',()=>{
 const text=a3Record.question.replace('Search 只读 Index','Search 读写 Index'),v=graph();expect(codes(check({view:v},text))).toContain('SOURCE_ACCESS_MODE');
 const edge=v.payload.edges.find(e=>e.id==='e-search-index')!;edge.type='read-write';edge.label='读写';expect(check({view:v,claims:[mode('write','Search','Index',true)]},text)).toHaveProperty('comparison.status','matched');
 expect(check({claims:[mode('write','Search','Index',true)]})).toHaveProperty('claimChecks.0.status','mismatch');
 edge.type='read-only';edge.label='读写';expect(codes(check({view:v},text))).toContain('SOURCE_EDGE_MODE_CONFLICT');
});
it('allows a second explicit accessor/writer while keeping the first pair read-only; no global exclusivity follows',()=>{
 const text=append('Account 读写 Index'),v=graph();v.payload.edges.push({id:'second-writer',source:'account',target:'index',directed:true,type:'read-write',label:'读写',evidence:[]});
 const r=check({view:v,claims:[mode('write','Search','Index',false),mode('write','Account','Index',true)]},text);expect(r).toHaveProperty('comparison.status','matched');expect((r.claimChecks as any[]).map(c=>c.status)).toEqual(['supported','supported']);
 for(const kind of ['exclusive-writer','global-entry','fault-independence','alternative-path'])expect(check({claims:[{kind,text:'Unsupported global/causal statement.'}]},text)).toHaveProperty('claimChecks.0.status','not-assessed');
});
it('keeps read-only local to its pair and does not turn an ordinary target list into only-targets',()=>{
 const v=graph();v.payload.nodes.push({id:'archive',label:'Archive',responsibility:'Fixture.',constraints:[],evidence:[]});v.payload.edges.push({id:'other-write',source:'search',target:'archive',directed:true,type:'read-write',label:'读写',evidence:[]});
 const r=check({view:v,claims:[mode('write','Search','Index',false),mode('write','Search','Archive',true)]},append('Search 读写 Archive'));expect(r).toHaveProperty('comparison.status','matched');expect((r.claimChecks as any[]).map(c=>c.status)).toEqual(['supported','supported']);
 expect(check({claims:[{kind:'only-targets',from:'Gateway',targets:['Search','Account']}]})).toHaveProperty('claimChecks.0.status','not-assessed');
});
it('leaves omitted permissions unknown and requires complete projection coverage without inventing missing conditions',()=>{
 const text=a3Record.question.replace('，Search 只读 Index','');expect(check({claims:[mode('read','Search','Index',true)]},text)).toHaveProperty('claimChecks.0.status','not-assessed');
 const v=graph();v.payload.edges.pop();expect(codes(check({view:v}))).toContain('SOURCE_ACCESS_MISSING');
 expect(check({claims:[mode('write','Gateway','Search',false)]})).toHaveProperty('claimChecks.0.status','not-assessed');
 expect(check({claims:[access('Search','Store',false)]},a3Record.question.replace('；禁止 Search 访问 Store',''))).toHaveProperty('claimChecks.0.status','not-assessed');
 expect(check({claims:[access('客户端','Store',false)]},a3Record.question.replace('客户端只能访问 Gateway','客户端访问 Gateway'))).toHaveProperty('claimChecks.0.status','not-assessed');
});
it('rejects whole contradictory/conditional/unclear documents rather than skipping unsupported clauses',()=>{
 for(const clause of ['Search 读写 Index','Search 访问 Store','客户端访问 Search','客户端只能访问 Search','它访问 Store','如果缓存失效则 Search 访问 Index','Search不访问 Index','必须 Search访问Index','Search访问'])expect(check({},append(clause))).toHaveProperty('status','source-unsupported');
 expect(check({},'服务中，请解释访问边界。')).toHaveProperty('status','source-unsupported');
});
it('never accepts a model-supplied alias/source/authority or explanatory text attached to a supported boolean claim',()=>{
 for(const key of ['sourceText','sourceFile','sourceKind','authority','aliases','mapping'])expect(check({[key]:'forged'})).toHaveProperty('status','validation-failed');
 expect(check({claims:[{...access('Search','Index',true),text:'therefore unaffected by failures'}]})).toHaveProperty('status','validation-failed');
 expect(sourceOptions(['--source-file','a.json','--source-kind','permissions-zh'])).toEqual({file:'a.json',kind:'permissions-zh'});
});
it('uses the same registered host source-check and current-input guard, routing only actual text grammar',async()=>{
 const makeState=(text:string)=>{let s=currentSourceProjection.init({id:'fixture-session'} as any,0 as any);s=currentSourceProjection.apply(s,{type:'turn/start',seq:1,data:{turn:1}} as any);return currentSourceProjection.apply(s,{type:'user/message',seq:2,data:{id:'fixture-message',role:'user',source:{kind:'user'},content:[{type:'text',text}]}} as any);};
 let state=makeState(a3Record.question);const ctx={tools:{register:vi.fn()},sessionProjections:{register:vi.fn(),stateOf:vi.fn((_s,key)=>key==='turnBoundary'?{lastTurn:1,openTurnStartSeq:1}:state)},systemPrompt:{section:vi.fn()},inject:vi.fn()};apply(ctx as any);const tool=ctx.tools.register.mock.calls[0][0],exec={agent:{session:{id:'fixture-session'}},signal:new AbortController().signal};
 expect(await tool.execute({action:'source-check',view:graph()},exec)).toHaveProperty('comparison.status','matched');expect(await tool.execute({action:'source-check'},exec)).toHaveProperty('sourceCheckKind','permissions-zh');expect(await tool.execute({action:'source-check',sourceKind:'decision-zh'},exec)).toHaveProperty('issues.0.code','HOST_SOURCE_OVERRIDE');
 state=makeState(append('它访问 Store'));expect(await tool.execute({action:'source-check'},exec)).toHaveProperty('status','source-unsupported');
 state=currentSourceProjection.apply(state,{type:'user/message',seq:3,data:{role:'user',source:{kind:'unknown-producer'},content:[{type:'text',text:'context'}]}} as any);expect(await tool.execute({action:'source-check'},exec)).toHaveProperty('issues.0.code','HOST_SOURCE_PRODUCER');
});
