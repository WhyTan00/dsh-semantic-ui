import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {checkSourceGraph,parseExplicitRelations,type SourceSnapshot} from '../src/source-graph';
import {readSourceSnapshot} from '../src/source-input';

const sourceFile='docs/evidence/natural/r9-A2.json';
const original=JSON.parse(readFileSync(sourceFile,'utf8'));
const originalBytes=readFileSync(sourceFile);
const excerpt='入口→鉴权→库存→支付，支付→通知';
const originalView=original.actualToolCalls.find((c:{arguments?:{view?:unknown}})=>c.arguments?.view)?.arguments.view;
const digest=(s:string|Buffer)=>createHash('sha256').update(s).digest('hex');
const fixture=(text:string):SourceSnapshot=>({documentSha256:digest(text),textSha256:digest(text),excerptSha256:digest(text),jsonPointer:null,textBytes:Buffer.byteLength(text),textByteStart:0,textByteEnd:Buffer.byteLength(text),excerpt:text});
const codes=(r:Record<string,unknown>)=>(r.issues as {code:string}[]).map(i=>i.code);

it('anchors the original A2 bytes before comparing its actual first graph, without approving its original prose',async()=>{
 expect(digest(originalBytes)).toBe('17a3d65a7367f5b4686b9cc57867e7bbc265e11ff5f91fb9d1d00a2f59f2104e');
 expect(digest(original.question)).toBe('aee8484a0dc18764e15eaa2713e5ceffbae6399e12412e100eb32e85875839b0');
 const source=await readSourceSnapshot({file:sourceFile,jsonPointer:'/question',excerpt});
 const result=checkSourceGraph(source,{view:originalView,prose:original.finalAnswer});
 expect(result.comparison).toHaveProperty('status','matched');
 expect((result.sourceRelations as {from:string;to:string}[]).map(r=>[r.from,r.to])).toEqual([['入口','鉴权'],['鉴权','库存'],['库存','支付'],['支付','通知']]);
 expect(result.source).toMatchObject({documentSha256:digest(originalBytes),identityVerified:false,jsonPointer:'/question'});
 expect(result.sourceFactsVerified).toBe(false);expect(result.freeProse).toMatchObject({status:'not-verified',provided:true});
 expect((result.canonicalExplanation as {text:string}).text).not.toContain('方向相反');
 expect(JSON.stringify(result)).not.toContain(sourceFile);
 for(const r of result.sourceRelations as {spans:{textByteStart:number;textByteEnd:number}[]}[]){
  const span=r.spans[0],quote=Buffer.from(original.question).subarray(span.textByteStart,span.textByteEnd).toString();
  expect(excerpt).toContain(quote);
 }
 expect(readFileSync(sourceFile)).toEqual(originalBytes);
});

it('finds reversed, omitted and added relations against an independently fixed source set',async()=>{
 const source=await readSourceSnapshot({file:sourceFile,jsonPointer:'/question',excerpt});
 const reverse=structuredClone(originalView);reverse.payload.scenarios=[];
 [reverse.payload.edges[0].source,reverse.payload.edges[0].target]=[reverse.payload.edges[0].target,reverse.payload.edges[0].source];
 expect(codes(checkSourceGraph(source,{view:reverse}))).toContain('SOURCE_RELATION_REVERSED');
 const missing=structuredClone(originalView);missing.payload.scenarios=[];missing.payload.edges.pop();
 expect(codes(checkSourceGraph(source,{view:missing}))).toContain('SOURCE_RELATION_MISSING');
 const extra=structuredClone(originalView);extra.payload.edges.push({id:'extra',source:'notify',target:'auth',directed:true,type:'declared',evidence:[]});
 const added=checkSourceGraph(source,{view:extra});expect(codes(added)).toContain('SOURCE_RELATION_UNSUPPORTED');expect(added.canonicalExplanation).toHaveProperty('status','withheld');
});

it('does not turn undirected edges, duplicate labels, absent labels or claims of authority into source matches',async()=>{
 const source=await readSourceSnapshot({file:sourceFile,jsonPointer:'/question',excerpt});
 const undirected=structuredClone(originalView);undirected.payload.scenarios=[];undirected.payload.edges[0].directed=false;
 expect(codes(checkSourceGraph(source,{view:undirected}))).toContain('SOURCE_DIRECTION');
 const labels=structuredClone(originalView);labels.payload.nodes[0].label=labels.payload.nodes[1].label;
 expect(codes(checkSourceGraph(source,{view:labels}))).toContain('SOURCE_LABEL_AMBIGUOUS');
 const unknown=structuredClone(originalView);unknown.payload.nodes[0].label='Other';
 expect(codes(checkSourceGraph(source,{view:unknown}))).toContain('SOURCE_NODE_UNSUPPORTED');
 for(const key of ['sourceText','sourceFile','claimedAuthority','sourceFactsVerified'])expect(checkSourceGraph(source,{view:originalView,[key]:true}).status).toBe('validation-failed');
 expect(checkSourceGraph({...source,identityVerified:true} as SourceSnapshot,{view:originalView}).source).toHaveProperty('identityVerified',false);
});

