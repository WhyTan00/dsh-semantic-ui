import {it,expect} from 'vitest';
import {readFileSync} from 'node:fs';
import {createHash} from 'node:crypto';
import {checkResultPackage} from '../src/result-interop';
import {createResult,initialInteraction,resultDigest,type ResultContent} from '../src/results';
import {captureDecision} from '../src/scenarios';
import {makeConditionDraft} from '../src/condition-form';
import {defaultTheme,defaultLayout} from '../src/theme';
import {readSourceSnapshot} from '../src/source-input';
import type {Envelope} from '../src/protocol';
const request=JSON.parse(readFileSync('fixtures/source-capacity-request.json','utf8'))[0],view=request.view as Extract<Envelope,{component:'DecisionExplorer'}>;
export async function capacityResult(){
 const interaction=initialInteraction(view);if(interaction.component!=='DecisionExplorer')throw Error('fixture');
 const a=captureDecision(view.payload,interaction.values,interaction.dimensions,false);interaction.scenarioComparison={version:1,a,viewing:'a'};interaction.values={...interaction.values,'quantity-fixture':120};interaction.conditionDraft=makeConditionDraft(view.payload,interaction.values);interaction.conditionDraft.fields['quantity-fixture'].text='NaN';
 return createResult({view:structuredClone(view),theme:{...defaultTheme,mode:'dark'},layout:defaultLayout,locale:'en',interaction});
}
const source=()=>readSourceSnapshot({file:'fixtures/capacity-source.json',jsonPointer:'/text',kind:'capacity-zh'});
it('retains the real preview31 synthetic pair, source record, locale, theme, selection and draft without a source claim',async()=>{
 const bytes=readFileSync('docs/evidence/scenarios/examples/pair.json'),document=JSON.parse(bytes.toString()),before=createHash('sha256').update(bytes).digest('hex'),r=await checkResultPackage({document});
 expect(r.status).toBe('checked-unverified');expect(r.document).toEqual(document);expect(r).toHaveProperty('layers.sourceComparison.status','not-configured');expect(r).toHaveProperty('layers.local.viewing','a');expect(r).toHaveProperty('layers.local.aComputed.eligibleOptionIds',['managed']);expect(r).toHaveProperty('layers.local.bComputed.eligibleOptionIds',['vm']);expect(r.identityVerified).toBe(false);expect(r.sourceFactsVerified).toBe(false);expect(r.explanationZh).toContain('来源映射未核');expect(createHash('sha256').update(readFileSync('docs/evidence/scenarios/examples/pair.json')).digest('hex')).toBe(before);
});
it('binds only the original capacity view to a separate caller source and computes A80/B120 without applying NaN',async()=>{
 const document=await capacityResult(),r=await checkResultPackage({document,mapping:request.mapping},await source());expect(r.status).toBe('limited-delivery');expect(r.structuredStatus).toBe('checked');expect(r.document).toEqual(document);expect(r).toHaveProperty('retained.locale','en');expect(r).toHaveProperty('retained.theme.mode','dark');expect(r).toHaveProperty('layers.sourceComparison.comparison.status','matched');expect(r).toHaveProperty('layers.local.aComputed.eligibleOptionIds',['option-fixture-0','option-fixture-1']);expect(r).toHaveProperty('layers.local.bComputed.eligibleOptionIds',['option-fixture-1']);expect(r).toHaveProperty('layers.local.draftValidation.ok',false);expect(r).toHaveProperty('document.content.interaction.values.quantity-fixture',120);expect(r).toHaveProperty('document.content.view.payload.inputs.0.initial',80);expect(r.explanationZh).toContain('未认证作者');expect(r.identityVerified).toBe(false);
});
it('refuses a tampered source coordinate and preserves the original document and the caller source',async()=>{
 const document=await capacityResult(),s=await source(),before=JSON.stringify(s),r=await checkResultPackage({document,mapping:{...request.mapping,demandInputId:'limit-fixture'}},s);expect(r.status).toBe('source-mismatch');expect(r.document).toEqual(document);expect(JSON.stringify(s)).toBe(before);expect(r).toHaveProperty('layers.sourceComparison.source.textSha256',s.textSha256);
});
it('does not replace a changed original quantity with local A/B values to make a source match',async()=>{
 const document=await capacityResult();if(document.content.view.component!=='DecisionExplorer')throw Error('fixture');document.content.view.payload.inputs[0].initial=90;document.sha256=await resultDigest({manifest:document.manifest,content:document.content});const r=await checkResultPackage({document,mapping:request.mapping},await source());expect(r.status).toBe('source-mismatch');expect(r).toHaveProperty('document.content.view.payload.inputs.0.initial',90);expect(r).toHaveProperty('document.content.interaction.scenarioComparison.a.values.quantity-fixture',80);
});
it('cannot authenticate a saved bound-source record, or silently change its recorded source digest',async()=>{
 const base=await capacityResult();const c=base.content;c.sourceRecord={version:1,status:'bound',kind:'capacity-zh',identityVerified:false,sourceFactsVerified:false,explanation:'合成历史记录，未认证身份。',sourceRef:{textSha256:'0'.repeat(64),hostContext:{sessionId:'synthetic',turn:1,turnStartSeq:0,messageId:'synthetic',messageSeq:1,producerSourceKind:'user',inherited:false,excludedSyntheticContexts:0}},viewIdentity:{displayId:c.view.displayId,revision:c.view.revision,component:c.view.component}};const document=await createResult(c);
 const absent=await checkResultPackage({document,mapping:request.mapping});expect(absent.status).toBe('checked-unverified');expect(absent.identityVerified).toBe(false);const different=await checkResultPackage({document,mapping:request.mapping},await source());expect(different.status).toBe('source-mismatch');expect(different).toHaveProperty('layers.recordedSourceConsistency','different-text-digest');expect(different.document).toEqual(document);
});
it('refuses source/authority arguments and executable or over-limit mapping data',async()=>{
 const document=await capacityResult();for(const raw of [{document,source:'replace'},{document,approved:true},{document,mapping:()=>{}},{document,mapping:'x'.repeat(140000)}])expect((await checkResultPackage(raw,await source())).status).toBe('invalid-request');
});
it.each(['digest','version','dependency'])('rejects %s incompatibility without returning a substitute document',async kind=>{
 const document=await capacityResult();if(kind==='digest')document.sha256='0'.repeat(64);if(kind==='version')(document.manifest as unknown as {version:number}).version=99;if(kind==='dependency'){document.manifest.dependencies[0].version='99';document.sha256=await resultDigest({manifest:document.manifest,content:document.content});}const r=await checkResultPackage({document});expect(r.status).toBe('invalid-result');expect(r.document).toBeUndefined();
});
it.each(['docs/evidence/result-package/examples/1.json','fixtures/result-compat/preview30.json'])('reads previous format data unchanged: %s',async file=>{const document=JSON.parse(readFileSync(file,'utf8')),r=await checkResultPackage({document});expect(r.status).toBe('checked-unverified');expect(r.document).toEqual(document);});
it('preserves numeric source nulls, observed zero and negative values with an explicitly full-data calculation scope',async()=>{
 const document=JSON.parse(readFileSync('docs/evidence/result-package/examples/2.json','utf8')),r=await checkResultPackage({document});expect(r.document).toEqual(document);expect(r).toHaveProperty('layers.local.recomputedAsSource',false);expect(r).toHaveProperty('layers.declarations.dataFacts.scope','original-full-data');expect(JSON.stringify(r.document)).toContain('null');
});
