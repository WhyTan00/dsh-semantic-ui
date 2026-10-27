import {it,expect} from 'vitest';
import {resolve} from 'node:path';
import {Client} from '@modelcontextprotocol/sdk/client/index.js';
import {StdioClientTransport} from '@modelcontextprotocol/sdk/client/stdio.js';
import {a2WorkflowSource,workflowRequest} from '../fixtures/source-workflow';
import {createHash} from 'node:crypto';
it('uses real source_check stdio for a complete A2 rule, a contradiction and an original-source override refusal',async()=>{
 const entry=process.env.SEMANTIC_MCP_ENTRY?[process.env.SEMANTIC_MCP_ENTRY]:['--import','tsx',resolve('src/mcp-main.ts')];
 const transport=new StdioClientTransport({command:process.execPath,args:[...entry,'--source-file',resolve('docs/evidence/natural/r9-A2.json'),'--source-json-pointer','/question','--source-kind','workflow-zh'],cwd:process.env.SEMANTIC_MCP_CWD??process.cwd(),stderr:'pipe'}),client=new Client({name:'workflow-source-contract',version:'1'});let stderr='';transport.stderr?.on('data',b=>stderr+=b);
 try{await client.connect(transport);const result=(await client.callTool({name:'semantic_ui_source_check',arguments:workflowRequest()})).structuredContent;expect(result).toHaveProperty('comparison.status','matched');expect(result).toHaveProperty('source.textSha256',createHash('sha256').update(a2WorkflowSource).digest('hex'));expect(result).toHaveProperty('source.selection.textUTF8ByteStart',0);expect(result).toHaveProperty('sourceWorkflow.failurePolicies.0.trigger','通知');
  const bad=(await client.callTool({name:'semantic_ui_source_check',arguments:{...workflowRequest(),claims:[{kind:'rollback',trigger:'通知',target:'支付',value:true}]}})).structuredContent;expect(bad).toHaveProperty('claimChecks.0.status','contradicted');expect(bad).toHaveProperty('canonicalExplanation.status','withheld');
  const override=await client.callTool({name:'semantic_ui_source_check',arguments:{source:'另一份来源'}});expect(override.isError).toBe(true);expect(stderr).toBe('');
 }finally{await client.close();await transport.close();}
},20000);
