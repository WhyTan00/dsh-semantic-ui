import {useRef,useState} from 'react';
import type {SourceUpdateBase,SourceUpdateBridge,SourceUpdateResult} from '../source-update-contract';
import {retainSourceUpdateRequest} from '../source-update-contract';
const updateReason:Record<string,string>={
 UPDATE_SESSION_ARCHIVED:'会话已归档；此入口不会恢复归档会话。',
 UPDATE_SESSION_BUSY:'会话有正在执行或排队的工作；等其结束后可重新查看。',
 UPDATE_SESSION_AUTOMATION:'此入口仅支持没有目标或排程记录的普通会话，请从原任务入口继续。',
 UPDATE_SESSION_OWNERSHIP:'会话由其他执行入口持有，无法在这里补充。',
 UPDATE_GUARD_UNAVAILABLE:'无法读取完整的原生状态；本次没有确认提交。',
 UPDATE_STALE_BASE:'这份视图已不是当前来源，请查看会话中的最新视图。',
 UPDATE_RESUME_REJECTED:'宿主未允许恢复此会话，请检查原会话的状态。',
 UPDATE_SUBMIT_PENDING:'原请求仍在处理；请核对同一个请求 ID。',
};

/** Source edits are explicit submissions; DecisionExplorer controls remain local. */
export function SourceUpdatePanel({base,bridge}:{base:SourceUpdateBase;bridge?:SourceUpdateBridge}){
 const [result,setResult]=useState<SourceUpdateResult>(),[condition,setCondition]=useState(''),[value,setValue]=useState('unknown'),[busy,setBusy]=useState(false);
 const sending=useRef(false),requestId=useRef<string|undefined>(undefined);
 if(!bridge)return null;
 const field=result?.fields?.find(f=>f.condition===condition);
 async function invoke(action:'offer'|'submit'|'status'){
  if(sending.current)return;sending.current=true;setBusy(true);
  try{
   if(action==='submit')requestId.current??=crypto.randomUUID();
   const r=await bridge!(action==='offer'?{action,base}:action==='status'?{action,sessionId:base.sessionId,requestId:requestId.current!}:{action,base,condition,value:value==='true',requestId:requestId.current!});
   const next=retainSourceUpdateRequest(r,requestId.current);setResult(next);if(next.requestId)requestId.current=next.requestId;if(next.fields?.length)setCondition(next.fields[0].condition);
  }catch{setResult({status:'unknown',code:'UPDATE_TRANSPORT_UNCERTAIN',requestId:requestId.current,sourceFactsVerified:false,identityVerified:false,freeProseVerified:false});}
  finally{sending.current=false;setBusy(false);}
 }
 return <section aria-label="补充来源条件" data-source-update>
  <details><summary>补充未知来源条件</summary>
   <p className="meta">仅补充一个明确未知的当前布尔条件。确认后通过正常聊天入口提交完整的新来源，可能启动下一轮；不会修改旧消息，也不认证世界事实。</p>
   {!result?<button disabled={busy} onClick={()=>void invoke('offer')}>查看可补充条件</button>:null}
   {result?.status==='available'?(result.fields?.length?<>
    <label>来源条件<select aria-label="待补充来源条件" value={condition} disabled={busy} onChange={e=>{setCondition(e.target.value);setValue('unknown');}}>{result.fields.map(f=><option key={f.condition} value={f.condition}>{f.condition}</option>)}</select></label>
    <label>当前事实声明<select aria-label="当前事实声明" value={value} disabled={busy} onChange={e=>setValue(e.target.value)}><option value="unknown">保留未知</option><option value="true">是</option><option value="false">否</option></select></label>
    <p>改动范围：{field?.before} → {value==='unknown'?'保持原文':`当前${condition}为${value==='true'?'是':'否'}`}。分支、方案能力和价格保持原文。</p>
    <button disabled={busy||value==='unknown'||!condition} onClick={()=>void invoke('submit')}>提交来源补充</button>
    <button disabled={busy} onClick={()=>{setResult(undefined);setValue('unknown');}}>取消补充</button>
   </>:<p>本版本没有可补充的单个未知当前条件。</p>):null}
   {result&&result.status!=='available'?<div role="status" aria-live="polite">
    <p>{result.status==='adopted'?'已核实：新来源消息已持久化，新的语义视图已采用。':result.status==='message-persisted'?'已核实新来源消息持久化；尚未核实新的语义视图。':result.admission==='accepted'?'宿主已接收请求；消息持久化和新视图仍待核对。':result.status==='unknown'?'提交结果未明；只能核对原请求，不会自动重发。':'本次未确认来源更新。'} {result.code&&updateReason[result.code]||result.code}</p>
    {result.status==='withheld'&&!result.requestId&&!requestId.current?<button disabled={busy} onClick={()=>{setValue('unknown');void invoke('offer');}}>重新查看可补充条件</button>:null}
    {result.requestId?<><p>请求 ID：{result.requestId}</p><button disabled={busy} onClick={()=>void invoke('status')}>核对原请求状态</button></>:null}
    {result.message?<p>新来源 SHA-256：{result.message.textSha256} · 回合 {result.message.turn} · 消息序号 {result.message.seq}</p>:null}
    {result.status==='adopted'&&result.checkpoint?<p>新视图：{result.checkpoint.displayId} · revision {result.checkpoint.revision}。这里只核实来源采用；模型自由正文未认证。</p>:null}
   </div>:null}
  </details>
 </section>;
}
