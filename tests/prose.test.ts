import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {reviewProse,type ProseReview} from '../src/prose';
const saved=(id:string)=>JSON.parse(readFileSync(`docs/evidence/natural/r9-${id}.json`,'utf8'));
const d=saved('D1'),n=saved('N2');
const claim=(r:ProseReview,kind:string)=>r.claims.filter(c=>c.kind===kind);

it('finds the actual saved D1 unsupported monthly fee while preserving correct cautious prose and exact locations',async()=>{
 const r=await reviewProse(d.question,d.finalAnswer);
 expect(r.status).toBe('reviewed');expect(claim(r,'price-period').some(c=>c.status==='unsupported')).toBe(true);
 expect(r.claims.some(c=>c.status==='supported')).toBe(true);expect(r.originalCandidate).toBe(d.finalAnswer);
 for(const c of r.claims){expect(d.finalAnswer.slice(c.candidateSpan.utf16Start,c.candidateSpan.utf16End)).toBe(c.quote);expect(c.evidence.every(e=>e.sourceTextSha256===r.sourceTextSha256)).toBe(true);}
 expect(r.wholeCandidateVerified).toBe(false);expect(r.groundedText).toContain('价格');
});
it('finds the saved N2 universal-fill error and unsupported median without approving the whole body',async()=>{
 const r=await reviewProse(n.question,n.finalAnswer);
 expect(r.status).toBe('reviewed');expect(claim(r,'universal-fill-changes-mean').some(c=>c.status==='contradicted')).toBe(true);
 expect(claim(r,'unsupported-median').some(c=>c.status==='unsupported')).toBe(true);
 expect(r.claims.some(c=>c.status==='supported')).toBe(true);expect(r.groundedText).toContain('反例');expect(r.wholeCandidateVerified).toBe(false);
 for(const c of r.claims)expect(n.finalAnswer.slice(c.candidateSpan.utf16Start,c.candidateSpan.utf16End)).toBe(c.quote);
});
it.each([
 ['已观测三个读数的均值为0摄氏度。','supported'],
 ['有效读数平均值是0 ℃。','supported'],
 ['已观测均值不是1摄氏度。','supported'],
 ['已观测均值不是0摄氏度。','contradicted'],
 ['已观测四个读数的均值为0摄氏度。','contradicted'],
 ['已观测均值为0华氏度。','contradicted'],
 ['已观测均值为0瓦特。','contradicted'],
 ['完整四次读数均值为0摄氏度。','unsupported'],
 ['平均值为0摄氏度。','unknown'],
 ['假设缺失补零，完整四次读数均值为0摄氏度。','supported-hypothesis'],
 ])('checks numeric polarity, range, denominator and units: %s',async(text,status)=>{
 const r=await reviewProse(n.question,text);expect(claim(r,'mean-value')[0]?.status).toBe(status);
});
it('checks complete unknown and keeps all hypothetical values separate from observations',async()=>{
 const r=await reviewProse(n.question,'完整四次读数的均值未知。缺失不是实测0。假设缺失补零，完整四次读数均值为0摄氏度。');
 expect(claim(r,'complete-mean-unknown')[0]?.status).toBe('supported');expect(claim(r,'missing-versus-zero')[0]?.status).toBe('supported');
 expect(claim(r,'mean-value')[0]?.status).toBe('supported-hypothesis');expect(r.groundedText).toContain('完整真实均值仍未知');
});
it('source revision re-evaluates the same candidate and does not reuse a previous verdict',async()=>{
 const first=await reviewProse(n.question,'已观测均值为0摄氏度。'),second=await reviewProse(n.question.replace('缺失、2','缺失、6'),'已观测均值为0摄氏度。');
 expect(claim(first,'mean-value')[0]?.status).toBe('supported');expect(claim(second,'mean-value')[0]?.status).toBe('contradicted');expect(first.sourceTextSha256).not.toBe(second.sourceTextSha256);expect(first.candidateSha256).toBe(second.candidateSha256);
});
it('does not hardcode the original question ID, labels, count or zero-centered values',async()=>{
 const r=await reviewProse('测试仪三次压力读数是 3、缺失、9 千帕。','已观测两个读数的均值为6千帕。缺失无论填什么都会改变均值。');
 expect(r.status).toBe('reviewed');expect(claim(r,'mean-value')[0]?.status).toBe('supported');expect(claim(r,'universal-fill-changes-mean')[0]?.counterexample).toMatchObject({fillValue:6,imputedMean:6});
});
it('rejects an unsupported choice and maintenance inference while computing an explicit resource hypothesis',async()=>{
 const r=await reviewProse(d.question,'推荐托管平台。托管平台不需要团队维护。假设团队没有维护余力，虚拟机不可行。');
 expect(claim(r,'overall-recommendation')[0]?.status).toBe('unsupported');expect(claim(r,'maintenance-need')[0]?.status).toBe('unsupported');expect(claim(r,'hard-feasibility')[0]?.status).toBe('supported-hypothesis');
});
it('does not turn no recommendation or questions into a positive preference',async()=>{
 const r=await reviewProse(d.question,'不产生推荐。不宜先做选择。我们目前不需要私网。');
 expect(claim(r,'overall-recommendation')).toHaveLength(0);expect(claim(r,'withheld-recommendation').every(c=>c.status==='supported')).toBe(true);expect(claim(r,'current-capability-need')[0]?.status).toBe('supported');
 expect(claim(await reviewProse(d.question,'不推荐托管平台。是否推荐托管平台？'),'overall-recommendation')).toHaveLength(0);
});
it('retains escaped JSON token positions and checks negated universal claims with a counterexample',async()=>{
 const text='```dsh-ui\n'+JSON.stringify({nodes:[{content:'并非缺失无论填什么都会改变均值。'}]})+'\n```';
 const r=await reviewProse(n.question,text),claims=claim(r,'universal-fill-changes-mean');expect(claims.every(c=>c.status==='supported')).toBe(true);
 const extracted=claims.find(c=>c.candidateSpan.jsonPointer);expect(extracted?.candidateSpan.jsonPointer).toBe('/nodes/0/content');expect(text.slice(extracted!.candidateSpan.utf16Start,extracted!.candidateSpan.utf16End)).toBe(extracted?.quote);
});
it('keeps arbitrary claims uncovered and refuses unsupported source or excessive input',async()=>{
 const r=await reviewProse(n.question,'设备来自火星。');expect(r.uncovered[0]?.text).toBe('设备来自火星。');expect(r.groundedText).not.toContain('火星');
 expect((await reviewProse('普通问题','很好。')).status).toBe('source-unsupported');expect((await reviewProse(n.question,'x'.repeat(24001))).status).toBe('refused');
});
