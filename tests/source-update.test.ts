import {describe,it,expect} from 'vitest';
import {randomUUID} from 'node:crypto';
import {sourceTextSha,reviseUnknownCondition,sourceUpdateFields} from '../src/source-update';
import {sourceUpdateRequestSchema} from '../src/source-update-contract';
import {sourceUpdateProjection,flushSourceUpdateReceipt} from '../src/dsh/source-update';
import {conditionRequest} from '../fixtures/source-condition';
import {bindDecisionView} from '../src/source-delivery';
import type {SourceSnapshot} from '../src/source-graph';

const text='测试小组在选甲方与乙方。前者支持审计；后者不支持审计。若公开服务，则我们需要审计；否则我们不需要审计。当前公开服务未知。两边价格都未知。';
const snapshot=(excerpt=text):SourceSnapshot=>({kind:'decision-zh',textSha256:sourceTextSha(excerpt),excerptSha256:sourceTextSha(excerpt),textBytes:Buffer.byteLength(excerpt),textByteStart:0,textByteEnd:Buffer.byteLength(excerpt),excerpt,hostContext:{sessionId:'session-test',turn:0,turnStartSeq:0,messageId:'m-original',messageSeq:1,producerSourceKind:'user',inherited:false,excludedSyntheticContexts:0}});
const initial=()=>sourceUpdateProjection.init({id:'session-test'} as any,0 as any);
function fold(s:ReturnType<typeof initial>,type:string,seq:number,data:unknown){return sourceUpdateProjection.apply(s,{type,seq,time:100,data,...(type.startsWith('plugin:')?{ignorable:true}:{})} as any);}
function original(close=true){let s=fold(initial(),'turn/start',0,{turn:0});s=fold(s,'user/message',1,{role:'user',id:'m-original',source:{kind:'user'},content:[{type:'text',text}]});const {view,mapping}=conditionRequest(['甲方','乙方'],'审计',null,[true,false],'test');const b=bindDecisionView(snapshot(),view,mapping);if(!b.ok)throw Error('Fixture binding');s=fold(s,'tool/result',3,{meta:{dshSemanticUi:{turn:0,view:b.view,sourceDelivery:{version:1,status:'bound',kind:'decision-zh',explanation:b.explanation,sourceRef:{textSha256:snapshot().textSha256,hostContext:snapshot().hostContext},viewIdentity:{displayId:b.view.displayId,revision:1,component:'DecisionExplorer'},identityVerified:false,sourceFactsVerified:false}}}});return close?fold(s,'turn/end',4,{}):s;}

