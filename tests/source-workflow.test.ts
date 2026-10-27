import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {parseWorkflowSource,checkSourceWorkflow} from '../src/source-workflow';
import {bindWorkflowView} from '../src/source-delivery';
import {readSourceSnapshot,sourceOptions} from '../src/source-input';
import {a2WorkflowSource,workflowRequest,workflowExpectations} from '../fixtures/source-workflow';
import type {SourceSnapshot} from '../src/source-graph';
const sha=(s:string|Buffer)=>createHash('sha256').update(s).digest('hex');
const snapshot=(text=a2WorkflowSource):SourceSnapshot=>({kind:'workflow-zh',textSha256:sha(text),excerptSha256:sha(text),textByteStart:0,textByteEnd:Buffer.byteLength(text),textBytes:Buffer.byteLength(text),excerpt:text});
const codes=(r:Record<string,unknown>)=>(r.issues as {code:string}[]??[]).map(i=>i.code);
it('binds the complete original A2 and separately tracks topology, failure trigger and two action boundaries',async()=>{
 expect(sha(readFileSync('docs/evidence/natural/r9-A2.json'))).toBe('17a3d65a7367f5b4686b9cc57867e7bbc265e11ff5f91fb9d1d00a2f59f2104e');expect(sha(a2WorkflowSource)).toBe(workflowExpectations.source.questionSha256);
 const s=await readSourceSnapshot({file:'docs/evidence/natural/r9-A2.json',jsonPointer:'/question',kind:'workflow-zh'}),p=parseWorkflowSource(s.excerpt);if(p.status!=='ready')throw Error(JSON.stringify(p));
 expect(p.value.relations.map(r=>[r.from,r.to])).toEqual([['入口','鉴权'],['鉴权','库存'],['库存','支付'],['支付','通知']]);const rule=p.value.failurePolicies[0];expect(rule).toMatchObject({trigger:'通知',retryOnly:['通知'],noRollback:['支付']});
 for(const span of [...p.value.relations.flatMap(r=>r.spans),...rule.triggerSpans,...rule.retrySpans,...rule.noRollbackSpans])expect(Buffer.from(s.excerpt).subarray(span.textByteStart,span.textByteEnd).toString()).not.toBe('');
 const excerpt=(span:{textByteStart:number;textByteEnd:number})=>Buffer.from(s.excerpt).subarray(span.textByteStart,span.textByteEnd).toString();expect(rule.triggerSpans.map(excerpt).join('')).toContain('通知失败');expect(rule.retrySpans.map(excerpt).join('')).toContain('重试通知');expect(rule.noRollbackSpans.map(excerpt).join('')).toContain('不回滚支付');
 const r=checkSourceWorkflow(s,workflowRequest());expect(r.comparison).toHaveProperty('status','matched');expect(r.canonicalExplanation).toHaveProperty('status','available');const t=(r.canonicalExplanation as {text:string}).text;expect(t).toContain('当通知失败时，仅重试通知；此失败分支不回滚支付');expect(t).toContain('库存失败的重试、回滚或补偿策略未声明');expect(t).toContain('上游已完成');expect(r.sourceFactsVerified).toBe(false);
});
it('rejects wrong rollback, whole-flow retry and dropped exception coverage without judging arbitrary prose',()=>{
 for(const claims of [[{kind:'rollback',trigger:'通知',target:'支付',value:true}],[{kind:'retry-only',trigger:'通知',nodes:['入口','鉴权','库存','支付','通知']} ]]){const r=checkSourceWorkflow(snapshot(),{...workflowRequest(),claims});expect(r.claimChecks).toMatchObject([{status:'contradicted'}]);expect(r.canonicalExplanation).toHaveProperty('status','withheld');}
 const omitted=workflowRequest();omitted.mapping.failurePolicies=[];expect(codes(checkSourceWorkflow(snapshot(),omitted))).toContain('SOURCE_POLICY_MISSING');expect(codes(checkSourceWorkflow(snapshot(),{view:omitted.view}))).toContain('SOURCE_POLICY_MAPPING_REQUIRED');
 const r=checkSourceWorkflow(snapshot(),{...workflowRequest(),prose:'通知失败时回滚支付，重试整个流程。'});expect(r.freeProse).toHaveProperty('status','not-verified');expect(r.freeProseVerified).toBe(false); // prose is not laundered by matching data
});
it('supports the explicit branch while leaving other triggers, counts, success and execution states not-assessed',()=>{
 const yes=checkSourceWorkflow(snapshot(),{...workflowRequest(),claims:[{kind:'retry-only',trigger:'通知',nodes:['通知']},{kind:'rollback',trigger:'通知',target:'支付',value:false}]});expect(yes.claimChecks).toMatchObject([{status:'supported'},{status:'supported'}]);
 for(const c of [{kind:'retry-only',trigger:'库存',nodes:['通知']},{kind:'rollback',trigger:'库存',target:'支付',value:false},{kind:'retry-count',text:'通知无限重试直到必成功'},{kind:'execution',text:'库存失败保证支付和通知不执行，且上游已完成'},{kind:'reverse-propagation',text:'通知阻碍回传'}]){const r=checkSourceWorkflow(snapshot(),{...workflowRequest(),claims:[c]});expect(r.claimChecks).toMatchObject([{status:'not-assessed'}]);expect(r.canonicalExplanation).toHaveProperty('status','withheld');}
});
it('rechecks changed/missing/opposite policies and refuses unsupported or partial source instead of reusing a match',()=>{
 const s=snapshot(),req=workflowRequest();expect(checkSourceWorkflow(s,req).comparison).toHaveProperty('status','matched');
 const missing=a2WorkflowSource.replace('通知失败只重试通知，不回滚支付。','');expect(codes(checkSourceWorkflow(snapshot(missing),req))).toContain('SOURCE_POLICY_MISMATCH');
 for(const text of [a2WorkflowSource.replace('通知失败只重试通知，不回滚支付','通知失败时回滚支付，不重试通知'),a2WorkflowSource+'保证通知必成功。',a2WorkflowSource.replace('不回滚支付','不回滚支付且库存')])expect(checkSourceWorkflow(snapshot(text),req).status).toBe('source-unsupported');
 expect(codes(checkSourceWorkflow({...s,excerpt:'入口→鉴权→库存→支付，支付→通知',excerptSha256:sha('入口→鉴权→库存→支付，支付→通知'),textByteEnd:66},req))).toContain('SOURCE_WORKFLOW_COMPLETE');
});
it('handles paraphrase, policy clause reordering, different names/IDs and exact UTF8 offsets without fixed answers',()=>{
 const reordered=workflowExpectations.positive.find((v:{id:string})=>v.id==='reordered-paraphrase').source;expect(checkSourceWorkflow(snapshot(reordered),workflowRequest(undefined,'other')).comparison).toHaveProperty('status','matched');
 const renamed=workflowExpectations.positive.find((v:{id:string})=>v.id==='labels-and-ids').source,r=workflowRequest(['接入','审核','写账','回执'],'renamed');expect(checkSourceWorkflow(snapshot(renamed),r).comparison).toHaveProperty('status','matched');
 const p=parseWorkflowSource(renamed,17);if(p.status!=='ready')throw Error('renamed');expect(p.value.failurePolicies[0]).toMatchObject({trigger:'回执',retryOnly:['回执'],noRollback:['写账']});for(const span of p.value.relations.flatMap(r=>r.spans))expect(span.textByteStart).toBeGreaterThanOrEqual(17);
 const wrong=structuredClone(r);wrong.mapping.failurePolicies[0].trigger=wrong.view.payload.nodes[1].id;expect(checkSourceWorkflow(snapshot(renamed),wrong).comparison).toHaveProperty('status','mismatch');
});
it('uses the same core binder for a fresh rule projection and rejects wrong coordinates before delivery',()=>{
 const req=workflowRequest(),before=JSON.stringify(req),r=bindWorkflowView(snapshot(),req.view,req.mapping);expect(r.ok).toBe(true);expect(JSON.stringify(req)).toBe(before);if(!r.ok)throw Error('bind');expect(JSON.stringify(r)).not.toContain('UNVERIFIED_');expect(r.explanation).toContain('仅重试通知');expect(r.view.payload).toHaveProperty('title','来源声明的流程与异常规则');
 const wrong=structuredClone(req);wrong.mapping.failurePolicies[0].retryOnly=wrong.view.payload.nodes.map(n=>n.id);expect(bindWorkflowView(snapshot(),wrong.view,wrong.mapping).ok).toBe(false);
 expect(bindWorkflowView(snapshot(),req.view,req.mapping,[{kind:'rollback',trigger:'通知',target:'支付',value:true}]).ok).toBe(false);
 expect(sourceOptions(['--source-file','one.json','--source-kind','workflow-zh'])).toHaveProperty('kind','workflow-zh');
});
