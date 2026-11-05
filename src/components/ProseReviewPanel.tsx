import {useId,useRef,useState} from 'react';
import {useI18n} from '../i18n';
import {reviewProse,type ProseReview,type ProseStatus} from '../prose';

const statusLabels:Record<ProseStatus,string>={supported:'Supported','supported-hypothesis':'Supported only under explicit hypothesis',contradicted:'Contradicted',unsupported:'Insufficient source support',unknown:'Undetermined'};
function textAt(value:unknown,pointer:string):string{
 if(pointer!==''&&!pointer.startsWith('/'))throw Error('JSON_POINTER');
 for(const part of pointer===''?[]:pointer.slice(1).split('/')){
  if(/~(?:[^01]|$)/u.test(part))throw Error('JSON_POINTER');
  const key=part.replace(/~1/g,'/').replace(/~0/g,'~');
  if(!value||typeof value!=='object'||!Object.hasOwn(value,key))throw Error('JSON_POINTER');
  value=(value as Record<string,unknown>)[key];
 }
 if(typeof value!=='string')throw Error('TEXT_REQUIRED');return value;
}
/** Input-bound local review. No model, RPC, automatic persistence or inherited certification. */
export function ProseReviewPanel(){
 const {t}=useI18n(),id=useId(),sequence=useRef(0),fileInput=useRef<HTMLInputElement>(null);
 const [source,setSource]=useState(''),[candidate,setCandidate]=useState(''),[sourcePointer,setSourcePointer]=useState('/question'),[candidatePointer,setCandidatePointer]=useState('/finalAnswer');
 const [report,setReport]=useState<ProseReview>(),[busy,setBusy]=useState(false),[message,setMessage]=useState('');
 function invalidate(){sequence.current++;setReport(undefined);setBusy(false);setMessage('Input changed; check again. Previous verdicts were cleared.');}
 async function check(nextSource=source,nextCandidate=candidate){
  const run=++sequence.current;setReport(undefined);setBusy(true);setMessage('');
  try{const next=await reviewProse(nextSource,nextCandidate);if(sequence.current===run)setReport(next);}
  catch{if(sequence.current===run)setMessage('Could not check this input. Your text is preserved.');}
  finally{if(sequence.current===run)setBusy(false);}
 }
 async function load(file:File){
  invalidate();const run=sequence.current;
  try{
   if(file.size>524288)throw Error('FILE_LIMIT');const value=JSON.parse(await file.text());if(sequence.current!==run)return;
   const saved=value?.format==='dsh-semantic-prose-review'&&value.version===1;
   const nextSource=textAt(value,saved?'/sourceText':sourcePointer),nextCandidate=textAt(value,saved?'/candidate':candidatePointer);
   setSource(nextSource);setCandidate(nextCandidate);setMessage('');
   if(saved)await check(nextSource,nextCandidate);
  }catch{if(sequence.current===run)setMessage('Choose a JSON file with text at both selected locations. Maximum file size is 512 KiB.');}
 }
 function download(){
  if(!report)return;const url=URL.createObjectURL(new Blob([JSON.stringify({format:'dsh-semantic-prose-review',version:1,sourceText:source,candidate,report},null,2)+'\n'],{type:'application/json'}));
  const link=document.createElement('a');link.href=url;link.download='semantic-prose-review.json';link.click();setTimeout(()=>URL.revokeObjectURL(url),1000);
 }
 return <details className="prose-panel" data-prose-review-version="1"><summary>{t('Check explanation against source')}</summary>
  <p>{t('Paste complete source text and a candidate explanation. This local check supports finite Chinese capacity, workflow, decision and observation assertions; it never approves an entire answer.')}</p>
  <div className="prose-inputs"><label htmlFor={id+'-source'}>{t('Complete source text')}<textarea id={id+'-source'} rows={5} maxLength={16384} value={source} onChange={e=>{invalidate();setSource(e.target.value);}}/></label>
  <label htmlFor={id+'-candidate'}>{t('Candidate explanation (original)')}<textarea id={id+'-candidate'} rows={7} maxLength={24000} value={candidate} onChange={e=>{invalidate();setCandidate(e.target.value);}}/></label></div>
  <details><summary>{t('Load source and candidate from JSON')}</summary><div className="toolbar"><label>{t('Source text pointer')}<input value={sourcePointer} maxLength={256} onChange={e=>setSourcePointer(e.target.value)}/></label><label>{t('Candidate text pointer')}<input value={candidatePointer} maxLength={256} onChange={e=>setCandidatePointer(e.target.value)}/></label></div><p className="meta">{t('JSON pointers select text fields in your file. Review exports are always checked again when loaded.')}</p><button onClick={()=>fileInput.current?.click()}>{t('Load source and candidate from JSON')}</button><input ref={fileInput} hidden aria-label={t('Load source and candidate from JSON')} type="file" accept="application/json,.json" onChange={e=>{const file=e.target.files?.[0];e.target.value='';if(file)void load(file);}}/></details>
  <div className="toolbar"><button disabled={busy||!source.trim()||!candidate.trim()} onClick={()=>void check()}>{t(busy?'Checking locally…':'Check and create grounded explanation')}</button><button disabled={!report||busy} onClick={download}>{t('Export explanation review')}</button></div>
  {message?<p role="status">{t(message)}</p>:null}
  {report?<section className="prose-report" data-source-sha={report.sourceTextSha256} data-candidate-sha={report.candidateSha256}>
   {report.status!=='reviewed'?<p role="alert">{report.reason}</p>:<><h4>{t('Grounded explanation')}</h4><p className="prose-grounded" style={{whiteSpace:'pre-wrap'}}>{report.groundedText}</p><h4>{t('Assertions checked within the finite contract')} ({report.claims.length})</h4><ol className="prose-claims">{report.claims.map((c,i)=><li key={i} data-claim-kind={c.kind} data-claim-status={c.status}><strong>{t(statusLabels[c.status])}</strong><blockquote style={{whiteSpace:'pre-wrap'}}>{c.extractedText??c.quote}</blockquote><p>{c.reason}</p><p>{t('Correction')}：{c.correction}</p><details><summary>{t('Evidence and technical details')}</summary><p>{t('Candidate location')}：{c.candidateSpan.utf16Start}–{c.candidateSpan.utf16End} {c.candidateSpan.jsonPointer}</p><pre>{JSON.stringify({originalCandidateExcerpt:c.quote,evidence:c.evidence,expected:c.expected,actual:c.actual,counterexample:c.counterexample},null,2)}</pre></details></li>)}</ol><details><summary>{t('Uncovered text (not certified)')} ({report.uncovered.length})</summary>{report.uncovered.map((u,i)=><p key={i} style={{whiteSpace:'pre-wrap'}}>{u.text}</p>)}</details></>}
   <p className="meta">{t('This explanation was generated from the selected source and existing deterministic rules. Other assistant prose and the visible chart are not evidence; identity and world facts are not verified.')}</p><p className="meta">SHA-256：{report.sourceTextSha256}</p>
  </section>:null}<p className="meta">{t('Review export includes your source and candidate text.')}</p>
 </details>;
}