describe('one explicit unknown current boolean declaration',()=>{
 it('changes only the exact UTF8 range and preserves both branches/support/prices',()=>{
  for(const value of [true,false]){const r=reviseUnknownCondition(snapshot(),'公开服务',value);expect(r.text).toBe(text.replace('当前公开服务未知','当前公开服务为'+(value?'是':'否')));expect(r.change.from).toBeNull();expect(sourceUpdateFields(snapshot(r.text))).toHaveLength(0);}
  expect(reviseUnknownCondition(snapshot(text.replace('公开服务未知','公开服务为未知')),'公开服务',true).text).toBe(text.replace('公开服务未知','公开服务为是'));
 });
 it('rejects missing/repeated/current known declarations, bad hashes and nonboolean/unknown values',()=>{
  expect(sourceUpdateFields(snapshot(text.replace('当前公开服务未知。','')))).toEqual([]);
  expect(sourceUpdateFields(snapshot(text.replace('当前公开服务未知。','当前公开服务未知。当前公开服务未知。')))).toEqual([]);
  expect(()=>reviseUnknownCondition(snapshot(),'审计',true)).toThrow('UPDATE_FIELD');
  for(const v of [null,'true',0,{},undefined])expect(()=>reviseUnknownCondition(snapshot(),'公开服务',v as any)).toThrow('UPDATE_VALUE');
  expect(()=>sourceUpdateFields({...snapshot(),textSha256:'a'.repeat(64)})).toThrow('UPDATE_SOURCE');
 });
 it('strictly bounds session/view/base and disallows extra fields, source overrides and multiple edits',()=>{
  const base=original().base!.identity,req={action:'submit',base,condition:'公开服务',value:true,requestId:randomUUID()};
  expect(sourceUpdateRequestSchema.safeParse(req).success).toBe(true);
  for(const extra of [{capability:true},{source:text},{updates:[]},{mode:'steer'}])expect(sourceUpdateRequestSchema.safeParse({...req,...extra}).success).toBe(false);
  for(const value of [null,'true',{},[]])expect(sourceUpdateRequestSchema.safeParse({...req,value}).success).toBe(false);
 });
 it('keeps admission intent distinct from an exact native user message and a new own-turn checkpoint',()=>{
  let s=original();const old=JSON.stringify(s.base),requestId=randomUUID(),rev=reviseUnknownCondition(s.base!.source,'公开服务',true),intent={version:1,requestId,base:s.base!.identity,condition:'公开服务',value:true,nextTextSha256:rev.nextTextSha256,change:rev.change};
  s=fold(s,'plugin:dsh-semantic-ui/source-update-intent',5,intent);expect(s.receipts[0].message).toBeUndefined();
  s=fold(s,'turn/start',6,{turn:1});s=fold(s,'user/message',7,{role:'user',id:'m-new',source:{kind:'user',rpcId:requestId},content:[{type:'text',text:rev.text}]});expect(s.receipts[0].message?.textSha256).toBe(rev.nextTextSha256);expect(s.receipts[0].checkpoint).toBeUndefined();expect(s.base).toBeNull();
  const snap={...snapshot(rev.text),hostContext:{...snapshot().hostContext!,turn:1,turnStartSeq:6,messageId:'m-new',messageSeq:7,requestId}},req=conditionRequest(['甲方','乙方'],'审计',true,[true,false],'new'),b=bindDecisionView(snap,req.view,req.mapping);if(!b.ok)throw Error('Fixture binding');
  s=fold(s,'tool/result',9,{meta:{dshSemanticUi:{turn:1,view:b.view,sourceDelivery:{version:1,status:'bound',kind:'decision-zh',explanation:b.explanation,sourceRef:{textSha256:rev.nextTextSha256,hostContext:snap.hostContext},viewIdentity:{displayId:b.view.displayId,revision:1,component:'DecisionExplorer'},identityVerified:false,sourceFactsVerified:false}}}});
  expect(s.receipts[0].checkpoint?.textSha256).toBe(rev.nextTextSha256);expect(s.base?.identity.messageId).toBe('m-new');expect(old).toContain('当前公开服务未知');expect(s.receipts[0].checkpoint?.explanation).toContain('乙方不满足本项');
 });
 it('withholds changed-content and intervening-source cases rather than laundering intent',()=>{
  for(const wrong of [true,false]){let s=original();const rev=reviseUnknownCondition(s.base!.source,'公开服务',true),requestId=randomUUID();s=fold(s,'plugin:dsh-semantic-ui/source-update-intent',5,{version:1,requestId,base:s.base!.identity,condition:'公开服务',value:true,nextTextSha256:rev.nextTextSha256,change:rev.change});s=fold(s,'turn/start',6,{turn:1});s=fold(s,'user/message',7,{role:'user',id:'other',source:{kind:'user',rpcId:wrong?requestId:randomUUID()},content:[{type:'text',text}]});expect(s.receipts[0].issue).toBe(wrong?'UPDATE_MESSAGE_MISMATCH':'UPDATE_INTERVENING_SOURCE');expect(s.receipts[0].message).toBeUndefined();}
 });
 it('replays derived receipts while excluding inherited intent and rejects unsupported altered intent',()=>{
  let s=original(),base=s.base!.identity;const rev=reviseUnknownCondition(s.base!.source,'公开服务',true);s=fold(s,'plugin:dsh-semantic-ui/source-update-intent',5,{version:1,requestId:randomUUID(),base,condition:'公开服务',value:true,nextTextSha256:'f'.repeat(64),change:rev.change});expect(s.blocked).toBe(true);
  const inherited=sourceUpdateProjection.init({id:'child'} as any,1 as any);expect(fold(inherited,'plugin:dsh-semantic-ui/source-update-intent',0,{}).receipts).toEqual([]);
 });
 it('keeps the latest rendered revision as the editable base and withholds same-revision conflicts',()=>{
  let s=original(false);const req=conditionRequest(['甲方','乙方'],'审计',null,[true,false],'test');
  const event=(revision:number,title='来源当前需求')=>{req.view.revision=revision;req.view.payload.title=title;const b=bindDecisionView(snapshot(),req.view,req.mapping);if(!b.ok)throw Error('Fixture binding');const recorded=structuredClone(b.view);recorded.summary=title;return {meta:{dshSemanticUi:{turn:0,view:recorded,sourceDelivery:{version:1,status:'bound',kind:'decision-zh',explanation:b.explanation,sourceRef:{textSha256:snapshot().textSha256,hostContext:snapshot().hostContext},viewIdentity:{displayId:b.view.displayId,revision,component:'DecisionExplorer'},identityVerified:false,sourceFactsVerified:false}}}};};
  s=fold(s,'tool/result',5,event(2));expect(s.base?.identity.revision).toBe(2);
  s=fold(s,'tool/result',6,event(1));expect(s.base?.identity.revision).toBe(2);
  s=fold(s,'tool/result',7,event(2,'Conflicting same-revision content'));expect(s.base).toBeNull();
 });
 it('does not certify a message or checkpoint appended while flush is suspended',async()=>{
  let s=original();const requestId=randomUUID(),rev=reviseUnknownCondition(s.base!.source,'公开服务',true);
  s=fold(s,'plugin:dsh-semantic-ui/source-update-intent',5,{version:1,requestId,base:s.base!.identity,condition:'公开服务',value:true,nextTextSha256:rev.nextTextSha256,change:rev.change});
  let seq=5,release!:()=>void;
  const read=()=>({receipt:s.receipts[0],blocked:s.blocked,asOfSeq:seq});
  const first=flushSourceUpdateReceipt(read,()=>new Promise<boolean>(resolve=>{release=()=>resolve(true);}),requestId);
  s=fold(s,'turn/start',6,{turn:1});s=fold(s,'user/message',7,{role:'user',id:'m-new',source:{kind:'user',rpcId:requestId},content:[{type:'text',text:rev.text}]});seq=7;release();
  const a=await first;expect(a.status).toBe('unknown');expect(a.message).toBeUndefined();expect(a.checkpoint).toBeUndefined();expect(a.asOfSeq).toBe(5);
  const second=flushSourceUpdateReceipt(read,()=>new Promise<boolean>(resolve=>{release=()=>resolve(true);}),requestId);
  const snap={...snapshot(rev.text),hostContext:{...snapshot().hostContext!,turn:1,turnStartSeq:6,messageId:'m-new',messageSeq:7,requestId}},req=conditionRequest(['甲方','乙方'],'审计',true,[true,false],'later'),b=bindDecisionView(snap,req.view,req.mapping);if(!b.ok)throw Error('Fixture binding');
  s=fold(s,'tool/result',9,{meta:{dshSemanticUi:{turn:1,view:b.view,sourceDelivery:{version:1,status:'bound',kind:'decision-zh',explanation:b.explanation,sourceRef:{textSha256:rev.nextTextSha256,hostContext:snap.hostContext},viewIdentity:{displayId:b.view.displayId,revision:1,component:'DecisionExplorer'},identityVerified:false,sourceFactsVerified:false}}}});seq=9;release();
  const bResult=await second;expect(bResult.status).toBe('message-persisted');expect(bResult.message?.id).toBe('m-new');expect(bResult.checkpoint).toBeUndefined();expect(bResult.asOfSeq).toBe(7);
  const final=await flushSourceUpdateReceipt(read,async()=>true,requestId);expect(final.status).toBe('adopted');expect(final.checkpoint?.seq).toBe(9);expect(final.asOfSeq).toBe(9);
  const noDurability=await flushSourceUpdateReceipt(read,async()=>false,requestId);expect(noDurability.status).toBe('unknown');expect(noDurability.durable).toBe(false);expect(noDurability.message).toBeUndefined();expect(noDurability.checkpoint).toBeUndefined();
 });
});
