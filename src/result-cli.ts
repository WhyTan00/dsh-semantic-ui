import {parseArgs} from 'node:util';
import {open} from 'node:fs/promises';
import {constants} from 'node:fs';
import {fileURLToPath} from 'node:url';
import {createHash} from 'node:crypto';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {sourceOptions} from './source-input';
import {readResult} from './results';

/** Explicit caller files only. No discovery, symlinks, fallback, mutation or model configuration. */
async function readJson(file:string,limit:number,plain=false){
 const handle=await open(file,constants.O_RDONLY|(constants.O_NOFOLLOW??0)|(constants.O_NONBLOCK??0));
 try{
  const before=await handle.stat();if(!before.isFile()||before.size>limit)throw Error('RESULT_FILE_LIMIT');
  const buffer=Buffer.alloc(limit+1);let count=0;
  while(count<buffer.length){const next=await handle.read(buffer,count,buffer.length-count,null);if(!next.bytesRead)break;count+=next.bytesRead;}
  const after=await handle.stat();if(count>limit||count!==before.size||before.size!==after.size||before.mtimeMs!==after.mtimeMs||before.ctimeMs!==after.ctimeMs)throw Error('RESULT_FILE_CHANGED');
  const bytes=buffer.subarray(0,count);const text=new TextDecoder('utf-8',{fatal:true}).decode(bytes);return {document:plain?text:JSON.parse(text),sha256:createHash('sha256').update(bytes).digest('hex')};
 }finally{await handle.close();}
}
async function main(){
 const {values,tokens}=parseArgs({options:{'result-file':{type:'string'},'mapping-file':{type:'string'},'answer-file':{type:'string'},'binding-file':{type:'string'},'source-file':{type:'string'},'source-json-pointer':{type:'string'},'source-excerpt':{type:'string'},'source-kind':{type:'string'},emit:{type:'string',default:'report'},'require-source':{type:'boolean'},help:{type:'boolean'}},tokens:true});
 const names=tokens.filter(t=>t.kind==='option').map(t=>t.name);if(new Set(names).size!==names.length)throw Error('RESULT_CONFIG_DUPLICATE');
 if(values.help){console.log('完整语义结果的显式只读MCP入口（0模型、0Codex线程）\nnode dist/result-readonly.js --result-file result.json [--mapping-file mapping.json] [--answer-file answer.txt] [--binding-file expected-binding.json] [--source-file source.json --source-json-pointer /text --source-kind capacity-zh] [--require-source] [--emit report|grounded|document]\n默认输出中文核对与完整document；--emit document仅输出同合同包到stdout，原件不写入。grounded仅输出当前来源的有限程序说明；document是未核原始数据迁移。');return;}
 if(!values['result-file']||!['report','grounded','document'].includes(values.emit))throw Error('RESULT_CONFIG');
 const sourceArgs=['source-file','source-json-pointer','source-excerpt','source-kind'].flatMap(key=>values[key as keyof typeof values]===undefined?[]:['--'+key,String(values[key as keyof typeof values])]);sourceOptions(sourceArgs);
 const input=await readJson(values['result-file'],131072),mapping=values['mapping-file']?await readJson(values['mapping-file'],131072):undefined;
 const answer=values['answer-file']?await readJson(values['answer-file'],24000,true):undefined,binding=values['binding-file']?await readJson(values['binding-file'],131072):undefined;
 const transport=new StdioClientTransport({command:process.execPath,args:[fileURLToPath(new URL('./mcp.js',import.meta.url)),...sourceArgs],stderr:'pipe'});
 const client=new Client({name:'semantic-result-explicit-reader',version:'1.0.0'});let stderr='';transport.stderr?.on('data',b=>{if(stderr.length<2000)stderr+=String(b);});
 try{
  await client.connect(transport);const catalog=await client.listTools(),tool=catalog.tools.find(t=>t.name==='semantic_ui_result_check');if(!tool?.annotations?.readOnlyHint||tool.annotations.openWorldHint!==false)throw Error('RESULT_TOOL_UNAVAILABLE');
  const response=await client.callTool({name:'semantic_ui_result_check',arguments:{document:input.document,...(mapping?{mapping:mapping.document}:{}),...(answer?{answer:answer.document}:{}),...(binding?{expectedBinding:binding.document}:{})}});
  if(response.isError||!response.structuredContent)throw Error('RESULT_TOOL_REFUSED');
  const receipt=response.structuredContent as Record<string,unknown>,ok=receipt.status==='limited-delivery'||receipt.status==='checked-unverified',sourceOk=!values['require-source']||receipt.status==='limited-delivery';
  if(receipt.document){const original=await readResult(receipt.document);if(original.sha256!==(input.document as {sha256?:string}).sha256)throw Error('RESULT_CHANGED');}
  const delivery=receipt.answerDelivery as {status?:string;text?:string|null}|undefined;
  if(values.emit==='grounded'&&delivery?.status==='limited-source-output'&&ok&&sourceOk)process.stdout.write(String(delivery.text)+'\n');
  else if(values.emit==='document'&&ok&&sourceOk){process.stdout.write(JSON.stringify(receipt.document,null,2)+'\n');}
  else{
   const result={...receipt,...(!sourceOk?{status:'source-required',explanationZh:'调用者要求固定来源匹配，但尚未取得；未认证来源或输出可继续使用的新包。'}:{}),invocation:{transport:'actual MCP JSON-RPC stdio',tool:'semantic_ui_result_check',inputFileSha256:input.sha256,server:client.getServerVersion(),newCodexThreads:0,newModelTurns:0,globalConfigurationChanged:false}};
   process.stdout.write(JSON.stringify(result,null,2)+'\n');
  }
  if(!ok||!sourceOk||values.emit==='grounded'&&delivery?.status!=='limited-source-output')process.exitCode=2;
 }finally{await client.close();await transport.close();}
}
main().catch(error=>{process.stdout.write(JSON.stringify({status:'entry-error',explanationZh:'显式结果核对未完成；原件未修改，没有换源、重试或新增模型回合。',detail:error instanceof Error?error.message.slice(0,1200):'RESULT_ENTRY_FAILED'})+'\n');process.exitCode=2;});
