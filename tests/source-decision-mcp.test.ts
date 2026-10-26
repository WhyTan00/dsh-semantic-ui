import {it,expect} from 'vitest';
import {mkdtemp,writeFile,rm} from 'node:fs/promises';
import {join,resolve} from 'node:path';
import {tmpdir} from 'node:os';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {d1Record,d1FirstView,d1Mapping,sourceAlignedD1} from '../fixtures/source-decision';
const file=resolve('docs/evidence/natural/r9-D1.json');
async function connect(source=file){
 const entry=process.env.SEMANTIC_MCP_ENTRY?[process.env.SEMANTIC_MCP_ENTRY]:['--import','tsx',resolve('src/mcp-main.ts')];
 const transport=new StdioClientTransport({command:process.execPath,args:[...entry,'--source-file',source,'--source-json-pointer','/question','--source-kind','decision-zh'],stderr:'pipe',...(process.env.SEMANTIC_MCP_CWD?{cwd:process.env.SEMANTIC_MCP_CWD}:{})});
 let stderr='';transport.stderr?.on('data',b=>stderr+=b);const client=new Client({name:'source-decision-stdio-test',version:'1.0'});await client.connect(transport);return {client,stderr:()=>stderr,close:async()=>{await client.close();await transport.close();}};
}
it('uses the normal source-file entry to inspect the actual full D1 question and reject its first erroneous comparison',async()=>{
 const c=await connect();try{
  const tools=await c.client.listTools();expect(tools.tools.map(t=>t.name)).toEqual(['semantic_ui_schema','semantic_ui_check','semantic_ui_template_check','semantic_ui_source_check']);
  let r=await c.client.callTool({name:'semantic_ui_source_check',arguments:{}});
  expect(r.structuredContent).toHaveProperty('sourceCheckKind','decision-zh');expect(r.structuredContent).toHaveProperty('source.documentSha256','d47b26ee4b18104228b5a9c76b51c15079c65cc080be4f96b0c31fedf25c2b61');expect(r.structuredContent).toHaveProperty('canonicalExplanation.status','available');
  r=await c.client.callTool({name:'semantic_ui_source_check',arguments:{view:d1FirstView,mapping:d1Mapping,prose:d1Record.finalAnswer}});expect(r.structuredContent).toHaveProperty('comparison.status','mismatch');expect(JSON.stringify(r.structuredContent)).toContain('SOURCE_REQUIREMENT_ROLE');
  r=await c.client.callTool({name:'semantic_ui_source_check',arguments:{view:sourceAlignedD1(),mapping:d1Mapping,prose:d1Record.finalAnswer}});expect(r.structuredContent).toHaveProperty('comparison.status','matched');expect(r.structuredContent).toHaveProperty('sourceFactsVerified',false);expect(r.structuredContent).toHaveProperty('freeProse.status','not-verified');expect(c.stderr()).toBe('');
 }finally{await c.close();}
},20000);
it('does not let requests select source kind, source bytes or authority, or certify unsupported cost/recommendation text',async()=>{
 const c=await connect();try{
  for(const extra of [{sourceKind:'arrows'},{sourceFile:'other.json'},{sourceText:'all true'},{claimedAuthority:'human'},{sourceFactsVerified:true}]){const r=await c.client.callTool({name:'semantic_ui_source_check',arguments:extra});expect(r.isError).toBe(true);}
  let r=await c.client.callTool({name:'semantic_ui_source_check',arguments:{claims:[{kind:'maintenance-need',option:'托管平台',actor:'团队',value:false},{kind:'cost',text:'虚拟机更便宜。'},{kind:'recommendation',text:'应当优选托管平台。'}]}});expect(r.structuredContent).toHaveProperty('claimChecks.0.status','unsupported-by-source');expect(r.structuredContent).toHaveProperty('claimChecks.1.status','not-assessed');expect(r.structuredContent).toHaveProperty('canonicalExplanation.status','withheld');
  r=await c.client.callTool({name:'semantic_ui_source_check',arguments:{claims:[{kind:'capability',option:'虚拟机',name:'私网',value:true,text:'therefore always better'}]}});expect(r.isError).toBe(true);
 }finally{await c.close();}
},20000);
it('fails closed on ambiguous or contradictory full-source clauses through the same actual endpoint',async()=>{
 const dir=await mkdtemp(join(tmpdir(),'semantic-decision-source-'));
 try{const path=join(dir,'source.json');await writeFile(path,JSON.stringify({question:'团队在选甲与乙。前者支持私网、不支持私网。'}));const c=await connect(path);try{const r=await c.client.callTool({name:'semantic_ui_source_check',arguments:{}});expect(r.structuredContent).toHaveProperty('status','source-unsupported');expect(r.structuredContent).toHaveProperty('canonicalExplanation.status','withheld');}finally{await c.close();}}finally{await rm(dir,{recursive:true,force:true});}
},20000);