it('supports only explicit edges, ordered paths and reachability; causal/rollback statements remain unassessed',()=>{
 const source=fixture('East→West; West→North');
 const result=checkSourceGraph(source,{claims:[{kind:'edge',from:'East',to:'West'},{kind:'path',nodes:['East','West','North']},{kind:'reachability',from:'East',to:'North'},{kind:'edge',from:'North',to:'East'},{kind:'causal-impact',text:'East failure prevents North.'},{kind:'rollback',text:'North failure rolls West back.'},{kind:'unknown-kind',text:'Unspecified guarantee.'}]});
 expect((result.claimChecks as {status:string}[]).map(c=>c.status)).toEqual(['supported','supported','supported','not-assessed','not-assessed','not-assessed','not-assessed']);
 expect(result.canonicalExplanation).toHaveProperty('status','withheld');
 expect(checkSourceGraph(source,{claims:[{kind:'edge',from:'East',to:'West',text:'Therefore all failures propagate.'}]}).status).toBe('validation-failed');
 expect(checkSourceGraph(source,{claims:[{kind:'edge'}]}).status).toBe('validation-failed');
});

it('does not silently parse around unsupported source clauses or convert A3 natural-language policy to arrows',async()=>{
 expect(parseExplicitRelations('A→B; rollback is guaranteed')).toHaveProperty('status','unsupported');
 expect(parseExplicitRelations('A→B; B←C')).toHaveProperty('status','unsupported');
 expect(parseExplicitRelations('A→B\nconsole.log(1)')).toHaveProperty('status','unsupported');
 const source=await readSourceSnapshot({file:'docs/evidence/natural/r9-A3.json',jsonPointer:'/question'});
 expect(source.documentSha256).toBe('2fb654eabcbe810aee4581f124f773610dc1cd9867925931f2d5513dcceb8481');
 expect(checkSourceGraph(source,{view:originalView}).status).toBe('source-unsupported');
 const fullA2=await readSourceSnapshot({file:sourceFile,jsonPointer:'/question'});
 expect(checkSourceGraph(fullA2,{view:originalView}).status).toBe('source-unsupported');
});

it('is independent of output IDs and labels tied to the test question; source and view have to correspond',()=>{
 const view=structuredClone(originalView);view.payload.scenarios=[];
 const names=['Port7','Buffer2','Cell9','Hub4','Sink6'];
 const ids=new Map<string,string>(view.payload.nodes.map((n:{id:string},i:number)=>[n.id,'renamed-'+i]));
 view.payload.nodes.forEach((n:{id:string;label:string},i:number)=>{n.id=ids.get(n.id)!;n.label=names[i];});
 view.payload.edges.forEach((e:{id:string;source:string;target:string},i:number)=>{e.id='link-'+(50+i);e.source=ids.get(e.source)!;e.target=ids.get(e.target)!;});
 const result=checkSourceGraph(fixture('Port7 -> Buffer2 -> Cell9 -> Hub4, Hub4 -> Sink6'),{view});
 expect(result.comparison).toHaveProperty('status','matched');
 expect(checkSourceGraph(fixture('Port7→Buffer2'),{view}).comparison).toHaveProperty('status','mismatch');
});

it('preserves literal loops and cycles while keeping absent reachability unknown',()=>{
 const result=checkSourceGraph(fixture('甲→乙→甲，乙→乙'),{claims:[{kind:'reachability',from:'甲',to:'甲'},{kind:'path',nodes:['甲','乙','甲']},{kind:'edge',from:'乙',to:'乙'},{kind:'reachability',from:'甲',to:'未给'}]});
 expect((result.claimChecks as {status:string}[]).map(c=>c.status)).toEqual(['supported','supported','supported','not-assessed']);
});

it('bounds source, requests and unsupported graph types without rewriting old protocol data',async()=>{
 expect(parseExplicitRelations('A→B;'.repeat(81))).toHaveProperty('status','unsupported');
 const source=await readSourceSnapshot({file:sourceFile,jsonPointer:'/question',excerpt});
 const before=JSON.stringify(originalView);
 expect(checkSourceGraph(source,{view:{protocolVersion:'99.0'}}).status).toBe('validation-failed');
 const cyclic:{self?:unknown}={};cyclic.self=cyclic;
 expect(checkSourceGraph(source,cyclic).status).toBe('validation-failed');
 expect(checkSourceGraph(source,{prose:'x'.repeat(140000)}).status).toBe('validation-failed');
 const expanded=structuredClone(originalView);expanded.payload.scenarios=[];
 expanded.payload.nodes=[{id:'a',label:'A',responsibility:'Supplied',constraints:[],evidence:[]},{id:'b',label:'B',responsibility:'Supplied',constraints:[],evidence:[]}];
 expanded.payload.edges=Array.from({length:240},(_,i)=>({id:'edge-'+i,source:'a',target:'b',directed:true,type:'declared',evidence:[]}));
 const receiptLimit=checkSourceGraph(fixture('A→B;'.repeat(80)),{view:expanded});
 expect(receiptLimit.status).toBe('check-limit');expect(codes(receiptLimit)).toEqual(['SOURCE_CHECK_LIMIT']);expect(receiptLimit).not.toHaveProperty('comparison.status');
 expect(JSON.stringify(originalView)).toBe(before);
 for(const protocolVersion of ['1.0','1.1','1.2','1.3','1.4'])expect(checkSourceGraph(source,{view:{...structuredClone(originalView),protocolVersion}}).comparison).toHaveProperty('status','matched');
});
