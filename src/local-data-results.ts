import {ResultLibrary,resultsSchema,emptyResults,type ResultsBridge,type Results,type ResultsRequest} from './results';

export const LOCAL_DATA_RESULTS_KEY='dsh-semantic-ui.local-data-results.v1';
/** Reuse the result package/library contract; only explicitly saved new exploration results live here. */
export function localDataResults(storage:Pick<Storage,'getItem'|'setItem'>,uuid:()=>string,exclusive:<T>(work:()=>Promise<T>)=>Promise<T>):ResultsBridge{
 const read=()=>{const raw=storage.getItem(LOCAL_DATA_RESULTS_KEY);return raw===null?emptyResults():resultsSchema.parse(JSON.parse(raw));};
 const library=new ResultLibrary({get:read,async set(value:Results){if(read().revision!==value.revision-1)throw Error('RESULT_CONFLICT');storage.setItem(LOCAL_DATA_RESULTS_KEY,JSON.stringify(value));}},uuid);
 return async(request:ResultsRequest)=>{
  if(request.action==='save'&&(!request.document||typeof request.document!=='object'||!('manifest'in request.document)||(request.document as {manifest?:{version?:number}}).manifest?.version!==4))throw Error('LOCAL_DATA_RESULT_REQUIRED');
  return request.action==='list'?library.request(request):exclusive(()=>library.request(request));
 };
}
let browserBridge:ResultsBridge|undefined;
export const browserDataResults:ResultsBridge=async request=>{
 if(!browserBridge)browserBridge=localDataResults({getItem:key=>window.localStorage.getItem(key),setItem:(key,value)=>window.localStorage.setItem(key,value)},()=>crypto.randomUUID(),async work=>{
  if(!navigator.locks)throw Error('LOCAL_DATA_LOCK_UNAVAILABLE: Export the result file instead.');
  return navigator.locks.request(LOCAL_DATA_RESULTS_KEY,work);
 });
 return browserBridge(request);
};
