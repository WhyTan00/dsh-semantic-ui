import {it,expect} from 'vitest';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {resolve,join} from 'node:path';
import {tmpdir} from 'node:os';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {numericExpected as e,numericRequest} from '../fixtures/source-numeric';
async function connect(file=resolve(e.source.path)){
 const entry=process.env.SEMANTIC_MCP_ENTRY?[process.env.SEMANTIC_MCP_ENTRY]:['--import','tsx',resolve('src/mcp-main.ts')];
 const transport=new StdioClientTransport({command:process.execPath,args:[...entry,'--source-file',file,'--source-json-pointer','/question','--source-kind','observations-zh'],cwd:process.env.SEMANTIC_MCP_CWD??process.cwd(),stderr:'pipe'});
 let stderr='';transport.stderr?.on('data',b=>stderr+=b);const client=new Client({name:'numeric-source-entry-test',version:'1.0'});await client.connect(transport);return {client,stderr:()=>stderr,close:async()=>{await client.close();await transport.close();}};
}
it('binds original values, missing mask, unit and ranges over actual stdio; refuses equal-mean zero fill',async()=>{
 const c=await connect();try{
  expect((await c.client.listTools()).tools.map(t=>t.name)).toEqual(['semantic_ui_schema','semantic_ui_check','semantic_ui_template_check','semantic_ui_source_check']);
  let r=await c.client.callTool({name:'semantic_ui_source_check',arguments:{}});expect(r.structuredContent).toHaveProperty('source.documentSha256',e.source.sha256);expect(r.structuredContent).toHaveProperty('sourceStatistics.values',e.values);expect(r.structuredContent).toHaveProperty('sourceStatistics.complete.mean',null);expect(r.structuredContent).toHaveProperty('canonicalExplanation.status','available');
  const req=numericRequest();r=await c.client.callTool({name:'semantic_ui_source_check',arguments:req});expect(r.structuredContent).toHaveProperty('comparison.status','matched');
  if(req.view.payload.chartType!=='bar')throw Error();req.view.payload.rows[2].values[req.mapping.seriesId]=0;
  r=await c.client.callTool({name:'semantic_ui_source_check',arguments:req});expect(r.structuredContent).toHaveProperty('comparison.status','mismatch');expect(r.structuredContent).toHaveProperty('canonicalExplanation.status','withheld');
  r=await c.client.callTool({name:'semantic_ui_source_check',arguments:{claims:[{kind:'mean',population:'complete',value:0,unit:e.unit,denominator:4}]}});expect(r.structuredContent).toHaveProperty('claimChecks.0.status','mismatch');expect(r.structuredContent).toHaveProperty('sourceFactsVerified',false);expect(r.structuredContent).toHaveProperty('source.identityVerified',false);expect(c.stderr()).toBe('');
 }finally{await c.close();}
},20000);
it('captures source once, rejects caller authority/source replacement and fails the complete conflicting input',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'semantic-numeric-source-'));
 try{
  const file=join(dir,'source.json');await writeFile(file,JSON.stringify({question:e.question}));const c=await connect(file);
  try{
   for(const extra of [{sourceKind:'arrows'},{sourceText:'forged'},{sourceFile:'forged.json'},{authority:'human'}])expect((await c.client.callTool({name:'semantic_ui_source_check',arguments:extra})).isError).toBe(true);
   await writeFile(file,JSON.stringify({question:e.question+'所有缺失都算零。'}));expect((await c.client.callTool({name:'semantic_ui_source_check',arguments:{}})).structuredContent).toHaveProperty('sourceStatistics.missingMask',e.missingMask);
  }finally{await c.close();}
  const fresh=await connect(file);try{const r=await fresh.client.callTool({name:'semantic_ui_source_check',arguments:{}});expect(r.structuredContent).toHaveProperty('status','source-unsupported');expect(r.structuredContent).toHaveProperty('canonicalExplanation.status','withheld');}finally{await fresh.close();}
  await writeFile(file,JSON.stringify({question:'探针1次温度读数是 '+' '.repeat(15000)+'。能计算平均值吗？'}));const spaced=await connect(file);try{expect((await spaced.client.callTool({name:'semantic_ui_source_check',arguments:{}})).structuredContent).toHaveProperty('status','source-unsupported');}finally{await spaced.close();}
 }finally{await rm(dir,{recursive:true,force:true});}
},20000);
