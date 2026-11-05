import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {reviewProse} from '../src/prose';
const original=JSON.parse(readFileSync('docs/evidence/natural/r9-D2.json','utf8')),source=original.question;
const by=(r:Awaited<ReturnType<typeof reviewProse>>,kind:string)=>r.claims.filter(c=>c.kind===kind);
it('reviews the actual original D2 body, preserving correct conditional capacity math and rejecting broader choices/control claims',async()=>{
 const r=await reviewProse(source,original.finalAnswer);expect(r.status).toBe('reviewed');expect(r.sourceKind).toBe('capacity-zh');expect(by(r,'capacity-eligibility').some(c=>c.status==='supported-hypothesis')).toBe(true);expect(by(r,'capacity-overall-choice').some(c=>c.status==='unsupported')).toBe(true);expect(by(r,'capacity-host-control').some(c=>c.status==='unsupported')).toBe(true);expect(by(r,'capacity-no-overall-ranking').some(c=>c.status==='supported')).toBe(true);
 expect(r.groundedText).toContain('80GB');expect(r.groundedText).toContain('已确认');expect(r.originalCandidate).toBe(original.finalAnswer);for(const c of r.claims)expect(original.finalAnswer.slice(c.candidateSpan.utf16Start,c.candidateSpan.utf16End)).toBe(c.quote);expect(r.wholeCandidateVerified).toBe(false);
});
it.each([
 ['当前需求为80GB。','capacity-current-demand','supported'],
 ['当前需求为300GB。','capacity-current-demand','contradicted'],
 ['当前需求不是80GB。','capacity-current-demand','contradicted'],
 ['当前需求未知。','capacity-current-demand-unknown','contradicted'],
 ['当前需求不等于300GB。','capacity-current-demand','supported'],
 ['现在已拥有300GB。','capacity-owned-versus-demand','unsupported'],
 ['以后可能到300GB。','capacity-future-demand','supported'],
 ['以后必然到300GB。','capacity-future-demand','unsupported'],
 ['以后可能到400GB。','capacity-future-demand','contradicted'],
 ['未来不可能到300GB。','capacity-future-demand','contradicted'],
 ['未来不一定到300GB。','capacity-future-demand','supported'],
 ['未来计划未知。','capacity-future-commitment','supported'],
 ['未来实际需求未知。','capacity-actual-future-unknown','supported'],
 ['未来已经确认计划。','capacity-future-commitment','unsupported'],
 ['未来没有计划。','capacity-future-commitment','unsupported'],
 ['明年可能到300GB。','capacity-future-date','unsupported'],
 ['A上限100GB。','capacity-limit','supported'],
 ['A上限100MiB。','capacity-limit','contradicted'],
 ['A部署简单。','capacity-deployment','supported'],
 ['A维护简单。','capacity-maintenance','unsupported'],
 ['容量达标不等于整体更合适。','capacity-no-overall-ranking','supported'],
 ['容量达标所以推荐B。','capacity-overall-choice','unsupported'],
 ['维护成本未知。','capacity-cost-policy','supported'],
 ['维护成本必须承受。','capacity-cost-policy','unsupported'],
 ])('checks quantity role, temporal certainty and source fields: %s',async(text,kind,status)=>{const r=await reviewProse(source,text);expect(by(r,kind)[0]?.status).toBe(status);});
it.each([
 ['当前需求80GB。此时A容量达标。','supported'],
 ['当前需求80GB。此时A容量不足。','contradicted'],
 ['当前需求300GB。A容量不足。','contradicted'],
 ['假设需求300GB，A容量不足。','supported-hypothesis'],
 ['以后可能到300GB。届时A容量不足。','supported-hypothesis'],
 ['以后可能到300GB。现在A容量不足。','contradicted'],
 ['以后可能到300GB。如果数据翻倍，届时A容量不足。','unknown'],
 ['当前需求80GB。未知情况。此时A容量达标。','unknown'],
 ])('shares the existing capacity evaluator without promoting a hypothesis: %s',async(text,status)=>{expect(by(await reviewProse(source,text),'capacity-eligibility')[0]?.status).toBe(status);});
