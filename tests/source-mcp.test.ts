import {it,expect} from 'vitest';
import {mkdtemp,writeFile,readFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';

const a2=resolve('docs/evidence/natural/r9-A2.json'),a3=resolve('docs/evidence/natural/r9-A3.json');
const excerpt='入口→鉴权→库存→支付，支付→通知';
const entry=process.env.SEMANTIC_MCP_ENTRY?[process.env.SEMANTIC_MCP_ENTRY]:['--import','tsx',resolve('src/mcp-main.ts')];
async function connect(file:string,selected?:string){
 const transport=new StdioClientTransport({command:process.execPath,args:[...entry,'--source-file',file,'--source-json-pointer','/question',...(selected?['--source-excerpt',selected]:[])],stderr:'pipe',...(process.env.SEMANTIC_MCP_CWD?{cwd:process.env.SEMANTIC_MCP_CWD}:{})});
 let stderr='';transport.stderr?.on('data',chunk=>stderr+=chunk);
 const client=new Client({name:'source-separation-test',version:'1.0'});await client.connect(transport);
 return {client,transport,stderr:()=>stderr,close:async()=>{await client.close();await transport.close();}};
}
it('adds one opt-in tool over real stdio, exposes source hashes and compares the original first graph',async()=>{
 const data=JSON.parse(await readFile(a2,'utf8')),view=data.actualToolCalls.find((c:{arguments?:{view?:unknown}})=>c.arguments?.view).arguments.view;
 const conn=await connect(a2,excerpt);
 try{
  const tools=await conn.client.listTools();expect(tools.tools.map(t=>t.name)).toEqual(['semantic_ui_schema','semantic_ui_check','semantic_ui_template_check','semantic_ui_source_check']);
  expect(tools.tools.at(-1)?.annotations?.readOnlyHint).toBe(true);expect(tools.tools.at(-1)?._meta?.ui).toBeUndefined();
  let result=await conn.client.callTool({name:'semantic_ui_source_check',arguments:{}});
  expect(result.structuredContent).toHaveProperty('source.documentSha256','17a3d65a7367f5b4686b9cc57867e7bbc265e11ff5f91fb9d1d00a2f59f2104e');
  expect(result.structuredContent).toHaveProperty('comparison.status','not-requested');
  result=await conn.client.callTool({name:'semantic_ui_source_check',arguments:{view,prose:data.finalAnswer}});
  expect(result.structuredContent).toHaveProperty('comparison.status','matched');expect(result.structuredContent).toHaveProperty('freeProse.status','not-verified');expect(result.structuredContent).toHaveProperty('sourceFactsVerified',false);
  const reversed=structuredClone(view);reversed.payload.scenarios=[];[reversed.payload.edges[0].source,reversed.payload.edges[0].target]=[reversed.payload.edges[0].target,reversed.payload.edges[0].source];
  result=await conn.client.callTool({name:'semantic_ui_source_check',arguments:{view:reversed}});
  expect(result.structuredContent).toHaveProperty('comparison.status','mismatch');
  expect(JSON.stringify(result.structuredContent)).toContain('SOURCE_RELATION_REVERSED');expect(conn.stderr()).toBe('');
 }finally{await conn.close();}
},20000);
it('cannot replace the startup source through request fields or a later file change',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'semantic-source-stdio-'));
 try{
  const file=join(dir,'source.json');await writeFile(file,JSON.stringify({question:'Left→Right'}));
  const conn=await connect(file);
  try{
   let result=await conn.client.callTool({name:'semantic_ui_source_check',arguments:{claims:[{kind:'edge',from:'Left',to:'Right'}]}});
   const sourceHash=(result.structuredContent as {source:{documentSha256:string}}).source.documentSha256;
   expect(result.structuredContent).toHaveProperty('claimChecks.0.status','supported');
   await writeFile(file,JSON.stringify({question:'Right→Left'}));
   result=await conn.client.callTool({name:'semantic_ui_source_check',arguments:{claims:[{kind:'edge',from:'Left',to:'Right'}]}});
   expect(result.structuredContent).toHaveProperty('source.documentSha256',sourceHash);expect(result.structuredContent).toHaveProperty('claimChecks.0.status','supported');
   for(const replacement of [{sourceText:'Right→Left'},{sourceFile:a3},{sourceFactsVerified:true}]){
    const rejected=await conn.client.callTool({name:'semantic_ui_source_check',arguments:replacement});expect(rejected.isError).toBe(true);
   }
   result=await conn.client.callTool({name:'semantic_ui_source_check',arguments:{claims:[{kind:'causal-impact',text:'Left failure guarantees Right failure.'}]}});
   expect(result.structuredContent).toHaveProperty('claimChecks.0.status','not-assessed');expect(result.structuredContent).toHaveProperty('canonicalExplanation.status','withheld');
  }finally{await conn.close();}
 }finally{await rm(dir,{recursive:true,force:true});}
},20000);
it('leaves the actual A3 natural-language source unsupported over the same normal entrypoint',async()=>{
 const conn=await connect(a3);
 try{const result=await conn.client.callTool({name:'semantic_ui_source_check',arguments:{}});expect(result.structuredContent).toHaveProperty('status','source-unsupported');expect(result.structuredContent).toHaveProperty('canonicalExplanation.status','withheld');}finally{await conn.close();}
},20000);
it('fails startup without choosing an alternative source or leaking the missing file path',async()=>{
 const absent=join(tmpdir(),'semantic-source-no-such-file-627c.json');
 try{await promisify(execFile)(process.execPath,[...entry,'--source-file',absent]);throw Error('Unexpected startup success');}
 catch(error){const failure=error as Error&{code:number;stderr:string};expect(failure.code).toBe(1);expect(failure.stderr).toContain('SOURCE_FILE_UNAVAILABLE');expect(failure.stderr).not.toContain(absent);}
},20000);
