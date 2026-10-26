import {it,expect} from 'vitest';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {a3Record,a3FirstView,permissionProjectionA3} from '../fixtures/source-permissions';
async function connect(file=resolve('docs/evidence/natural/r9-A3.json')){
 const entry=process.env.SEMANTIC_MCP_ENTRY?[process.env.SEMANTIC_MCP_ENTRY]:['--import','tsx',resolve('src/mcp-main.ts')];
 const transport=new StdioClientTransport({command:process.execPath,args:[...entry,'--source-file',file,'--source-json-pointer','/question','--source-kind','permissions-zh'],cwd:process.env.SEMANTIC_MCP_CWD??process.cwd(),stderr:'pipe'});
 let stderr='';transport.stderr?.on('data',b=>stderr+=b);const client=new Client({name:'permissions-source-entry-test',version:'1.0'});await client.connect(transport);return {client,stderr:()=>stderr,close:async()=>{await client.close();await transport.close();}};
}
it('inspects full A3, reports the legacy alias as unverified, and checks explicit projection/permission counterexamples over real stdio',async()=>{
 const c=await connect();try{
  expect((await c.client.listTools()).tools.map(t=>t.name)).toEqual(['semantic_ui_schema','semantic_ui_check','semantic_ui_template_check','semantic_ui_source_check']);
  let r=await c.client.callTool({name:'semantic_ui_source_check',arguments:{}});expect(r.structuredContent).toHaveProperty('source.documentSha256','2fb654eabcbe810aee4581f124f773610dc1cd9867925931f2d5513dcceb8481');expect(r.structuredContent).toHaveProperty('sourceCheckKind','permissions-zh');expect(r.structuredContent).toHaveProperty('canonicalExplanation.status','available');
  r=await c.client.callTool({name:'semantic_ui_source_check',arguments:{view:a3FirstView,prose:a3Record.finalAnswer}});expect(r.structuredContent).toHaveProperty('comparison.status','not-assessed');expect(r.structuredContent).toHaveProperty('freeProse.status','not-verified');
  r=await c.client.callTool({name:'semantic_ui_source_check',arguments:{view:permissionProjectionA3(),claims:[{kind:'write',from:'Search',to:'Index',value:false},{kind:'access',from:'Search',to:'Store',value:false}]}});expect(r.structuredContent).toHaveProperty('comparison.status','matched');expect(r.structuredContent).toHaveProperty('claimChecks.0.status','supported');expect(r.structuredContent).toHaveProperty('source.identityVerified',false);expect(r.structuredContent).toHaveProperty('sourceFactsVerified',false);
  r=await c.client.callTool({name:'semantic_ui_source_check',arguments:{claims:[{kind:'access',from:'Gateway',to:'Store',value:false},{kind:'global-exclusivity',text:'Only this caller can write.'}]}});expect(r.structuredContent).toHaveProperty('claimChecks.0.status','not-assessed');expect(r.structuredContent).toHaveProperty('claimChecks.1.status','not-assessed');expect(c.stderr()).toBe('');
 }finally{await c.close();}
},20000);
it('freezes the caller source, rejects request replacement and fails an unsupported full source instead of dropping its conditions',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'semantic-permission-source-'));
 try{
  const file=join(dir,'source.json');await writeFile(file,JSON.stringify({question:a3Record.question}));const c=await connect(file);
  try{
   for(const extra of [{sourceKind:'arrows'},{sourceText:'forged'},{sourceFile:'forged.json'},{authority:'human'}])expect((await c.client.callTool({name:'semantic_ui_source_check',arguments:extra})).isError).toBe(true);
   await writeFile(file,JSON.stringify({question:'服务中，如果失败则全部回滚。'}));const r=await c.client.callTool({name:'semantic_ui_source_check',arguments:{claims:[{kind:'access',from:'Search',to:'Store',value:false}]}});expect(r.structuredContent).toHaveProperty('claimChecks.0.status','supported');
  }finally{await c.close();}
  const fresh=await connect(file);try{expect((await fresh.client.callTool({name:'semantic_ui_source_check',arguments:{}})).structuredContent).toHaveProperty('status','source-unsupported');}finally{await fresh.close();}
 }finally{await rm(dir,{recursive:true,force:true});}
},20000);
