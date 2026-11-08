import {parseArgs} from 'node:util';
import {open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {createHash} from 'node:crypto';
import pkg from '../package.json' with {type:'json'};
import {checkResultPackage} from '../src/result-interop';
import {readResult} from '../src/results';
import {readSourceSnapshot,sourceOptions} from '../src/source-input';

declare const __SEMANTIC_READONLY_VERSION__:string|undefined;
const entry={name:'semantic-ui-result-local',revision:2,packageVersion:typeof __SEMANTIC_READONLY_VERSION__==='string'?__SEMANTIC_READONLY_VERSION__:pkg.version,checkerContract:'answer-delivery-1; no whole-candidate certification'};
const help=`完整结果的项目内只读入口（修订2；直接调用既有核心，0 MCP连接、0模型）
node --import tsx scripts/result-local.ts --result-file result.json
  [--mapping-file mapping.json] [--answer-file answer.txt] [--binding-file expected-binding.json]
  [--source-file source.json --source-json-pointer /text --source-kind capacity-zh]
  [--source-excerpt 明确选段] [--require-source] [--emit report|explanation|grounded|document]
默认report输出中文说明、结构化核对和原document；explanation只显示中文说明。
未配置固定源只能读取为未核；--require-source对此非零退出。grounded只输出当前来源的有限程序说明；document仅作原始数据迁移，不批准其中正文。
只读明确指定的文件；不修改原件，不连接MCP/DSH，不启动Codex或模型，不读写全局配置。
需要仓库已有Node24+与开发依赖；本命令不是新发行包或自动工具注册。`;

/** Caller-selected JSON only; file IO does not add another result parser or semantic engine. */
async function readJson(file:string,plain=false){
 let handle:Awaited<ReturnType<typeof open>>|undefined;
 try{
  handle=await open(file,constants.O_RDONLY|(constants.O_NOFOLLOW??0)|(constants.O_NONBLOCK??0));
  const before=await handle.stat(),limit=plain?24000:131072;
  if(!before.isFile()||before.size>limit)throw Error('RESULT_FILE_LIMIT');
  const buffer=Buffer.alloc(limit+1);let count=0;
  while(count<buffer.length){const next=await handle.read(buffer,count,buffer.length-count,null);if(!next.bytesRead)break;count+=next.bytesRead;}
  const after=await handle.stat();
  if(count>limit||count!==before.size||before.size!==after.size||before.mtimeMs!==after.mtimeMs||before.ctimeMs!==after.ctimeMs)throw Error('RESULT_FILE_CHANGED');
  const bytes=buffer.subarray(0,count);let text:string;
  try{text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);}catch{throw Error('RESULT_UTF8');}
  let document:unknown;try{document=plain?text:JSON.parse(text);}catch{throw Error('RESULT_JSON');}
  return {document,sha256:createHash('sha256').update(bytes).digest('hex')};
 }catch(error){throw Error(error instanceof Error&&/^RESULT_[A-Z_]+$/u.test(error.message)?error.message:'RESULT_FILE_UNAVAILABLE');}
 finally{await handle?.close();}
}

async function main(){
 const {values,tokens}=parseArgs({options:{'result-file':{type:'string'},'mapping-file':{type:'string'},'answer-file':{type:'string'},'binding-file':{type:'string'},'source-file':{type:'string'},'source-json-pointer':{type:'string'},'source-excerpt':{type:'string'},'source-kind':{type:'string'},'require-source':{type:'boolean'},emit:{type:'string',default:'report'},help:{type:'boolean'},version:{type:'boolean'}},tokens:true});
 const names=tokens.filter(t=>t.kind==='option').map(t=>t.name);if(new Set(names).size!==names.length)throw Error('RESULT_CONFIG_DUPLICATE');
 if(values.help){process.stdout.write(help+'\n');return;}
 if(values.version){process.stdout.write(JSON.stringify(entry)+'\n');return;}
 if(!values['result-file']||!['report','explanation','grounded','document'].includes(values.emit))throw Error('RESULT_CONFIG');
 const sourceArgs=['source-file','source-json-pointer','source-excerpt','source-kind'].flatMap(key=>values[key as keyof typeof values]===undefined?[]:['--'+key,String(values[key as keyof typeof values])]);
 const options=sourceOptions(sourceArgs);
 // Capture the independently selected source once, before reading the package. Package data cannot replace it.
 const source=options?await readSourceSnapshot(options):undefined;
 const input=await readJson(values['result-file']),mapping=values['mapping-file']?await readJson(values['mapping-file']):undefined;
 const answer=values['answer-file']?await readJson(values['answer-file'],true):undefined,binding=values['binding-file']?await readJson(values['binding-file']):undefined;
 const receipt=await checkResultPackage({document:input.document,...(mapping?{mapping:mapping.document}:{}),...(answer?{answer:answer.document}:{}),...(binding?{expectedBinding:binding.document}:{})},source);
 const valid=receipt.status==='limited-delivery'||receipt.status==='checked-unverified';
 const sourceRequiredUnmet=Boolean(values['require-source']&&valid&&receipt.status!=='limited-delivery'),accepted=valid&&!sourceRequiredUnmet;
 if(receipt.document){const original=await readResult(receipt.document);if(original.sha256!==(input.document as {sha256?:string})?.sha256)throw Error('RESULT_CHANGED');}
 const result={...receipt,...(sourceRequiredUnmet?{status:'source-required',explanationZh:'调用者要求独立固定来源匹配；当前来源未核，拒绝作为已核结果继续使用。原包仍只读，未补值或换源。'}:{}),invocation:{entry,transport:'direct in-process function; no MCP',checker:'checkResultPackage',inputFileSha256:input.sha256,sourceConfiguredByCaller:Boolean(source),newMcpConnections:0,newCodexThreads:0,newModelTurns:0,globalConfigurationChanged:false}};
 const delivery=receipt.answerDelivery as {status?:string;text?:string|null}|undefined;
 if(values.emit==='grounded'&&delivery?.status==='limited-source-output'&&accepted)process.stdout.write(String(delivery.text)+'\n');
 else if(values.emit==='document'&&accepted)process.stdout.write(JSON.stringify(receipt.document,null,2)+'\n');
 else if(values.emit==='explanation')process.stdout.write(String(result.explanationZh)+'\n');
 else process.stdout.write(JSON.stringify(result,null,2)+'\n');
 if(!accepted||values.emit==='grounded'&&delivery?.status!=='limited-source-output')process.exitCode=2;
}

main().catch(error=>{
 const message=error instanceof Error?error.message:'';
 const code=message.match(/^(?:RESULT|SOURCE)_[A-Z_]+/u)?.[0]??(error instanceof TypeError&&'code' in error&&String(error.code).startsWith('ERR_PARSE_ARGS')?'RESULT_CONFIG':'RESULT_ENTRY_FAILED');
 process.stdout.write(JSON.stringify({status:'entry-error',explanationZh:'本地读取未完成；原件未修改，没有换源、重试、MCP连接或新增模型回合。请核对明确文件、参数和格式。',detail:code})+'\n');process.exitCode=2;
});
