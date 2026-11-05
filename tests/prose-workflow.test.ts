import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {reviewProse} from '../src/prose';
const original=JSON.parse(readFileSync('docs/evidence/natural/r9-A2.json','utf8'));
const source=original.question;
const by=(r:Awaited<ReturnType<typeof reviewProse>>,kind:string)=>r.claims.filter(c=>c.kind===kind);

it('checks the real original A2 body, supports its actual local rule and finds its unsupported execution/reverse claims',async()=>{
 const r=await reviewProse(source,original.finalAnswer);expect(r.status).toBe('reviewed');expect(r.sourceKind).toBe('workflow-zh');
 expect(by(r,'workflow-retry-scope').some(c=>c.status==='supported')).toBe(true);expect(by(r,'workflow-rollback-scope').some(c=>c.status==='supported')).toBe(true);
 expect(by(r,'workflow-execution-causality').some(c=>c.status==='unsupported'&&c.quote.includes('已经完成'))).toBe(true);
 expect(by(r,'workflow-execution-causality').some(c=>c.status==='unsupported'&&c.quote.includes('阻碍回传'))).toBe(true);
 expect(by(r,'workflow-compensation').some(c=>c.status==='supported')).toBe(true);expect(r.groundedText).toContain('仅重试通知');
 for(const c of r.claims){expect(original.finalAnswer.slice(c.candidateSpan.utf16Start,c.candidateSpan.utf16End)).toBe(c.quote);expect(c.evidence.every(e=>e.sourceTextSha256===r.sourceTextSha256)).toBe(true);}
 expect(r.wholeCandidateVerified).toBe(false);
});
it.each([
 ['通知失败时。此时仅重试通知。该分支不回滚支付。','workflow-retry-scope','supported'],
 ['通知出错。只重试通知。不回滚支付。','workflow-rollback-scope','supported'],
 ['通知失败时，从头重试整个流程。','workflow-retry-scope','contradicted'],
 ['通知失败时。此时回滚支付。','workflow-rollback-scope','contradicted'],
 ['通知失败时，不重试整个流程。','workflow-retry-scope','supported'],
 ['通知失败时，不重试通知。','workflow-retry-scope','contradicted'],
 ['通知失败时，并非只重试通知。','workflow-retry-scope','contradicted'],
 ['通知失败时，不会回滚支付。','workflow-rollback-scope','supported'],
 ['通知失败时，不得回滚支付。','workflow-rollback-scope','supported'],
 ['通知失败时，不是不回滚支付。','workflow-rollback-scope','contradicted'],
 ['通知失败时，并非不会回滚支付。','workflow-rollback-scope','contradicted'],
 ['通知失败时，支付不会被回滚。','workflow-rollback-scope','supported'],
 ['通知失败时，支付会被回滚。','workflow-rollback-scope','contradicted'],
 ['通知失败后支付被回滚。','workflow-rollback-scope','contradicted'],
 ['通知失败时，整个流程都被重试。','workflow-retry-scope','contradicted'],
 ['并非通知失败就重试整个流程，而是只重试通知。','workflow-retry-scope','supported'],
 ['通知未失败时，不回滚支付。','workflow-rollback-scope','unknown'],
 ['只有通知失败才重试通知。','workflow-retry-scope','unknown'],
 ['不回滚支付。','workflow-rollback-scope','unknown'],
 ['通知失败时，会不会回滚支付？','workflow-rollback-scope','unknown'],
 ['通知和库存失败时，只重试通知。','workflow-retry-scope','unknown'],
 ['通知失败且库存失败时，只重试通知。','workflow-retry-scope','unknown'],
 ['通知失败时，不回滚库存。','workflow-rollback-scope','unsupported'],
 ['库存失败时，不回滚支付。','workflow-rollback-scope','unsupported'],
 ['通知失败时，重试三次直到成功。','workflow-retry-outcome','unsupported'],
 ['通知失败时，一定成功。','workflow-retry-outcome','unsupported'],
 ['通知失败时，不能保证重试一定成功。','workflow-retry-outcome','supported'],
 ['库存失败时，补偿支付。','workflow-compensation','unsupported'],
 ['库存失败时，补偿策略未知。','workflow-compensation','supported'],
 ['库存失败时，补偿支付，成功率未知。','workflow-compensation','unsupported'],
 ['库存失败时，补偿策略未知但会补偿支付。','workflow-compensation','supported'],
 ])('binds condition, polarity, target and range: %s',async(text,kind,status)=>{
 const r=await reviewProse(source,text);expect(by(r,kind)[0]?.status).toBe(status);
});
it('does not leak a previous branch through a new failure or paragraph',async()=>{
 const r=await reviewProse(source,'通知失败时。不回滚支付。库存失败时。此时也不回滚支付。\n\n不回滚支付。');
 expect(by(r,'workflow-rollback-scope').map(c=>c.status)).toEqual(['supported','unsupported','unknown']);
});
it('keeps unrelated unknowns and adversative clauses from certifying a positive execution or compensation claim',async()=>{
 const r=await reviewProse(source,'库存失败时，补偿策略未知但会补偿支付。上游已经完成的时间未知。');
 expect(by(r,'workflow-compensation').map(c=>c.status)).toEqual(['supported','unsupported']);expect(by(r,'workflow-execution-causality')[0]?.status).toBe('unsupported');
});
it('never binds unknown node names by a familiar suffix or substring',async()=>{
 const r=await reviewProse(source,'通知失败时，只重试邮件通知。该分支不回滚支付系统。');expect(by(r,'workflow-action-target').map(c=>c.status)).toEqual(['unsupported','unsupported']);
 const q=await reviewProse(source,'邮件通知失败时，不回滚支付。');expect(by(q,'workflow-rollback-scope')[0]?.status).toBe('unknown');
});
it.each([
 '通知失败时。日志故障。此时只重试通知。',
 '通知失败时。如果负载增大，只重试通知。',
 '通知失败时。即使通知成功，也不回滚支付。',
 ])('does not let a prior branch certify an unresolved or different antecedent: %s',async text=>{
 const r=await reviewProse(source,text);expect(r.claims.filter(c=>c.kind==='workflow-retry-scope'||c.kind==='workflow-rollback-scope').every(c=>c.status!=='supported')).toBe(true);
});
it('preserves independent branch policies and evaluates changed source rather than reusing an old correct conclusion',async()=>{
 const candidate='通知失败时，只重试通知。此时不回滚支付。';
 const a=await reviewProse(source,candidate),b=await reviewProse(source.replace('只重试通知','只重试支付'),candidate);
 expect(by(a,'workflow-retry-scope')[0]?.status).toBe('supported');expect(by(b,'workflow-retry-scope')[0]?.status).toBe('contradicted');expect(a.sourceTextSha256).not.toBe(b.sourceTextSha256);expect(a.candidateSha256).toBe(b.candidateSha256);
 const multi=source.replace('。通知出错','；库存失败仅重试库存，不回滚鉴权。通知出错'),r=await reviewProse(multi,'库存失败时，仅重试库存。此时不回滚鉴权。通知失败时，不回滚支付。');
 expect(r.status).toBe('reviewed');expect(by(r,'workflow-rollback-scope').every(c=>c.status==='supported')).toBe(true);
});
it('uses source labels and graph rules instead of hardcoded original nodes or the visible chart',async()=>{
 const r=await reviewProse('合成处理链为接入→审核→写账→回执；回执出错仅重试回执，不回滚写账。','回执出错。此时只重试回执。不回滚写账。回执是末端节点。审核没有下游。');
 expect(r.status).toBe('reviewed');expect(by(r,'workflow-retry-scope')[0]?.status).toBe('supported');expect(by(r,'workflow-rollback-scope')[0]?.status).toBe('supported');expect(by(r,'workflow-terminal-topology').map(c=>c.status)).toEqual(['supported','contradicted']);
});
it('respects negation and uncertainty when checking the limited terminal-node topology statement',async()=>{
 const r=await reviewProse(source,'通知不是末端节点。库存不是末端节点。通知是否是末端节点？');expect(by(r,'workflow-terminal-topology').map(c=>c.status)).toEqual(['contradicted','supported','unknown']);
});
it('rejects an unsupported source change and never trusts an old candidate or adds actions',async()=>{
 const r=await reviewProse(source.replace('不回滚支付','回滚支付'),'通知失败时不回滚支付。');expect(r.status).toBe('source-unsupported');expect(r.claims).toHaveLength(0);
});