it('rejects a later commitment and current-value retelling of a merely possible future point',async()=>{
 const r=await reviewProse(source,'以后可能到300GB。这个计划已确定。');expect(by(r,'capacity-future-commitment')[0]?.status).toBe('unsupported');
 const s=await reviewProse(source,'以后可能到300GB。它目前已经是300GB。');expect(by(s,'capacity-current-demand')[0]?.status).toBe('contradicted');
});
it('uses changed labels, quantities and current source revisions instead of question constants',async()=>{
 const text='合成存储选项 小盘 上限 60GiB、部署复杂，大盘 上限 500GiB、维护未知。当前需求 100GiB，未来可能到 240GiB。请比较。',candidate='当前需求100GiB。小盘容量不足。';
 const r=await reviewProse(text,candidate);expect(r.status).toBe('reviewed');expect(by(r,'capacity-eligibility')[0]?.status).toBe('supported');
 const revised=await reviewProse(text.replace('上限 60GiB','上限 120GiB'),candidate);expect(by(revised,'capacity-eligibility')[0]?.status).toBe('contradicted');expect(r.sourceTextSha256).not.toBe(revised.sourceTextSha256);expect(r.candidateSha256).toBe(revised.candidateSha256);
});
it('preserves an unspecified future as unknown and refuses an unsupported committed-source rewrite',async()=>{
 const s=source.replace('以后可能到 300GB。','');expect(by(await reviewProse(s,'未来计划未知。'),'capacity-future-commitment')[0]?.status).toBe('supported');
 expect((await reviewProse(source.replace('以后可能到','以后确定到'),'未来已经确定300GB。')).status).toBe('source-unsupported');
});
it('binds each ceiling to the nearest exact option instead of the first option in a sentence',async()=>{
 const r=await reviewProse(source,'A上限100GB和B上限1000GB。');expect(by(r,'capacity-limit').map(c=>c.status)).toEqual(['supported','supported']);
});
it('does not project current option limits into guaranteed future capability',async()=>{
 const r=await reviewProse(source,'未来A上限100GB。');expect(r.claims.every(c=>c.status!=='supported')).toBe(true);expect(r.claims.some(c=>c.status==='unsupported')).toBe(true);
 const dated=await reviewProse(source,'明年A上限100GB。');expect(by(dated,'capacity-limit')[0]?.status).toBe('unsupported');
});
it('does not relabel a possible future demand as future owned or provided capacity',async()=>{
 const r=await reviewProse(source,'未来可能有300GB。');expect(by(r,'capacity-future-provided')[0]?.status).toBe('unsupported');
});
it.each(['现在已按300GB预留。','我们不按300GB预留。'])('does not turn an asserted or negated reserve policy into a positive demand hypothesis: %s',async text=>{
 const r=await reviewProse(source,text);expect(r.claims.every(c=>c.status!=='supported-hypothesis')).toBe(true);expect(r.claims.some(c=>c.status==='unsupported'||c.status==='unknown')).toBe(true);
});
it('does not use a capacity pass to certify security or all requirements',async()=>{
 const r=await reviewProse(source,'现在B满足安全需求。');expect(r.claims.every(c=>c.status!=='supported')).toBe(true);expect(r.claims.some(c=>c.status==='unsupported')).toBe(true);
 const s=await reviewProse(source,'当前需求80GB。B满足所有需求。');expect(s.claims.filter(c=>c.kind==='capacity-eligibility').some(c=>c.status==='supported')).toBe(false);
});
it('includes an independent supported local demand scenario in the grounded explanation',async()=>{
 const r=await reviewProse(source,'假设需求200GB，A容量不足。');expect(r.groundedText).toContain('需求假设200GB');expect(r.sourceExplanation).toContain('80GB');
});
it('does not promote hypothetical demand points into objective or confirmed temporal stages',async()=>{
 const r=await reviewProse(source,original.finalAnswer);expect(by(r,'capacity-stage-promotion').some(c=>c.status==='unsupported')).toBe(true);
 const s=await reviewProse(source,'以后可能到300GB。这个阶段已确定。');expect(by(s,'capacity-future-commitment').some(c=>c.status==='unsupported')).toBe(true);
});
