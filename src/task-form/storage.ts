import {ResultLibrary,resultsSchema,emptyResults,createResult,initialInteraction,type ResultsBridge,type ResultPackage} from '../results';
import {taskView,type TaskRecord} from './core';
export const TASK_RESULTS_KEY='dsh-semantic-ui.task-results.v1';
export const taskResultName=(document:ResultPackage,preferred='')=>(preferred.trim()||`${document.content.taskForm!.template.name} · ${document.content.taskForm!.status==='confirmed'?'确认':'草稿'} v${document.content.taskForm!.lineage.revision}`).slice(0,80);
/** Same ResultLibrary and limits; no chat log, host RPC or access to old browser libraries. */
export function taskResults(storage:Pick<Storage,'getItem'|'setItem'>,uuid:()=>string,exclusive:<T>(job:()=>Promise<T>)=>Promise<T>):ResultsBridge{
 const read=()=>{const raw=storage.getItem(TASK_RESULTS_KEY);return raw===null?emptyResults():resultsSchema.parse(JSON.parse(raw));};
 const lib=new ResultLibrary({get:read,async set(next){if(read().revision!==next.revision-1)throw Error('RESULT_CONFLICT');storage.setItem(TASK_RESULTS_KEY,JSON.stringify(next));}},uuid);
 return request=>{if(request.action==='save'&&(request.document as ResultPackage)?.manifest?.version!==5)throw Error('TASK_RESULT_REQUIRED');return request.action==='list'?lib.request(request):exclusive(()=>lib.request(request));};
}
let bridge:ResultsBridge|undefined;
export const browserTaskResults:ResultsBridge=request=>{
 bridge??=taskResults({getItem:key=>localStorage.getItem(key),setItem:(key,v)=>localStorage.setItem(key,v)},()=>crypto.randomUUID(),async job=>{
  if(!navigator.locks)throw Error('TASK_LOCK_UNAVAILABLE: 当前浏览器无法安全串行写入，请导出文件。');
  return navigator.locks.request(TASK_RESULTS_KEY,job);
 });return bridge(request);
};
export async function packageTask(record:TaskRecord){const view=taskView(record);return createResult({view,taskForm:record,interaction:initialInteraction(view),theme:record.template.theme,layout:record.template.layout,locale:'zh-CN',sourceRecord:{version:1,status:'unverified',code:'LOCAL_TASK',reason:'本地显式填写与确认的记录；来源、模板规则及身份/世界事实未经独立认证。',identityVerified:false,sourceFactsVerified:false}});}
