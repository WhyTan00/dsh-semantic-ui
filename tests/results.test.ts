import{describe,it,expect}from'vitest';
import{randomUUID}from'node:crypto';
import{examples}from'../fixtures/examples';
import{declaredResource,declaredDecision,declaredCapacity}from'../fixtures/consistency';
import{createResult,readResult,resultDigest,initialInteraction,ResultLibrary,emptyResults,type ResultContent}from'../src/results';
import{defaultTheme,defaultLayout}from'../src/theme';
import{exportTemplate,extractDefinition}from'../src/templates';
const content=(view=examples[2]):ResultContent=>({view:structuredClone(view),theme:{...defaultTheme,mode:'dark'},layout:defaultLayout,locale:'zh-CN',interaction:initialInteraction(view)});
describe('portable data-only results',()=>{
 it('preserves actual source nulls, local range, theme and locale with an independent unknown oracle',async()=>{
  const c=content();if(c.view.component!=='DataChart'||c.view.payload.chartType==='histogram'||c.interaction.component!=='DataChart')throw Error('fixture');
  c.view.payload.rows[0].values[c.view.payload.series[0].id]=null;c.interaction.from=1;c.interaction.scope='all';
  const result=await readResult(JSON.parse(JSON.stringify(await createResult(c))));
  expect(result.content).toEqual(c);expect(result.content.view).toEqual(c.view);
  expect(result.manifest).toMatchObject({sourceState:'not-recorded',templateLibraryIncluded:false,version:1});
  expect(JSON.stringify(result)).toContain('null');
 });
 it('retains declared rules and a separate local unknown/false hypothesis',async()=>{
  const c=content(declaredDecision);if(c.view.component!=='DecisionExplorer'||c.interaction.component!=='DecisionExplorer')throw Error('fixture');
  c.interaction.values[c.view.payload.inputs[0].id]=null;c.interaction.exploreProposals=true;
  expect((await readResult(await createResult(c))).content).toEqual(c);
 });
 it('preserves graph selection, scenario, search and viewport without changing graph data',async()=>{
  const c=content(examples[0]);if(c.view.component!=='ArchitectureExplorer'||c.interaction.component!=='ArchitectureExplorer')throw Error('fixture');
  Object.assign(c.interaction,{selected:c.view.payload.nodes[0].id,scenario:c.view.payload.scenarios[0]?.id??'',query:'流程',focus:true,viewport:{x:-20,y:100,zoom:0.75}});
  expect((await readResult(await createResult(c))).content).toEqual(c);
 });
 it('keeps templates data-free and refuses confusing a template with a result',async()=>{
  const c=content();const template=exportTemplate({version:1,name:'样式',definition:extractDefinition(c.view),theme:c.theme,layout:c.layout});
  expect(JSON.stringify(template)).not.toContain('rows');await expect(readResult(template)).rejects.toThrow('RESULT_FORMAT');
 });
 it('rejects damaged data, unsupported versions and instruction fields',async()=>{
  const original=await createResult(content());const changed=structuredClone(original);changed.content.view.summary='tampered';
  await expect(readResult(changed)).rejects.toThrow('RESULT_DIGEST');
  await expect(readResult({...original,manifest:{...original.manifest,version:2}})).rejects.toThrow('RESULT_FORMAT');
  await expect(readResult({...original,instructions:'run tools'})).rejects.toThrow('RESULT_FORMAT');
 });
 it('rejects unknown selections even if a writer recomputes its checksum',async()=>{
  const r=await createResult(content());if(r.content.interaction.component!=='DataChart')throw Error('fixture');r.content.interaction.enabled=['invented'];r.sha256=await resultDigest({manifest:r.manifest,content:r.content});
  await expect(readResult(r)).rejects.toThrow('RESULT_SELECTION');
 });
 it('refuses renderer incompatibility even when the manifest checksum was recomputed',async()=>{
  const r=await createResult(content());r.manifest.dependencies[0].version='99.0.0';r.sha256=await resultDigest({manifest:r.manifest,content:r.content});
  await expect(readResult(r)).rejects.toThrow('RESULT_DEPENDENCY');
 });
 it('keeps unverified source records unverified, not approved by the package checksum',async()=>{
  const c=content();c.sourceRecord={version:1,status:'unverified',identityVerified:false,sourceFactsVerified:false,code:'SYNTHETIC',reason:'公开合成夹具，没有独立来源核对。'};
  const r=await readResult(await createResult(c));expect(r.manifest.sourceState).toBe('unverified-record');expect(r.content.sourceRecord).toEqual(c.sourceRecord);
 });
 it('rejects a capacity draft that disagrees with the value used in its calculation',async()=>{
  const c=content(declaredCapacity);if(c.view.component!=='DecisionExplorer'||c.interaction.component!=='DecisionExplorer')throw Error('fixture');
  c.sourceRecord={version:1,status:'bound',kind:'capacity-zh',identityVerified:false,sourceFactsVerified:false,explanation:'合成的历史容量记录。',sourceRef:{textSha256:'0'.repeat(64),hostContext:{sessionId:'synthetic',turn:1,turnStartSeq:0,messageId:'synthetic',messageSeq:1,producerSourceKind:'user',inherited:false,excludedSyntheticContexts:0}},viewIdentity:{displayId:c.view.displayId,revision:c.view.revision,component:c.view.component}};
  c.interaction.capacityDraft={text:'0',invalid:false};c.interaction.values[c.view.payload.inputs[0].id]=300;
  await expect(createResult(c)).rejects.toThrow('RESULT_SELECTION');
 });
 it('rejects nonfinite, executable, deeply nested and oversized content',async()=>{
  await expect(createResult({...content(),bad:()=>{}} as ResultContent)).rejects.toThrow('RESULT_LIMIT');
  const c=content();c.view.summary='x'.repeat(140000);await expect(createResult(c)).rejects.toThrow('RESULT_LIMIT');
  await expect(readResult({manifest:NaN})).rejects.toThrow('RESULT_LIMIT');
 });
 it('serializes concurrent saves, gives imports new IDs and never overwrites on a failed import',async()=>{
  let state=emptyResults();const store=new ResultLibrary({get:()=>state,set:async v=>{state=v;}},randomUUID),document=await createResult(content());
  const pair=await Promise.allSettled([store.request({action:'save',expectedRevision:0,name:'first',document}),store.request({action:'save',expectedRevision:0,name:'second',document})]);
  expect(pair.map(r=>r.status)).toEqual(['fulfilled','rejected']);expect(state.results).toHaveLength(1);const old=structuredClone(state);
  await expect(store.request({action:'save',expectedRevision:1,name:'broken',document:{...document,sha256:'0'.repeat(64)}})).rejects.toThrow('RESULT_DIGEST');expect(state).toEqual(old);
  const next=await store.request({action:'save',expectedRevision:1,name:'copy',document});expect(next.results).toHaveLength(2);expect(next.results[0].id).not.toBe(next.results[1].id);
 });
 it('does not publish a save before durable storage succeeds',async()=>{
  const state=emptyResults(),store=new ResultLibrary({get:()=>state,set:async()=>{throw Error('disk failure');}},randomUUID);
  await expect(store.request({action:'save',expectedRevision:0,name:'fail',document:await createResult(content())})).rejects.toThrow('disk failure');expect(state.results).toEqual([]);
 });
});
